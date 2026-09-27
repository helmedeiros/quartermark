package okr

import (
	"fmt"
	"time"
)

// Update is a dated observation of where a node stood. Kept as history
// rather than overwritten, so a closed quarter can still answer "when
// did we know this was slipping".
type Update struct {
	Date     Date
	Status   Status
	Progress Progress
	Note     string
	Author   string
}

// Note is the written half of a check-in — the part a number cannot
// carry.
type Note struct {
	Date      Date
	Author    string
	Comment   string
	Learnings string
	NextSteps string
}

// MetricPoint is one reading of a key result's metric over time.
type MetricPoint struct {
	Date    Date
	Current float64
}

// Metric is a key result's measurable target. A concept in its own
// right — a number with no type cannot be formatted and no unit cannot
// be read — so it is present or absent as a whole. Target and current
// stay optional within it: a key result can have a target before anyone
// has measured against it.
type Metric struct {
	Type    MetricType
	Target  *float64
	Current *float64
	Unit    string
}

// TrackerSnapshot is what the issue tracker last said about one linked
// issue. A snapshot, not a live read: a closed quarter must keep
// reporting what was true then, not what is true now.
type TrackerSnapshot struct {
	Key       string
	Summary   string
	IssueType string
	Status    Status
	HasStatus bool
	Progress  Progress
	Assignee  string
	Labels    []string
	Due       Date
	Sprints   []Sprint
	SyncedAt  time.Time
}

type Sprint struct {
	Name  string
	Start Date
	End   Date
}

// Node is an objective, a key result or a milestone. One type rather
// than three because the tree is walked far more often than a single
// level is inspected, and the parts that differ are optional anyway.
type Node struct {
	ID    string
	Type  NodeType
	Title string

	Description string
	Owner       string
	Groups      []string
	Labels      []string
	Link        string

	Status       Status
	StatusMode   Mode
	Progress     Progress
	ProgressMode Mode

	Weight           *float64
	Allocation       *float64
	ActualAllocation *float64

	Metric *Metric

	// Three independent optionals rather than one "sizing" concept.
	// Objectives carry dates without effort, and a milestone may be
	// dated before it is estimated; grouping them would invent a
	// presence question the document does not have, and turn an absent
	// effort into a zero one on the way back out.
	Start       Date
	Due         Date
	EffortWeeks *float64

	Commitment               Commitment
	ContributesToParentGrade bool

	Updates       []Update
	Notes         []Note
	MetricHistory []MetricPoint

	TrackerKeys      []string
	TrackerSnapshots map[string]TrackerSnapshot

	Children []Node
}

// NewNode builds a node with the fields nothing is valid without. The
// rest are set on the result; only these four have no sensible zero.
func NewNode(id string, t NodeType, title string, status Status) (Node, error) {
	if id == "" {
		return Node{}, fmt.Errorf("okr: a node needs an id")
	}
	if title == "" {
		return Node{}, fmt.Errorf("okr: node %s needs a title", id)
	}
	if _, err := ParseNodeType(string(t)); err != nil {
		return Node{}, err
	}
	if _, err := ParseStatus(string(status)); err != nil {
		return Node{}, err
	}
	return Node{ID: id, Type: t, Title: title, Status: status}, nil
}

// Validate checks the whole subtree: the invariants a single
// constructor cannot see, because they are about how nodes relate.
func (n Node) Validate() error {
	seen := map[string]bool{}
	return n.validate(seen)
}

func (n Node) validate(seen map[string]bool) error {
	if n.ID == "" {
		return fmt.Errorf("okr: a node needs an id")
	}
	if seen[n.ID] {
		// Ids address nodes in URLs and in the tracker link map. Two
		// nodes sharing one means an edit lands on whichever the walk
		// reached first.
		return fmt.Errorf("okr: duplicate node id %q", n.ID)
	}
	seen[n.ID] = true

	if _, err := ParseNodeType(string(n.Type)); err != nil {
		return fmt.Errorf("node %s: %w", n.ID, err)
	}
	if _, err := ParseStatus(string(n.Status)); err != nil {
		return fmt.Errorf("node %s: %w", n.ID, err)
	}
	if n.Progress < 0 || n.Progress > 100 {
		return fmt.Errorf("okr: node %s has progress %d outside 0–100", n.ID, n.Progress)
	}
	for _, child := range n.Children {
		if !n.Type.CanContain(child.Type) {
			return fmt.Errorf("okr: a %s may not contain a %s (node %s under %s)",
				n.Type, child.Type, child.ID, n.ID)
		}
		if err := child.validate(seen); err != nil {
			return err
		}
	}
	return nil
}

// Walk visits this node and every descendant, depth first. The callback
// takes a pointer so a caller can change what it visits — which is what
// a tracker refresh does.
func (n *Node) Walk(visit func(*Node)) {
	visit(n)
	for i := range n.Children {
		n.Children[i].Walk(visit)
	}
}

// Find returns the node with the given id, or nil.
func (n *Node) Find(id string) *Node {
	var found *Node
	n.Walk(func(candidate *Node) {
		if found == nil && candidate.ID == id {
			found = candidate
		}
	})
	return found
}
