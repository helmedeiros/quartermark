package okr_test

import (
	"context"
	"testing"
	"time"

	"github.com/helmedeiros/quartermark/jirasource"
	"github.com/helmedeiros/quartermark/okr"
	"github.com/helmedeiros/quartermark/timewindow"
)

type fakeJira struct {
	byKey           map[string]jirasource.Issue
	childrenByKey   map[string][]jirasource.ChildIssue
	getIssuesByKeys int
	getChildIssues  int
}

func (f *fakeJira) SearchIssuesByAssignee(context.Context, string, timewindow.Window) ([]jirasource.Issue, error) {
	return nil, nil
}

func (f *fakeJira) GetIssuesByKeys(_ context.Context, keys []string) ([]jirasource.Issue, error) {
	f.getIssuesByKeys++
	out := make([]jirasource.Issue, 0, len(keys))
	for _, k := range keys {
		if issue, ok := f.byKey[k]; ok {
			out = append(out, issue)
		}
	}
	return out, nil
}

func (f *fakeJira) GetChildIssues(_ context.Context, key string) ([]jirasource.ChildIssue, error) {
	f.getChildIssues++
	return f.childrenByKey[key], nil
}

func (f *fakeJira) SearchIssuesByText(context.Context, string, int) ([]jirasource.IssueSummary, error) {
	return nil, nil
}

func milestoneQuarter(jiraKeys []string) map[string]any {
	return map[string]any{
		"quarterId": "2026-q1",
		"objectives": []any{
			map[string]any{
				"id": "O-1",
				"children": []any{
					map[string]any{
						"id":       "O-1-M1",
						"jiraKeys": toAnySlice(jiraKeys),
					},
				},
			},
		},
	}
}

func toAnySlice(ss []string) []any {
	out := make([]any, len(ss))
	for i, s := range ss {
		out[i] = s
	}
	return out
}

func milestoneOf(quarter map[string]any) map[string]any {
	objective := quarter["objectives"].([]any)[0].(map[string]any)
	return objective["children"].([]any)[0].(map[string]any)
}

func TestRefreshQuarterFromJira_DerivesProgressFromLinkedIssueStatus(t *testing.T) {
	jira := &fakeJira{byKey: map[string]jirasource.Issue{
		"PROJ-1": {Key: "PROJ-1", StatusCategory: "done"},
		"PROJ-2": {Key: "PROJ-2", StatusCategory: "indeterminate"},
	}}
	quarter := milestoneQuarter([]string{"PROJ-1", "PROJ-2"})
	now := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)

	if _, err := okr.RefreshQuarterFromJira(context.Background(), jira, quarter, now); err != nil {
		t.Fatalf("RefreshQuarterFromJira: %v", err)
	}

	milestone := milestoneOf(quarter)
	if milestone["progress"] != 75 {
		t.Fatalf("expected progress=75 (1 done + 1 in-progress of 2 issues), got %v", milestone["progress"])
	}
	if milestone["status"] != "on_track" {
		t.Fatalf("expected status=on_track, got %v", milestone["status"])
	}
}

func TestRefreshQuarterFromJira_SurfacesDueDateOnTheSnapshotWhenPresent(t *testing.T) {
	due := time.Date(2026, 12, 31, 0, 0, 0, 0, time.UTC)
	jira := &fakeJira{byKey: map[string]jirasource.Issue{
		"PROJ-1": {Key: "PROJ-1", StatusCategory: "done", DueDate: &due},
		"PROJ-2": {Key: "PROJ-2", StatusCategory: "indeterminate"},
	}}
	quarter := milestoneQuarter([]string{"PROJ-1", "PROJ-2"})
	now := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)

	if _, err := okr.RefreshQuarterFromJira(context.Background(), jira, quarter, now); err != nil {
		t.Fatalf("RefreshQuarterFromJira: %v", err)
	}

	milestone := milestoneOf(quarter)
	issues, ok := milestone["jiraIssues"].(map[string]any)
	if !ok {
		t.Fatalf("expected jiraIssues map, got %+v", milestone["jiraIssues"])
	}
	withDue, ok := issues["PROJ-1"].(map[string]any)
	if !ok || withDue["dueDate"] != "2026-12-31" {
		t.Fatalf("expected PROJ-1 snapshot dueDate=2026-12-31, got %+v", withDue)
	}
	withoutDue, ok := issues["PROJ-2"].(map[string]any)
	if !ok {
		t.Fatalf("expected PROJ-2 snapshot, got %+v", issues["PROJ-2"])
	}
	if _, has := withoutDue["dueDate"]; has {
		t.Fatalf("expected no dueDate key when the Jira issue has none, got %+v", withoutDue)
	}
}

