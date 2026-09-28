package okr

import (
	"fmt"
	"time"
)

type Update struct {
	Date     Date
	Status   Status
	Progress Progress
	Note     string
	Author   string
}

type Note struct {
	Date      Date
	Author    string
	Comment   string
	Learnings string
	NextSteps string
}

type MetricPoint struct {
	Date    Date
	Current float64
}

type Metric struct {
	Type    MetricType
	Target  *float64
	Current *float64
	Unit    string
}

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

func (n Node) Validate() error {
	seen := map[string]bool{}
	return n.validate(seen)
}

func (n Node) validate(seen map[string]bool) error {
	if n.ID == "" {
		return fmt.Errorf("okr: a node needs an id")
	}
	if seen[n.ID] {
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

func (n *Node) Walk(visit func(*Node)) {
	visit(n)
	for i := range n.Children {
		n.Children[i].Walk(visit)
	}
}

func (n *Node) Find(id string) *Node {
	var found *Node
	n.Walk(func(candidate *Node) {
		if found == nil && candidate.ID == id {
			found = candidate
		}
	})
	return found
}
