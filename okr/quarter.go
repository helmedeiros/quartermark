package okr

import (
	"fmt"
	"time"
)

// Quarter is a planning period and the objectives committed to it.
type Quarter struct {
	ID    string
	Label string
	Start Date
	End   Date

	// Locked marks a quarter as closed. A closed quarter is history: it
	// should keep reporting what was true at the time rather than being
	// quietly re-scored by a later refresh.
	Locked bool

	// Capacity is how many people the quarter is planned against, used
	// to tell an over-committed week from a full one.
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

	// Ids are unique across the quarter, not merely within one
	// objective: a URL names a node without saying which tree it sits
	// in, and the tracker link map is keyed the same way.
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

// Walk visits every node in the quarter.
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

// TeamOkrs is everything one team plans: its quarters and the
// vocabulary it groups objectives under.
type TeamOkrs struct {
	Team string

	// Clusters is the team's own strategic themes. Empty means the
	// caller's default applies — the domain does not carry one, because
	// a default set of themes is a product opinion, not a rule.
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

// Quarter returns the quarter with the given id, or nil.
func (t *TeamOkrs) Quarter(id string) *Quarter {
	for i := range t.Quarters {
		if t.Quarters[i].ID == id {
			return &t.Quarters[i]
		}
	}
	return nil
}
