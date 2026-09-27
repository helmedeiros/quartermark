package sqlite_test

import (
	"context"
	"encoding/json"
	"path/filepath"
	"testing"

	"github.com/helmedeiros/quartermark/adapters/sqlite"
	"github.com/helmedeiros/quartermark/okr"
)

func planStore(t *testing.T) *sqlite.Store {
	t.Helper()
	s, err := sqlite.Open(filepath.Join(t.TempDir(), "plans.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = s.Close() })
	return s
}

const storedPlan = `{
  "schemaVersion": 1,
  "team": "Atlas",
  "unmodelledTopLevel": "keep me",
  "quarters": [{
    "quarterId": "2027-q1", "label": "Q1 2027",
    "objectives": [{
      "id": "O-1", "type": "objective", "title": "Ship it",
      "status": "on_track", "progress": 40,
      "unmodelledOnANode": [1, 2],
      "children": [{
        "id": "KR-1", "type": "key_result", "title": "Faster",
        "status": "on_track", "progress": 10
      }]
    }]
  }]
}`

func TestLoadReadsThePlanAsDomainObjects(t *testing.T) {
	s, ctx := planStore(t), context.Background()
	if err := s.PutTeamBlob(ctx, "atlas", "okrs", []byte(storedPlan)); err != nil {
		t.Fatal(err)
	}

	plan, ok, err := s.Load(ctx, "atlas")
	if err != nil || !ok {
		t.Fatalf("Load: ok=%v err=%v", ok, err)
	}
	if plan.Team != "Atlas" || len(plan.Quarters) != 1 {
		t.Fatalf("plan read wrong: %+v", plan)
	}
	if got := plan.Quarters[0].Objectives[0].Children[0].Progress.Int(); got != 10 {
		t.Errorf("nested progress = %d, want 10", got)
	}
}

func TestLoadReportsAbsenceRatherThanAnError(t *testing.T) {
	_, ok, err := planStore(t).Load(context.Background(), "nobody")
	if err != nil {
		t.Fatalf("a team with no plan is not an error: %v", err)
	}
	if ok {
		t.Error("ok should be false when there is no plan")
	}
}

// The reason Save reads before it writes: the document holds things the
// model does not, and writing from scratch would drop them.
func TestSaveKeepsWhatTheModelDoesNotDescribe(t *testing.T) {
	s, ctx := planStore(t), context.Background()
	if err := s.PutTeamBlob(ctx, "atlas", "okrs", []byte(storedPlan)); err != nil {
		t.Fatal(err)
	}

	plan, _, err := s.Load(ctx, "atlas")
	if err != nil {
		t.Fatal(err)
	}
	plan.Quarters[0].Objectives[0].Children[0].Status = okr.Done
	if err := s.Save(ctx, "atlas", plan); err != nil {
		t.Fatalf("Save: %v", err)
	}

	raw, _, err := s.GetTeamBlob(ctx, "atlas", "okrs")
	if err != nil {
		t.Fatal(err)
	}
	var got map[string]any
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatal(err)
	}
	if got["unmodelledTopLevel"] != "keep me" {
		t.Error("a top-level member the model does not describe was dropped")
	}
	objective := got["quarters"].([]any)[0].(map[string]any)["objectives"].([]any)[0].(map[string]any)
	if objective["unmodelledOnANode"] == nil {
		t.Error("a node member the model does not describe was dropped")
	}
	if objective["children"].([]any)[0].(map[string]any)["status"] != "done" {
		t.Error("the change did not land")
	}
}

// An invalid plan must not reach storage, or the next read fails and
// the team cannot open their own quarter.
func TestSaveRefusesAnInvalidPlan(t *testing.T) {
	s, ctx := planStore(t), context.Background()
	if err := s.PutTeamBlob(ctx, "atlas", "okrs", []byte(storedPlan)); err != nil {
		t.Fatal(err)
	}

	plan, _, err := s.Load(ctx, "atlas")
	if err != nil {
		t.Fatal(err)
	}
	// Two nodes with one id: an edit would land on whichever is found
	// first.
	plan.Quarters[0].Objectives[0].Children[0].ID = "O-1"

	if err := s.Save(ctx, "atlas", plan); err == nil {
		t.Fatal("an invalid plan should be refused")
	}
}

func TestSaveRefusesATeamWithNoPlanYet(t *testing.T) {
	err := planStore(t).Save(context.Background(), "nobody", okr.TeamOkrs{})
	if err == nil {
		t.Fatal("saving over a plan that does not exist should be an error")
	}
}
