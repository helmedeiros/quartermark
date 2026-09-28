package okr

import (
	"fmt"
	"time"
)

type Quarter struct {
	ID    string
	Label string
	Start Date
	End   Date

	Locked bool

	Capacity *float64

	TrackerRefreshedAt time.Time
	TrackerAsOf        time.Time

	Objectives []Node
}

func NewQuarter(id, label string) (Quarter, error) {
	if id == "" {
		return Quarter{}, fmt.Errorf("okr: a quarter needs an id")
	}
	if label == "" {
		return Quarter{}, fmt.Errorf("okr: quarter %s needs a label", id)
	}
	return Quarter{ID: id, Label: label}, nil
}

func (q Quarter) Validate() error {
	if q.ID == "" {
		return fmt.Errorf("okr: a quarter needs an id")
	}
	if !q.Start.IsZero() && !q.End.IsZero() && q.End.Before(q.Start) {
		return fmt.Errorf("okr: quarter %s ends (%s) before it starts (%s)", q.ID, q.End, q.Start)
	}

	seen := map[string]bool{}
	for _, o := range q.Objectives {
		if o.Type != Objective {
			return fmt.Errorf("okr: quarter %s holds a %s at the top level (node %s)", q.ID, o.Type, o.ID)
		}
		if err := o.validate(seen); err != nil {
			return err
		}
	}
	return nil
}

func (q *Quarter) Walk(visit func(*Node)) {
	for i := range q.Objectives {
		q.Objectives[i].Walk(visit)
	}
}

func (q *Quarter) Find(id string) *Node {
	var found *Node
	q.Walk(func(n *Node) {
		if found == nil && n.ID == id {
			found = n
		}
	})
	return found
}

type TeamOkrs struct {
	Team string

	Clusters []string

	Quarters []Quarter
}

func (t TeamOkrs) Validate() error {
	seen := map[string]bool{}
	for _, q := range t.Quarters {
		if seen[q.ID] {
			return fmt.Errorf("okr: duplicate quarter id %q", q.ID)
		}
		seen[q.ID] = true
		if err := q.Validate(); err != nil {
			return err
		}
	}
	return nil
}

func (t *TeamOkrs) Quarter(id string) *Quarter {
	for i := range t.Quarters {
		if t.Quarters[i].ID == id {
			return &t.Quarters[i]
		}
	}
	return nil
}
