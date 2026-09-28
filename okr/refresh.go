package okr

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/helmedeiros/quartermark/okr/tracker"
)

const (
	RefreshTTL           = 24 * time.Hour
	trackerHistoryAuthor = "Jira sync"
)

func IsRefreshFresh(lastRefresh, now time.Time) bool {
	return !lastRefresh.IsZero() && now.Sub(lastRefresh) < RefreshTTL
}

func RefreshQuarter(ctx context.Context, source tracker.Source, quarter *Quarter, now time.Time) (time.Time, error) {
	asOf := quarter.progressAsOf(now)

	keys := quarter.trackerKeys()
	if len(keys) == 0 {
		return asOf, nil
	}

	readings, err := readTracker(ctx, source, keys, asOf)
	if err != nil {
		return asOf, err
	}

	quarter.Walk(func(n *Node) { applyReadings(n, readings, asOf) })
	return asOf, nil
}

func RefreshNode(ctx context.Context, source tracker.Source, quarter *Quarter, nodeID string, now time.Time) (bool, error) {
	node := quarter.Find(nodeID)
	if node == nil {
		return false, nil
	}

	asOf := quarter.progressAsOf(now)
	readings := trackerReadings{}
	if len(node.TrackerKeys) > 0 {
		var err error
		if readings, err = readTracker(ctx, source, node.TrackerKeys, asOf); err != nil {
			return true, err
		}
	}

	applyReadings(node, readings, asOf)
	return true, nil
}

func (q *Quarter) progressAsOf(now time.Time) time.Time {
	if q.End.IsZero() {
		return now
	}
	endOfLastDay := q.End.Time().Add(24*time.Hour - time.Nanosecond)
	if now.Before(endOfLastDay) {
		return now
	}
	return endOfLastDay
}