func TestRefreshQuarterFromJira_SurfacesSprintsOnTheSnapshotWhenPresent(t *testing.T) {
	sprintStart := time.Date(2026, 8, 31, 9, 0, 0, 0, time.UTC)
	sprintEnd := time.Date(2026, 9, 14, 9, 0, 0, 0, time.UTC)
	jira := &fakeJira{byKey: map[string]jirasource.Issue{
		"PROJ-1": {
			Key:            "PROJ-1",
			StatusCategory: "done",
			Sprints: []jirasource.Sprint{
				{Name: "OG Sprint 41", StartDate: &sprintStart, EndDate: &sprintEnd},
				{Name: "OG Sprint 42"},
			},
		},
		"PROJ-2": {Key: "PROJ-2", StatusCategory: "indeterminate"},
	}}
	quarter := milestoneQuarter([]string{"PROJ-1", "PROJ-2"})
	now := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)

	if _, err := okr.RefreshQuarterFromJira(context.Background(), jira, quarter, now); err != nil {
		t.Fatalf("RefreshQuarterFromJira: %v", err)
	}

	milestone := milestoneOf(quarter)
	issues, ok := milestone["jiraIssues"].(map[string]any)
	if !ok {
		t.Fatalf("expected jiraIssues map, got %+v", milestone["jiraIssues"])
	}
	withSprints, ok := issues["PROJ-1"].(map[string]any)
	if !ok {
		t.Fatalf("expected PROJ-1 snapshot, got %+v", issues["PROJ-1"])
	}
	sprints, ok := withSprints["sprints"].([]map[string]any)
	if !ok || len(sprints) != 2 {
		t.Fatalf("expected 2 sprints on PROJ-1 snapshot, got %+v", withSprints["sprints"])
	}
	if sprints[0]["name"] != "OG Sprint 41" || sprints[0]["startDate"] != "2026-08-31" || sprints[0]["endDate"] != "2026-09-14" {
		t.Fatalf("expected first sprint fully dated, got %+v", sprints[0])
	}
	if sprints[1]["name"] != "OG Sprint 42" {
		t.Fatalf("expected second sprint name, got %+v", sprints[1])
	}
	if _, has := sprints[1]["startDate"]; has {
		t.Fatalf("expected no startDate key for a sprint with no dates yet, got %+v", sprints[1])
	}

	withoutSprints, ok := issues["PROJ-2"].(map[string]any)
	if !ok {
		t.Fatalf("expected PROJ-2 snapshot, got %+v", issues["PROJ-2"])
	}
	if _, has := withoutSprints["sprints"]; has {
		t.Fatalf("expected no sprints key when the Jira issue has none, got %+v", withoutSprints)
	}
}

func TestRefreshQuarterFromJira_ChildWorkItemRollupTakesPrecedenceForSingleIssue(t *testing.T) {
	jira := &fakeJira{
		byKey: map[string]jirasource.Issue{
			"PROJ-1": {Key: "PROJ-1", StatusCategory: "indeterminate"},
		},
		childrenByKey: map[string][]jirasource.ChildIssue{
			"PROJ-1": {
				{Created: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC), Resolved: timePtr(time.Date(2026, 1, 2, 0, 0, 0, 0, time.UTC))},
				{Created: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)},
			},
		},
	}
	quarter := milestoneQuarter([]string{"PROJ-1"})
	now := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)

	if _, err := okr.RefreshQuarterFromJira(context.Background(), jira, quarter, now); err != nil {
		t.Fatalf("RefreshQuarterFromJira: %v", err)
	}

	milestone := milestoneOf(quarter)
	if milestone["progress"] != 50 {
		t.Fatalf("expected child rollup progress=50 (1 of 2 done), got %v", milestone["progress"])
	}
}

func TestRefreshQuarterFromJira_ClosedQuarterFreezesProgressAsOfQuarterEnd(t *testing.T) {
	jira := &fakeJira{byKey: map[string]jirasource.Issue{
		"PROJ-1": {
			Key:     "PROJ-1",
			Created: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
			DoneAt:  timePtr(time.Date(2026, 4, 15, 0, 0, 0, 0, time.UTC)),
		},
	}}
	quarter := milestoneQuarter([]string{"PROJ-1"})
	quarter["endDate"] = "2026-03-31"
	now := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)

	asOf, err := okr.RefreshQuarterFromJira(context.Background(), jira, quarter, now)
	if err != nil {
		t.Fatalf("RefreshQuarterFromJira: %v", err)
	}
	wantAsOf := time.Date(2026, 3, 31, 23, 59, 59, int(time.Second-time.Nanosecond), time.UTC)
	if !asOf.Equal(wantAsOf) {
		t.Fatalf("asOf = %v, want %v", asOf, wantAsOf)
	}

	milestone := milestoneOf(quarter)
	if milestone["status"] == "done" {
		t.Fatalf("expected the issue's DoneAt (after quarter end) to NOT count as done as-of the frozen quarter end, got status=%v", milestone["status"])
	}
}

