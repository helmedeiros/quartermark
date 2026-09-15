package okr

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/helmedeiros/quartermark/jirasource"
	"github.com/helmedeiros/quartermark/jsontree"
)

const RefreshTTL = 24 * time.Hour

func IsRefreshFresh(v any, now time.Time) bool {
	last, ok := v.(string)
	if !ok || last == "" {
		return false
	}
	t, err := time.Parse(time.RFC3339, last)
	if err != nil {
		return false
	}
	return now.Sub(t) < RefreshTTL
}

func RefreshQuarterFromJira(ctx context.Context, jira jirasource.Source, quarter map[string]any, now time.Time) (time.Time, error) {
	asOf := quarterJiraAsOf(quarter, now)

	keys := collectJiraKeys(quarter["objectives"])
	if len(keys) == 0 {
		return asOf, nil
	}

	issues, err := jira.GetIssuesByKeys(ctx, keys)
	if err != nil {
		return asOf, fmt.Errorf("fetch Jira issues: %w", err)
	}
	byKey := make(map[string]jirasource.Issue, len(issues))
	for _, issue := range issues {
		byKey[issue.Key] = issue
	}

	childByKey, err := jiraChildProgressByKey(ctx, jira, keys, asOf)
	if err != nil {
		return asOf, err
	}

	applyJiraProgress(quarter["objectives"], byKey, childByKey, asOf)
	return asOf, nil
}

func RefreshNodeFromJira(ctx context.Context, jira jirasource.Source, quarter map[string]any, nodeID string, now time.Time) (bool, error) {
	node := findNodeByID(quarter["objectives"], nodeID)
	if node == nil {
		return false, nil
	}

	keys := jsontree.StringSlice(node["jiraKeys"])
	asOf := quarterJiraAsOf(quarter, now)

	var byKey map[string]jirasource.Issue
	var childByKey map[string]jiraChildProgress
	if len(keys) > 0 {
		issues, err := jira.GetIssuesByKeys(ctx, keys)
		if err != nil {
			return true, fmt.Errorf("fetch Jira issues: %w", err)
		}
		byKey = make(map[string]jirasource.Issue, len(issues))
		for _, issue := range issues {
			byKey[issue.Key] = issue
		}

		childByKey, err = jiraChildProgressByKey(ctx, jira, keys, asOf)
		if err != nil {
			return true, err
		}
	}

	applyJiraProgressToNode(node, byKey, childByKey, asOf)
	return true, nil
}

func findNodeByID(objectivesAny any, id string) map[string]any {
	var found map[string]any
	jsontree.Walk(objectivesAny, func(node map[string]any) {
		if found != nil {
			return
		}
		if nodeID, _ := node["id"].(string); nodeID == id {
			found = node
		}
	})
	return found
}

func quarterJiraAsOf(quarter map[string]any, now time.Time) time.Time {
	endStr, _ := quarter["endDate"].(string)
	if endStr == "" {
		return now
	}
	end, err := time.Parse("2006-01-02", endStr)
	if err != nil {
		return now
	}
	endOfDay := end.Add(24*time.Hour - time.Nanosecond)
	if now.Before(endOfDay) {
		return now
	}
	return endOfDay
}

func jiraChildProgressByKey(ctx context.Context, jira jirasource.Source, keys []string, asOf time.Time) (map[string]jiraChildProgress, error) {
	childByKey := make(map[string]jiraChildProgress, len(keys))
	for _, k := range keys {
		children, err := jira.GetChildIssues(ctx, k)
		if err != nil {
			return nil, fmt.Errorf("fetch Jira child work items for %s: %w", k, err)
		}
		if done, total := childProgressAsOf(children, asOf); total > 0 {
			childByKey[k] = jiraChildProgress{done: done, total: total}
		}
	}
	return childByKey, nil
}

