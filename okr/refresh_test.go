package okr_test

import (
	"context"
	"testing"
	"time"

	"github.com/helmedeiros/quartermark/okr"
	"github.com/helmedeiros/quartermark/okr/tracker"
	"github.com/helmedeiros/quartermark/shared/timewindow"
)

type fakeTracker struct {
	byKey           map[string]tracker.Issue
	childrenByKey   map[string][]tracker.ChildIssue
	getIssuesByKeys int
	getChildIssues  int
}

func (f *fakeTracker) SearchIssuesByAssignee(context.Context, string, timewindow.Window) ([]tracker.Issue, error) {
	return nil, nil
}

func (f *fakeTracker) GetIssuesByKeys(_ context.Context, keys []string) ([]tracker.Issue, error) {
	f.getIssuesByKeys++
	out := make([]tracker.Issue, 0, len(keys))
	for _, k := range keys {
		if issue, ok := f.byKey[k]; ok {
			out = append(out, issue)
		}
	}
	return out, nil
}

func (f *fakeTracker) GetChildIssues(_ context.Context, key string) ([]tracker.ChildIssue, error) {
	f.getChildIssues++
	return f.childrenByKey[key], nil
}

func (f *fakeTracker) SearchIssuesByText(context.Context, string, int) ([]tracker.IssueSummary, error) {
	return nil, nil
}

func timePtr(t time.Time) *time.Time { return &t }

func milestoneQuarter(t *testing.T, keys ...string) okr.Quarter {
	t.Helper()
	milestone := node(t, "O-1-M1", okr.Milestone)
	milestone.TrackerKeys = keys
	return quarter(t, "2026-q1", node(t, "O-1", okr.Objective, milestone))
}

func onlyMilestone(q okr.Quarter) *okr.Node { return &q.Objectives[0].Children[0] }

func refresh(t *testing.T, tracker *fakeTracker, q *okr.Quarter, now time.Time) time.Time {
	t.Helper()
	asOf, err := okr.RefreshQuarter(context.Background(), tracker, q, now)
	if err != nil {
		t.Fatalf("RefreshQuarter: %v", err)
	}
	return asOf
}

func TestProgressComesFromTheStatusOfEveryLinkedIssue(t *testing.T) {
	tracker := &fakeTracker{byKey: map[string]tracker.Issue{
		"PROJ-1": {Key: "PROJ-1", StatusCategory: "done"},
		"PROJ-2": {Key: "PROJ-2", StatusCategory: "indeterminate"},
	}}
	q := milestoneQuarter(t, "PROJ-1", "PROJ-2")

	refresh(t, tracker, &q, time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC))

	milestone := onlyMilestone(q)
	if milestone.Progress.Int() != 75 {
		t.Fatalf("progress = %d, want 75 for one done and one in progress", milestone.Progress.Int())
	}
	if milestone.Status != okr.OnTrack {
		t.Fatalf("status = %s, want on_track", milestone.Status)
	}
}

func TestADueDateReachesTheSnapshotOnlyWhenTheIssueHasOne(t *testing.T) {
	due := time.Date(2026, 12, 31, 0, 0, 0, 0, time.UTC)
	tracker := &fakeTracker{byKey: map[string]tracker.Issue{
		"PROJ-1": {Key: "PROJ-1", StatusCategory: "done", DueDate: &due},
		"PROJ-2": {Key: "PROJ-2", StatusCategory: "indeterminate"},
	}}
	q := milestoneQuarter(t, "PROJ-1", "PROJ-2")

	refresh(t, tracker, &q, time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC))

	snapshots := onlyMilestone(q).TrackerSnapshots
	if got := snapshots["PROJ-1"].Due.String(); got != "2026-12-31" {
		t.Fatalf("due = %q, want 2026-12-31", got)
	}
	if got := snapshots["PROJ-2"].Due; !got.IsZero() {
		t.Fatalf("an issue with no due date should have none, got %q", got)
	}
}