func TestRefreshQuarterFromJira_NoLinkedIssuesMakesNoJiraCalls(t *testing.T) {
	jira := &fakeJira{byKey: map[string]jirasource.Issue{}}
	quarter := milestoneQuarter(nil)
	now := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)

	if _, err := okr.RefreshQuarterFromJira(context.Background(), jira, quarter, now); err != nil {
		t.Fatalf("RefreshQuarterFromJira: %v", err)
	}
	if jira.getIssuesByKeys != 0 || jira.getChildIssues != 0 {
		t.Fatalf("expected no Jira calls when no jiraKeys are present, got GetIssuesByKeys=%d GetChildIssues=%d", jira.getIssuesByKeys, jira.getChildIssues)
	}
}

func twoMilestoneQuarter() map[string]any {
	return map[string]any{
		"quarterId": "2026-q1",
		"objectives": []any{
			map[string]any{
				"id": "O-1",
				"children": []any{
					map[string]any{
						"id":       "O-1-M1",
						"jiraKeys": toAnySlice([]string{"PROJ-1"}),
					},
					map[string]any{
						"id":       "O-1-M2",
						"jiraKeys": toAnySlice([]string{"PROJ-2"}),
					},
				},
			},
		},
	}
}

func nodeByID(quarter map[string]any, id string) map[string]any {
	for _, child := range quarter["objectives"].([]any)[0].(map[string]any)["children"].([]any) {
		node := child.(map[string]any)
		if node["id"] == id {
			return node
		}
	}
	return nil
}

func TestRefreshNodeFromJira_OnlyTouchesTheTargetNode(t *testing.T) {
	jira := &fakeJira{byKey: map[string]jirasource.Issue{
		"PROJ-1": {Key: "PROJ-1", StatusCategory: "done"},
		"PROJ-2": {Key: "PROJ-2", StatusCategory: "done"},
	}}
	quarter := twoMilestoneQuarter()
	now := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)

	found, err := okr.RefreshNodeFromJira(context.Background(), jira, quarter, "O-1-M1", now)
	if err != nil {
		t.Fatalf("RefreshNodeFromJira: %v", err)
	}
	if !found {
		t.Fatal("expected the node to be found")
	}

	m1 := nodeByID(quarter, "O-1-M1")
	if m1["progress"] != 100 {
		t.Fatalf("expected the linked node's own progress to be refreshed, got %v", m1["progress"])
	}
	m2 := nodeByID(quarter, "O-1-M2")
	if _, has := m2["progress"]; has {
		t.Fatalf("expected the sibling node to be left untouched, got %+v", m2)
	}
	if jira.getIssuesByKeys != 1 {
		t.Fatalf("expected exactly one GetIssuesByKeys call scoped to the target node, got %d", jira.getIssuesByKeys)
	}
	if jira.getChildIssues != 1 {
		t.Fatalf("expected exactly one GetChildIssues call (for PROJ-1 only), got %d", jira.getChildIssues)
	}
}

func TestRefreshNodeFromJira_NodeNotFound_ReturnsFalseNoError(t *testing.T) {
	jira := &fakeJira{}
	quarter := twoMilestoneQuarter()
	now := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)

	found, err := okr.RefreshNodeFromJira(context.Background(), jira, quarter, "does-not-exist", now)
	if err != nil {
		t.Fatalf("RefreshNodeFromJira: %v", err)
	}
	if found {
		t.Fatal("expected found=false for a missing node id")
	}
	if jira.getIssuesByKeys != 0 {
		t.Fatalf("expected no Jira calls for a missing node, got %d", jira.getIssuesByKeys)
	}
}

func TestRefreshNodeFromJira_NodeWithNoJiraKeys_NoOp(t *testing.T) {
	jira := &fakeJira{}
	quarter := milestoneQuarter(nil)
	now := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)

	found, err := okr.RefreshNodeFromJira(context.Background(), jira, quarter, "O-1-M1", now)
	if err != nil {
		t.Fatalf("RefreshNodeFromJira: %v", err)
	}
	if !found {
		t.Fatal("expected found=true even with no jiraKeys")
	}
	if jira.getIssuesByKeys != 0 {
		t.Fatalf("expected no Jira calls when the node has no jiraKeys, got %d", jira.getIssuesByKeys)
	}
	milestone := milestoneOf(quarter)
	if _, has := milestone["updates"]; has {
		t.Fatalf("expected no history entry logged for a node that was never linked, got %+v", milestone["updates"])
	}
}

