package okr_test

import (
	"strings"
	"testing"

	"github.com/helmedeiros/quartermark/okr"
)

func node(t *testing.T, id string, nt okr.NodeType, children ...okr.Node) okr.Node {
	t.Helper()
	n, err := okr.NewNode(id, nt, "title of "+id, okr.OnTrack)
	if err != nil {
		t.Fatalf("NewNode(%s): %v", id, err)
	}
	n.Children = children
	return n
}

func TestNewNodeRequiresWhatNothingIsValidWithout(t *testing.T) {
	if _, err := okr.NewNode("", okr.Objective, "Ship it", okr.OnTrack); err == nil {
		t.Error("a node without an id should be rejected")
	}
	if _, err := okr.NewNode("O-1", okr.Objective, "", okr.OnTrack); err == nil {
		t.Error("a node without a title should be rejected")
	}
	if _, err := okr.NewNode("O-1", "epic", "Ship it", okr.OnTrack); err == nil {
		t.Error("an unknown node type should be rejected")
	}
	if _, err := okr.NewNode("O-1", okr.Objective, "Ship it", "in_progress"); err == nil {
		t.Error("an unknown status should be rejected")
	}
}

func TestValidateRejectsDuplicateIdsAnywhereInTheTree(t *testing.T) {
	tree := node(t, "O-1", okr.Objective,
		node(t, "KR-1", okr.KeyResult,
			node(t, "M-1", okr.Milestone),
		),
		node(t, "KR-2", okr.KeyResult,
			node(t, "M-1", okr.Milestone), // same id, different branch
		),
	)

	err := tree.Validate()
	if err == nil {
		t.Fatal("a duplicate id should be rejected")
	}
	if !strings.Contains(err.Error(), "M-1") {
		t.Errorf("the error should name the duplicate, got %q", err)
	}
}

func TestValidateRejectsAnIllegalParentChildPair(t *testing.T) {
	tree := node(t, "O-1", okr.Objective,
		node(t, "M-1", okr.Milestone,
			node(t, "KR-1", okr.KeyResult),
		),
	)

	err := tree.Validate()
	if err == nil {
		t.Fatal("a key result under a milestone should be rejected")
	}
	if !strings.Contains(err.Error(), "KR-1") {
		t.Errorf("the error should name the offending node, got %q", err)
	}
}

func TestValidateAcceptsSubObjectivesAndBareMilestones(t *testing.T) {
	tree := node(t, "O-1", okr.Objective,
		node(t, "O-1a", okr.Objective,
			node(t, "KR-1", okr.KeyResult),
		),
		node(t, "M-1", okr.Milestone),
	)

	if err := tree.Validate(); err != nil {
		t.Fatalf("this is a shape real plans have: %v", err)
	}
}

func TestValidateAcceptsTheRealShape(t *testing.T) {
	tree := node(t, "O-1", okr.Objective,
		node(t, "KR-1", okr.KeyResult,
			node(t, "M-1", okr.Milestone),
			node(t, "M-2", okr.Milestone),
		),
		node(t, "KR-2", okr.KeyResult),
	)

	if err := tree.Validate(); err != nil {
		t.Fatalf("a legal tree should validate: %v", err)
	}
}

func TestWalkVisitsEveryNodeOnce(t *testing.T) {
	tree := node(t, "O-1", okr.Objective,
		node(t, "KR-1", okr.KeyResult,
			node(t, "M-1", okr.Milestone),
		),
		node(t, "KR-2", okr.KeyResult),
	)

	seen := map[string]int{}
	tree.Walk(func(n *okr.Node) { seen[n.ID]++ })

	for _, id := range []string{"O-1", "KR-1", "M-1", "KR-2"} {
		if seen[id] != 1 {
			t.Errorf("%s visited %d times, want 1", id, seen[id])
		}
	}
	if len(seen) != 4 {
		t.Errorf("visited %d distinct nodes, want 4", len(seen))
	}
}

func TestWalkExposesNodesForMutation(t *testing.T) {
	tree := node(t, "O-1", okr.Objective,
		node(t, "KR-1", okr.KeyResult),
	)

	tree.Walk(func(n *okr.Node) { n.Status = okr.Done })

	if tree.Status != okr.Done || tree.Children[0].Status != okr.Done {
		t.Error("changes made during a walk should stick")
	}
}

func TestFindReturnsTheNodeOrNil(t *testing.T) {
	tree := node(t, "O-1", okr.Objective,
		node(t, "KR-1", okr.KeyResult,
			node(t, "M-1", okr.Milestone),
		),
	)

	if got := tree.Find("M-1"); got == nil || got.ID != "M-1" {
		t.Errorf("Find should reach a leaf, got %v", got)
	}
	if got := tree.Find("nope"); got != nil {
		t.Errorf("Find should return nil for an unknown id, got %v", got)
	}
}