func collectJiraKeys(objectivesAny any) []string {
	seen := map[string]bool{}
	jsontree.Walk(objectivesAny, func(node map[string]any) {
		for _, k := range jsontree.StringSlice(node["jiraKeys"]) {
			seen[k] = true
		}
	})
	keys := make([]string, 0, len(seen))
	for k := range seen {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func jiraStatusCategoryWeight(category string) float64 {
	switch category {
	case "done":
		return 1
	case "indeterminate":
		return 0.5
	default:
		return 0
	}
}

type jiraChildProgress struct{ done, total int }

func childProgressAsOf(children []jirasource.ChildIssue, asOf time.Time) (done, total int) {
	for _, c := range children {
		if c.Created.IsZero() || c.Created.After(asOf) {
			continue
		}
		total++
		if c.Resolved != nil && !c.Resolved.After(asOf) {
			done++
		}
	}
	return done, total
}

func categoryAsOf(issue jirasource.Issue, asOf time.Time) string {
	if issue.Created.IsZero() {
		return issue.StatusCategory
	}
	if issue.DoneAt != nil && !issue.DoneAt.After(asOf) {
		return "done"
	}
	if issue.InProgressAt != nil && !issue.InProgressAt.After(asOf) {
		return "indeterminate"
	}
	if !issue.Created.After(asOf) {
		return "new"
	}
	return ""
}

func applyJiraProgress(objectivesAny any, byKey map[string]jirasource.Issue, childByKey map[string]jiraChildProgress, asOf time.Time) {
	jsontree.Walk(objectivesAny, func(node map[string]any) {
		applyJiraProgressToNode(node, byKey, childByKey, asOf)
	})
}

func applyJiraProgressToNode(node map[string]any, byKey map[string]jirasource.Issue, childByKey map[string]jiraChildProgress, asOf time.Time) {
	keys := jsontree.StringSlice(node["jiraKeys"])
	total := 0
	weight := 0.0
	var lastFound jirasource.Issue
	var lastKey string
	issues := map[string]any{}
	for _, k := range keys {
		issue, found := byKey[k]
		if !found {
			continue
		}
		total++
		weight += jiraStatusCategoryWeight(categoryAsOf(issue, asOf))
		lastFound = issue
		lastKey = k
		issues[k] = jiraIssueSnapshot(issue, childByKey[k], asOf)
	}
	if total == 0 {
		if _, hadJiraIssues := node["jiraIssues"]; hadJiraIssues {
			entry := map[string]any{
				"date":     asOf.Format("2006-01-02"),
				"status":   node["status"],
				"progress": node["progress"],
				"note":     "Unlinked from Jira",
				"author":   jiraHistoryAuthor,
			}
			existing, _ := node["updates"].([]any)
			node["updates"] = append(append([]any{}, existing...), entry)
		}
		delete(node, "jiraIssues")
		return
	}
	node["jiraIssues"] = issues

	progress := int(math.Round(weight / float64(total) * 100))
	if total == 1 {
		if cp, ok := childByKey[lastKey]; ok && cp.total > 0 {
			progress = int(math.Round(float64(cp.done) / float64(cp.total) * 100))
		}
	}
	node["progress"] = progress
	node["status"] = statusForProgress(progress)
	if total == 1 {
		node["updates"] = mergeJiraHistoryUpdates(node["updates"], jiraHistoryUpdatesAsOf(lastFound, progress, asOf))
	}
}

func jiraIssueSnapshot(issue jirasource.Issue, childProgress jiraChildProgress, asOf time.Time) map[string]any {
	progress := int(math.Round(jiraStatusCategoryWeight(categoryAsOf(issue, asOf)) * 100))
	if childProgress.total > 0 {
		progress = int(math.Round(float64(childProgress.done) / float64(childProgress.total) * 100))
	}
	snapshot := map[string]any{
		"summary":   issue.Summary,
		"issueType": issue.IssueType,
		"status":    statusForProgress(progress),
		"progress":  progress,
		"assignee":  issue.Assignee,
		"labels":    issue.Labels,
		"syncedAt":  asOf.Format(time.RFC3339),
	}
	if issue.DueDate != nil {
		snapshot["dueDate"] = issue.DueDate.Format("2006-01-02")
	}
	if sprints := sprintSnapshots(issue.Sprints); sprints != nil {
		snapshot["sprints"] = sprints
	}
	return snapshot
}

func sprintSnapshots(sprints []jirasource.Sprint) []map[string]any {
	if len(sprints) == 0 {
		return nil
	}
	out := make([]map[string]any, 0, len(sprints))
	for _, s := range sprints {
		entry := map[string]any{"name": s.Name}
		if s.StartDate != nil {
			entry["startDate"] = s.StartDate.Format("2006-01-02")
		}
		if s.EndDate != nil {
			entry["endDate"] = s.EndDate.Format("2006-01-02")
		}
		out = append(out, entry)
	}
	return out
}

func statusForProgress(progress int) string {
	switch {
	case progress >= 100:
		return "done"
	case progress > 0:
		return "on_track"
	default:
		return "not_started"
	}
}

const jiraHistoryAuthor = "Jira sync"

func jiraHistoryUpdatesAsOf(issue jirasource.Issue, currentProgress int, asOf time.Time) []map[string]any {
	point := func(t time.Time, progress int) map[string]any {
		return map[string]any{
			"date":     t.Format("2006-01-02"),
			"status":   statusForProgress(progress),
			"progress": progress,
			"author":   jiraHistoryAuthor,
		}
	}
	var points []map[string]any
	if !issue.Created.IsZero() && !issue.Created.After(asOf) {
		points = append(points, point(issue.Created, 0))
	}
	if issue.InProgressAt != nil && !issue.InProgressAt.After(asOf) {
		points = append(points, point(*issue.InProgressAt, 50))
	}
	if issue.DoneAt != nil && !issue.DoneAt.After(asOf) {
		points = append(points, point(*issue.DoneAt, 100))
	}
	points = append(points, point(asOf, currentProgress))
	return points
}

func mergeJiraHistoryUpdates(existingAny any, fresh []map[string]any) []any {
	merged := make([]map[string]any, 0, len(fresh))
	if existing, ok := existingAny.([]any); ok {
		for _, uAny := range existing {
			u, ok := uAny.(map[string]any)
			if !ok {
				continue
			}
			if author, _ := u["author"].(string); author == jiraHistoryAuthor {
				continue
			}
			merged = append(merged, u)
		}
	}
	merged = append(merged, fresh...)
	sort.Slice(merged, func(i, j int) bool {
		di, _ := merged[i]["date"].(string)
		dj, _ := merged[j]["date"].(string)
		return di < dj
	})
	out := make([]any, len(merged))
	for i, u := range merged {
		out[i] = u
	}
	return out
}
