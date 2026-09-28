package main

import (
	"context"
	"strings"
	"time"

	"github.com/helmedeiros/quartermark/okr/tracker"
	"github.com/helmedeiros/quartermark/shared/timewindow"
)

type demoTracker struct{ real trackerFor }

type trackerFor interface {
	For(ctx context.Context, teamSlug string) (tracker.Source, error)
}

func withDemoTracker(real trackerFor) demoTracker { return demoTracker{real: real} }

func (d demoTracker) For(ctx context.Context, teamSlug string) (tracker.Source, error) {
	if teamSlug == demoTeamSlug {
		return demoIssues{}, nil
	}
	return d.real.For(ctx, teamSlug)
}

type demoIssues struct{}

func daysAgo(n int) time.Time {
	return time.Now().UTC().AddDate(0, 0, -n).Truncate(time.Hour)
}

func at(t time.Time) *time.Time { return &t }

func (demoIssues) catalogue() map[string]tracker.Issue {
	return map[string]tracker.Issue{
		"DEMO-101": {
			Key: "DEMO-101", IssueType: "Epic", Summary: "Time to a first published quarter",
			StatusCategory: "indeterminate", Assignee: "Ada Lovelace",
			Labels:  []string{"onboarding"},
			Created: daysAgo(64), InProgressAt: at(daysAgo(50)),
			DueDate: at(daysAgo(-18)),
			Sprints: []tracker.Sprint{
				{Name: "Sprint 12", StartDate: at(daysAgo(21)), EndDate: at(daysAgo(7))},
				{Name: "Sprint 13", StartDate: at(daysAgo(7)), EndDate: at(daysAgo(-7))},
			},
		},
		"DEMO-102": {
			Key: "DEMO-102", IssueType: "Story", Summary: "Spreadsheet import",
			StatusCategory: "done", Assignee: "Ada Lovelace",
			Created: daysAgo(70), InProgressAt: at(daysAgo(66)), DoneAt: at(daysAgo(45)),
		},
		"DEMO-110": {
			Key: "DEMO-110", IssueType: "Epic", Summary: "Onboard without a support call",
			StatusCategory: "indeterminate", Assignee: "Grace Hopper",
			Labels:  []string{"onboarding", "docs"},
			Created: daysAgo(58), InProgressAt: at(daysAgo(30)),
		},
		"DEMO-201": {
			Key: "DEMO-201", IssueType: "Epic", Summary: "Progress roll-up from child issues",
			StatusCategory: "done", Assignee: "Grace Hopper",
			Created: daysAgo(72), InProgressAt: at(daysAgo(60)), DoneAt: at(daysAgo(28)),
		},
		"DEMO-202": {
			Key: "DEMO-202", IssueType: "Story", Summary: "As-of history for closed quarters",
			StatusCategory: "indeterminate", Assignee: "Grace Hopper",
			Created: daysAgo(40), InProgressAt: at(daysAgo(12)),
		},
	}
}

func (d demoIssues) GetIssuesByKeys(_ context.Context, keys []string) ([]tracker.Issue, error) {
	catalogue := d.catalogue()
	out := make([]tracker.Issue, 0, len(keys))
	for _, key := range keys {
		if issue, known := catalogue[key]; known {
			out = append(out, issue)
		}
	}
	return out, nil
}

func (demoIssues) GetChildIssues(_ context.Context, key string) ([]tracker.ChildIssue, error) {
	children := map[string][]tracker.ChildIssue{
		"DEMO-101": {
			{Created: daysAgo(64), Resolved: at(daysAgo(52))},
			{Created: daysAgo(60), Resolved: at(daysAgo(33))},
			{Created: daysAgo(48), Resolved: at(daysAgo(9))},
			{Created: daysAgo(30)},
			{Created: daysAgo(14)},
		},
		"DEMO-110": {
			{Created: daysAgo(58), Resolved: at(daysAgo(36))},
			{Created: daysAgo(44)},
			{Created: daysAgo(20)},
		},
	}
	return children[key], nil
}

func (d demoIssues) SearchIssuesByText(_ context.Context, query string, limit int) ([]tracker.IssueSummary, error) {
	var out []tracker.IssueSummary
	for _, issue := range d.catalogue() {
		if len(out) >= limit {
			break
		}
		if matchesQuery(issue, query) {
			out = append(out, tracker.IssueSummary{
				Key: issue.Key, Summary: issue.Summary, IssueType: issue.IssueType,
			})
		}
	}
	return out, nil
}

func matchesQuery(issue tracker.Issue, query string) bool {
	if query == "" {
		return true
	}
	needle := strings.ToLower(query)
	return strings.Contains(strings.ToLower(issue.Key), needle) ||
		strings.Contains(strings.ToLower(issue.Summary), needle)
}

func (demoIssues) SearchIssuesByAssignee(context.Context, string, timewindow.Window) ([]tracker.Issue, error) {
	return nil, nil
}
