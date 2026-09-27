package okr_test

import (
	"strings"
	"testing"

	"github.com/helmedeiros/quartermark/okr"
)

func quarter(t *testing.T, id string, objectives ...okr.Node) okr.Quarter {
	t.Helper()
	q, err := okr.NewQuarter(id, "Label of "+id)
	if err != nil {
		t.Fatalf("NewQuarter(%s): %v", id, err)
	}
	q.Objectives = objectives
	return q
}

func TestNewQuarterRequiresAnIdAndALabel(t *testing.T) {
	if _, err := okr.NewQuarter("", "Q1 2027"); err == nil {
		t.Error("a quarter without an id should be rejected")
	}
	if _, err := okr.NewQuarter("2027-q1", ""); err == nil {
		t.Error("a quarter without a label should be rejected")
	}
}

func TestQuarterRejectsAnEndBeforeItsStart(t *testing.T) {
	q := quarter(t, "2027-q1")
	q.Start, _ = okr.ParseDate("2027-03-31")
	q.End, _ = okr.ParseDate("2027-01-04")

	if err := q.Validate(); err == nil {
		t.Fatal("a quarter ending before it starts should be rejected")
	}
}

func TestQuarterAllowsDatesToBeUnset(t *testing.T) {
	// A quarter being sketched has no dates yet, and that is a normal
	// state rather than an invalid one.
	if err := quarter(t, "2027-q2").Validate(); err != nil {
		t.Fatalf("a quarter with no dates should validate: %v", err)
	}
}

func TestQuarterRejectsANonObjectiveAtTheTopLevel(t *testing.T) {
	q := quarter(t, "2027-q1", node(t, "KR-1", okr.KeyResult))

	err := q.Validate()
	if err == nil {
		t.Fatal("a key result at the top level should be rejected")
	}
	if !strings.Contains(err.Error(), "KR-1") {
		t.Errorf("the error should name the offending node, got %q", err)
	}
}

// A URL names a node without saying which objective it sits under, and
// the tracker link map is keyed the same way — so uniqueness has to hold
// across the whole quarter, not merely within one tree.
func TestQuarterRejectsIdsReusedAcrossObjectives(t *testing.T) {
	q := quarter(t, "2027-q1",
		node(t, "O-1", okr.Objective, node(t, "KR-1", okr.KeyResult)),
		node(t, "O-2", okr.Objective, node(t, "KR-1", okr.KeyResult)),
	)

	err := q.Validate()
	if err == nil {
		t.Fatal("an id reused across objectives should be rejected")
	}
	if !strings.Contains(err.Error(), "KR-1") {
		t.Errorf("the error should name the duplicate, got %q", err)
	}
}

func TestQuarterWalkAndFindReachEveryObjective(t *testing.T) {
	q := quarter(t, "2027-q1",
		node(t, "O-1", okr.Objective, node(t, "KR-1", okr.KeyResult)),
		node(t, "O-2", okr.Objective),
	)

	var visited int
	q.Walk(func(*okr.Node) { visited++ })
	if visited != 3 {
		t.Errorf("walked %d nodes, want 3", visited)
	}
	if got := q.Find("KR-1"); got == nil {
		t.Error("Find should reach a node nested under the second level")
	}
	if got := q.Find("nope"); got != nil {
		t.Error("Find should return nil for an unknown id")
	}
}

func TestTeamOkrsRejectsDuplicateQuarters(t *testing.T) {
	team := okr.TeamOkrs{
		Team:     "Atlas",
		Quarters: []okr.Quarter{quarter(t, "2027-q1"), quarter(t, "2027-q1")},
	}

	if err := team.Validate(); err == nil {
		t.Fatal("two quarters with the same id should be rejected")
	}
}

// Ids only have to be unique within a quarter: the same objective id
// recurring in a later quarter is how a continuing bet is expressed.
func TestTeamOkrsAllowsIdsToRecurAcrossQuarters(t *testing.T) {
	team := okr.TeamOkrs{
		Team: "Atlas",
		Quarters: []okr.Quarter{
			quarter(t, "2026-q4", node(t, "O-1", okr.Objective)),
			quarter(t, "2027-q1", node(t, "O-1", okr.Objective)),
		},
	}

	if err := team.Validate(); err != nil {
		t.Fatalf("the same id in two quarters should be allowed: %v", err)
	}
}

func TestTeamOkrsFindsAQuarterById(t *testing.T) {
	team := okr.TeamOkrs{Quarters: []okr.Quarter{quarter(t, "2026-q4"), quarter(t, "2027-q1")}}

	if got := team.Quarter("2027-q1"); got == nil || got.ID != "2027-q1" {
		t.Errorf("Quarter() should find it, got %v", got)
	}
	if got := team.Quarter("2030-q1"); got != nil {
		t.Error("Quarter() should return nil for an unknown id")
	}
}