func (q *Quarter) trackerKeys() []string {
	seen := map[string]bool{}
	q.Walk(func(n *Node) {
		for _, k := range n.TrackerKeys {
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

type childCount struct{ done, total int }

type trackerReadings struct {
	issues   map[string]tracker.Issue
	children map[string]childCount
}

func readTracker(ctx context.Context, source tracker.Source, keys []string, asOf time.Time) (trackerReadings, error) {
	out := trackerReadings{
		issues:   map[string]tracker.Issue{},
		children: map[string]childCount{},
	}

	issues, err := source.GetIssuesByKeys(ctx, keys)
	if err != nil {
		return out, fmt.Errorf("fetch issues: %w", err)
	}
	for _, issue := range issues {
		out.issues[issue.Key] = issue
	}

	for _, key := range keys {
		children, err := source.GetChildIssues(ctx, key)
		if err != nil {
			return out, fmt.Errorf("fetch child work items for %s: %w", key, err)
		}
		if count := countResolvedAsOf(children, asOf); count.total > 0 {
			out.children[key] = count
		}
	}
	return out, nil
}

func countResolvedAsOf(children []tracker.ChildIssue, asOf time.Time) childCount {
	var count childCount
	for _, c := range children {
		if c.Created.IsZero() || c.Created.After(asOf) {
			continue
		}
		count.total++
		if c.Resolved != nil && !c.Resolved.After(asOf) {
			count.done++
		}
	}
	return count
}

func categoryAsOf(issue tracker.Issue, asOf time.Time) string {
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

func categoryWeight(category string) float64 {
	switch category {
	case "done":
		return 1
	case "indeterminate":
		return 0.5
	default:
		return 0
	}
}

func statusForProgress(progress Progress) Status {
	switch {
	case progress >= 100:
		return Done
	case progress > 0:
		return OnTrack
	default:
		return NotStarted
	}
}

func percent(part, whole int) Progress {
	if whole == 0 {
		return 0
	}
	return clampProgress(int(math.Round(float64(part) / float64(whole) * 100)))
}

func clampProgress(v int) Progress {
	switch {
	case v < 0:
		return 0
	case v > 100:
		return 100
	default:
		return Progress(v)
	}
}

func applyReadings(n *Node, readings trackerReadings, asOf time.Time) {
	linked := n.linkedIssues(readings)
	if len(linked) == 0 {
		n.recordUnlinkedFromTracker(asOf)
		return
	}

	n.TrackerSnapshots = map[string]TrackerSnapshot{}
	weight := 0.0
	for _, key := range linked {
		issue := readings.issues[key]
		weight += categoryWeight(categoryAsOf(issue, asOf))
		n.TrackerSnapshots[key] = snapshotOf(issue, readings.children[key], asOf)
	}

	n.Progress = clampProgress(int(math.Round(weight / float64(len(linked)) * 100)))
	if len(linked) == 1 {
		key := linked[0]
		if count, ok := readings.children[key]; ok {
			n.Progress = percent(count.done, count.total)
		}
		n.Updates = mergeTrackerHistory(n.Updates, trackerHistory(readings.issues[key], n.Progress, asOf))
	}
	n.Status = statusForProgress(n.Progress)
}

func (n *Node) linkedIssues(readings trackerReadings) []string {
	var linked []string
	for _, key := range n.TrackerKeys {
		if _, found := readings.issues[key]; found {
			linked = append(linked, key)
		}
	}
	return linked
}

func (n *Node) recordUnlinkedFromTracker(asOf time.Time) {
	if len(n.TrackerSnapshots) == 0 {
		return
	}
	n.Updates = append(n.Updates, Update{
		Date:     dateOf(asOf),
		Status:   n.Status,
		Progress: n.Progress,
		Note:     "Unlinked from Jira",
		Author:   trackerHistoryAuthor,
	})
	n.TrackerSnapshots = nil
}

func snapshotOf(issue tracker.Issue, children childCount, asOf time.Time) TrackerSnapshot {
	progress := clampProgress(int(math.Round(categoryWeight(categoryAsOf(issue, asOf)) * 100)))
	if children.total > 0 {
		progress = percent(children.done, children.total)
	}

	snapshot := TrackerSnapshot{
		Key:       issue.Key,
		Summary:   issue.Summary,
		IssueType: issue.IssueType,
		Status:    statusForProgress(progress),
		HasStatus: true,
		Progress:  progress,
		Assignee:  issue.Assignee,
		Labels:    issue.Labels,
		SyncedAt:  asOf,
	}
	if issue.DueDate != nil {
		snapshot.Due = dateOf(*issue.DueDate)
	}
	for _, s := range issue.Sprints {
		sprint := Sprint{Name: s.Name}
		if s.StartDate != nil {
			sprint.Start = dateOf(*s.StartDate)
		}
		if s.EndDate != nil {
			sprint.End = dateOf(*s.EndDate)
		}
		snapshot.Sprints = append(snapshot.Sprints, sprint)
	}
	return snapshot
}

func trackerHistory(issue tracker.Issue, current Progress, asOf time.Time) []Update {
	point := func(t time.Time, progress Progress) Update {
		return Update{
			Date:     dateOf(t),
			Status:   statusForProgress(progress),
			Progress: progress,
			Author:   trackerHistoryAuthor,
		}
	}

	var points []Update
	if !issue.Created.IsZero() && !issue.Created.After(asOf) {
		points = append(points, point(issue.Created, 0))
	}
	if issue.InProgressAt != nil && !issue.InProgressAt.After(asOf) {
		points = append(points, point(*issue.InProgressAt, 50))
	}
	if issue.DoneAt != nil && !issue.DoneAt.After(asOf) {
		points = append(points, point(*issue.DoneAt, 100))
	}
	return append(points, point(asOf, current))
}

func mergeTrackerHistory(existing, fresh []Update) []Update {
	merged := make([]Update, 0, len(existing)+len(fresh))
	for _, u := range existing {
		if u.Author != trackerHistoryAuthor {
			merged = append(merged, u)
		}
	}
	merged = append(merged, fresh...)
	sort.SliceStable(merged, func(i, j int) bool {
		return merged[i].Date.String() < merged[j].Date.String()
	})
	return merged
}

func dateOf(t time.Time) Date {
	d, err := NewDate(t.Year(), t.Month(), t.Day())
	if err != nil {
		return Date{}
	}
	return d
}