func TestSprintsReachTheSnapshotWithWhicheverDatesTheyHave(t *testing.T) {
	start := time.Date(2026, 8, 31, 9, 0, 0, 0, time.UTC)
	end := time.Date(2026, 9, 14, 9, 0, 0, 0, time.UTC)
	tracker := &fakeTracker{byKey: map[string]tracker.Issue{
		"PROJ-1": {Key: "PROJ-1", StatusCategory: "done", Sprints: []tracker.Sprint{
			{Name: "Sprint 41", StartDate: &start, EndDate: &end},
			{Name: "Sprint 42"},
		}},
	}}
	q := milestoneQuarter(t, "PROJ-1")

	refresh(t, tracker, &q, time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC))

	sprints := onlyMilestone(q).TrackerSnapshots["PROJ-1"].Sprints
	if len(sprints) != 2 {
		t.Fatalf("want 2 sprints, got %d", len(sprints))
	}
	if sprints[0].Start.String() != "2026-08-31" || sprints[0].End.String() != "2026-09-14" {
		t.Fatalf("dated sprint came through wrong: %+v", sprints[0])
	}
	if !sprints[1].Start.IsZero() || !sprints[1].End.IsZero() {
		t.Fatalf("an undated sprint should stay undated: %+v", sprints[1])
	}
}

func TestOneIssueTakesItsProgressFromItsChildWorkItems(t *testing.T) {
	created := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	resolved := time.Date(2026, 1, 15, 0, 0, 0, 0, time.UTC)
	tracker := &fakeTracker{
		byKey: map[string]tracker.Issue{"PROJ-1": {Key: "PROJ-1", StatusCategory: "indeterminate"}},
		childrenByKey: map[string][]tracker.ChildIssue{"PROJ-1": {
			{Created: created, Resolved: &resolved},
			{Created: created},
			{Created: created},
			{Created: created},
		}},
	}
	q := milestoneQuarter(t, "PROJ-1")

	refresh(t, tracker, &q, time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC))

	if got := onlyMilestone(q).Progress.Int(); got != 25 {
		t.Fatalf("progress = %d, want 25 from one of four children resolved", got)
	}
}

func TestAClosedQuarterIsReadAsOfItsEndNotNow(t *testing.T) {
	tracker := &fakeTracker{byKey: map[string]tracker.Issue{
		"PROJ-1": {
			Key:     "PROJ-1",
			Created: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
			DoneAt:  timePtr(time.Date(2026, 4, 15, 0, 0, 0, 0, time.UTC)),
		},
	}}
	q := milestoneQuarter(t, "PROJ-1")
	q.End, _ = okr.ParseDate("2026-03-31")

	asOf := refresh(t, tracker, &q, time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC))

	want := time.Date(2026, 3, 31, 23, 59, 59, int(time.Second-time.Nanosecond), time.UTC)
	if !asOf.Equal(want) {
		t.Fatalf("asOf = %v, want the end of the quarter's last day %v", asOf, want)
	}
	if got := onlyMilestone(q).Status; got == okr.Done {
		t.Fatal("work finished after the quarter closed should not make it done in that quarter")
	}
}

func TestAQuarterWithNothingLinkedTouchesTheTracker(t *testing.T) {
	tracker := &fakeTracker{byKey: map[string]tracker.Issue{}}
	q := milestoneQuarter(t)

	refresh(t, tracker, &q, time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC))

	if tracker.getIssuesByKeys != 0 || tracker.getChildIssues != 0 {
		t.Fatalf("no links means no calls, got %d issue and %d child calls",
			tracker.getIssuesByKeys, tracker.getChildIssues)
	}
}

func twoMilestoneQuarter(t *testing.T) okr.Quarter {
	t.Helper()
	first := node(t, "O-1-M1", okr.Milestone)
	first.TrackerKeys = []string{"PROJ-1"}
	second := node(t, "O-1-M2", okr.Milestone)
	second.TrackerKeys = []string{"PROJ-2"}
	return quarter(t, "2026-q1", node(t, "O-1", okr.Objective, first, second))
}