func TestRefreshNodeFromJira_UnlinkingTheLastIssue_ClearsStaleJiraIssuesAndCallsNoJiraAPIs(t *testing.T) {
	jira := &fakeJira{byKey: map[string]jirasource.Issue{
		"PROJ-1": {Key: "PROJ-1", StatusCategory: "indeterminate"},
	}}
	quarter := milestoneQuarter([]string{"PROJ-1"})
	now := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)
	if _, err := okr.RefreshNodeFromJira(context.Background(), jira, quarter, "O-1-M1", now); err != nil {
		t.Fatalf("initial RefreshNodeFromJira: %v", err)
	}
	milestone := milestoneOf(quarter)
	if milestone["jiraIssues"] == nil {
		t.Fatalf("expected jiraIssues to be populated before unlinking, got %+v", milestone)
	}

	milestone["jiraKeys"] = []any{}
	jira.getIssuesByKeys = 0
	jira.getChildIssues = 0

	found, err := okr.RefreshNodeFromJira(context.Background(), jira, quarter, "O-1-M1", now)
	if err != nil {
		t.Fatalf("RefreshNodeFromJira after unlinking: %v", err)
	}
	if !found {
		t.Fatal("expected found=true")
	}
	if jira.getIssuesByKeys != 0 || jira.getChildIssues != 0 {
		t.Fatalf("expected no Jira calls after unlinking the last issue, got GetIssuesByKeys=%d GetChildIssues=%d", jira.getIssuesByKeys, jira.getChildIssues)
	}
	if _, has := milestone["jiraIssues"]; has {
		t.Fatalf("expected stale jiraIssues to be cleared after unlinking, got %+v", milestone["jiraIssues"])
	}
	updates, ok := milestone["updates"].([]any)
	if !ok || len(updates) == 0 {
		t.Fatalf("expected a status-change entry logging the unlink, got %+v", milestone["updates"])
	}
	last := updates[len(updates)-1].(map[string]any)
	if last["note"] != "Unlinked from Jira" || last["author"] != "Jira sync" {
		t.Fatalf("expected the last history entry to log the unlink, got %+v", last)
	}
}

func TestRefreshNodeFromJira_UnlinkingOneOfSeveral_RecalculatesFromTheRemaining(t *testing.T) {
	jira := &fakeJira{byKey: map[string]jirasource.Issue{
		"PROJ-1": {Key: "PROJ-1", StatusCategory: "done"},
		"PROJ-2": {Key: "PROJ-2", StatusCategory: "new"},
	}}
	quarter := milestoneQuarter([]string{"PROJ-1", "PROJ-2"})
	now := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)
	if _, err := okr.RefreshNodeFromJira(context.Background(), jira, quarter, "O-1-M1", now); err != nil {
		t.Fatalf("initial RefreshNodeFromJira: %v", err)
	}
	milestone := milestoneOf(quarter)
	if milestone["progress"] != 50 {
		t.Fatalf("expected progress=50 (1 done + 1 to-do of 2 issues), got %v", milestone["progress"])
	}

	milestone["jiraKeys"] = []any{"PROJ-1"}

	if _, err := okr.RefreshNodeFromJira(context.Background(), jira, quarter, "O-1-M1", now); err != nil {
		t.Fatalf("RefreshNodeFromJira after unlinking PROJ-2: %v", err)
	}
	if milestone["progress"] != 100 {
		t.Fatalf("expected progress=100 (only PROJ-1, done, remains), got %v", milestone["progress"])
	}
	issues, ok := milestone["jiraIssues"].(map[string]any)
	if !ok || len(issues) != 1 {
		t.Fatalf("expected jiraIssues to contain only the remaining PROJ-1, got %+v", milestone["jiraIssues"])
	}
	if _, has := issues["PROJ-2"]; has {
		t.Fatalf("expected the unlinked PROJ-2 snapshot to be gone, got %+v", issues)
	}
}

func TestIsRefreshFresh(t *testing.T) {
	now := time.Date(2026, 2, 1, 12, 0, 0, 0, time.UTC)
	cases := []struct {
		name string
		v    any
		want bool
	}{
		{"within TTL", now.Add(-1 * time.Hour).Format(time.RFC3339), true},
		{"past TTL", now.Add(-25 * time.Hour).Format(time.RFC3339), false},
		{"missing", nil, false},
		{"empty string", "", false},
		{"unparseable", "not-a-time", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := okr.IsRefreshFresh(tc.v, now); got != tc.want {
				t.Errorf("IsRefreshFresh(%v) = %v, want %v", tc.v, got, tc.want)
			}
		})
	}
}

func timePtr(t time.Time) *time.Time { return &t }