func TestRefreshingOneNodeLeavesTheOthersAlone(t *testing.T) {
	tracker := &fakeTracker{byKey: map[string]tracker.Issue{
		"PROJ-1": {Key: "PROJ-1", StatusCategory: "done"},
		"PROJ-2": {Key: "PROJ-2", StatusCategory: "done"},
	}}
	q := twoMilestoneQuarter(t)

	found, err := okr.RefreshNode(context.Background(), tracker, &q, "O-1-M1",
		time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC))
	if err != nil || !found {
		t.Fatalf("RefreshNode: found=%v err=%v", found, err)
	}

	if got := q.Objectives[0].Children[0].Progress.Int(); got != 100 {
		t.Fatalf("the target node should be refreshed, progress = %d", got)
	}
	if got := q.Objectives[0].Children[1].Progress.Int(); got != 0 {
		t.Fatalf("an untargeted node should be untouched, progress = %d", got)
	}
}

func TestRefreshingAnUnknownNodeIsNotAnError(t *testing.T) {
	q := twoMilestoneQuarter(t)

	found, err := okr.RefreshNode(context.Background(), &fakeTracker{}, &q, "nope", time.Now())
	if err != nil {
		t.Fatalf("an unknown node is not an error: %v", err)
	}
	if found {
		t.Error("found should be false for a node that is not there")
	}
}

func TestRefreshingANodeWithNoLinksTouchesTheTracker(t *testing.T) {
	tracker := &fakeTracker{}
	q := milestoneQuarter(t)

	found, err := okr.RefreshNode(context.Background(), tracker, &q, "O-1-M1", time.Now())
	if err != nil || !found {
		t.Fatalf("RefreshNode: found=%v err=%v", found, err)
	}
	if tracker.getIssuesByKeys != 0 || tracker.getChildIssues != 0 {
		t.Fatal("a node with no links should cause no tracker calls")
	}
}

func TestUnlinkingTheLastIssueClearsTheStaleSnapshotAndRecordsIt(t *testing.T) {
	tracker := &fakeTracker{}
	q := milestoneQuarter(t)
	milestone := &q.Objectives[0].Children[0]
	milestone.TrackerSnapshots = map[string]okr.TrackerSnapshot{
		"PROJ-1": {Key: "PROJ-1", Summary: "stale"},
	}

	found, err := okr.RefreshNode(context.Background(), tracker, &q, "O-1-M1",
		time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC))
	if err != nil || !found {
		t.Fatalf("RefreshNode: found=%v err=%v", found, err)
	}

	if len(milestone.TrackerSnapshots) != 0 {
		t.Fatalf("the stale snapshot should be gone, got %+v", milestone.TrackerSnapshots)
	}
	if len(milestone.Updates) != 1 || milestone.Updates[0].Note != "Unlinked from Jira" {
		t.Fatalf("unlinking should be recorded in the history, got %+v", milestone.Updates)
	}
	if tracker.getIssuesByKeys != 0 {
		t.Error("unlinking should not call the tracker")
	}
}

func TestUnlinkingOneOfSeveralRecalculatesFromWhatRemains(t *testing.T) {
	tracker := &fakeTracker{byKey: map[string]tracker.Issue{
		"PROJ-1": {Key: "PROJ-1", StatusCategory: "done"},
	}}
	q := milestoneQuarter(t, "PROJ-1")
	milestone := &q.Objectives[0].Children[0]
	milestone.TrackerSnapshots = map[string]okr.TrackerSnapshot{
		"PROJ-1": {Key: "PROJ-1"},
		"PROJ-2": {Key: "PROJ-2", Summary: "no longer linked"},
	}

	if _, err := okr.RefreshNode(context.Background(), tracker, &q, "O-1-M1",
		time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)); err != nil {
		t.Fatalf("RefreshNode: %v", err)
	}

	if _, stale := milestone.TrackerSnapshots["PROJ-2"]; stale {
		t.Error("the unlinked issue's snapshot should be gone")
	}
	if milestone.Progress.Int() != 100 {
		t.Fatalf("progress should come from what remains, got %d", milestone.Progress.Int())
	}
}

func TestRefreshFreshness(t *testing.T) {
	now := time.Date(2026, 2, 1, 12, 0, 0, 0, time.UTC)

	if okr.IsRefreshFresh(time.Time{}, now) {
		t.Error("a quarter never refreshed is not fresh")
	}
	if !okr.IsRefreshFresh(now.Add(-time.Hour), now) {
		t.Error("an hour ago is fresh")
	}
	if okr.IsRefreshFresh(now.Add(-okr.RefreshTTL-time.Minute), now) {
		t.Error("older than the window is not fresh")
	}
}
