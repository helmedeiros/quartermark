package okrdoc

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/helmedeiros/quartermark/okr"
)

type Document struct {
	doc document
}

func Parse(raw []byte) (*Document, error) {
	doc, err := decodeDocument(raw)
	if err != nil {
		return nil, err
	}
	return &Document{doc: doc}, nil
}

func (d *Document) Domain() (okr.TeamOkrs, error) {
	team := okr.TeamOkrs{Team: d.doc.Team, Clusters: d.doc.Clusters}
	for _, q := range d.doc.Quarters {
		quarter, err := toQuarter(q)
		if err != nil {
			return okr.TeamOkrs{}, err
		}
		team.Quarters = append(team.Quarters, quarter)
	}
	return team, nil
}

func (d *Document) Apply(team okr.TeamOkrs) error {
	d.doc.SchemaVersion = okr.SchemaVersion
	d.doc.Team = team.Team
	d.doc.Clusters = team.Clusters

	for _, q := range team.Quarters {
		target := d.findQuarter(q.ID)
		if target == nil {
			return fmt.Errorf("okrdoc: the document has no quarter %q to apply to", q.ID)
		}
		applyQuarter(target, q)
		for _, o := range q.Objectives {
			if err := applyNodeTree(target.Objectives, o); err != nil {
				return err
			}
		}
	}
	return nil
}

func (d *Document) findQuarter(id string) *quarterDoc {
	for i := range d.doc.Quarters {
		if d.doc.Quarters[i].QuarterID == id {
			return &d.doc.Quarters[i]
		}
	}
	return nil
}

func applyQuarter(target *quarterDoc, q okr.Quarter) {
	target.Label = q.Label
	target.StartDate = q.Start.String()
	target.EndDate = q.End.String()
	target.TeamCapacity = q.Capacity
	if q.Locked || target.Locked != nil {
		locked := q.Locked
		target.Locked = &locked
	}
	target.JiraRefreshedAt = formatInstant(q.TrackerRefreshedAt)
	target.JiraAsOf = formatInstant(q.TrackerAsOf)
}

func applyNodeTree(targets []nodeDoc, n okr.Node) error {
	target := findNode(targets, n.ID)
	if target == nil {
		return fmt.Errorf("okrdoc: the document has no node %q to apply to", n.ID)
	}
	applyNode(target, n)
	for _, child := range n.Children {
		if err := applyNodeTree(target.Children, child); err != nil {
			return err
		}
	}
	return nil
}

func findNode(nodes []nodeDoc, id string) *nodeDoc {
	for i := range nodes {
		if nodes[i].ID == id {
			return &nodes[i]
		}
		if found := findNode(nodes[i].Children, id); found != nil {
			return found
		}
	}
	return nil
}

func applyNode(target *nodeDoc, n okr.Node) {
	target.Type = string(n.Type)
	target.Title = n.Title
	target.Description = n.Description
	target.Owner = n.Owner
	target.Groups = n.Groups
	target.Labels = n.Labels
	target.Link = n.Link

	target.Status = string(n.Status)
	target.StatusMode = string(n.StatusMode)
	target.Progress = n.Progress.Int()
	target.ProgressMode = string(n.ProgressMode)

	target.Weight = n.Weight
	target.Allocation = n.Allocation
	target.ActualAllocation = n.ActualAllocation
	target.EffortWeeks = n.EffortWeeks

	target.StartDate = n.Start.String()
	target.DueDate = n.Due.String()
	target.Commitment = string(n.Commitment)
	target.JiraKeys = n.TrackerKeys

	if n.Metric != nil {
		target.MetricType = string(n.Metric.Type)
		target.Target = n.Metric.Target
		target.Current = n.Metric.Current
		target.Unit = n.Metric.Unit
	} else {
		target.MetricType, target.Target, target.Current, target.Unit = "", nil, nil, ""
	}

	if n.ContributesToParentGrade || target.ContributesToParentGrade != nil {
		v := n.ContributesToParentGrade
		target.ContributesToParentGrade = &v
	}

	applyUpdates(target, n)
	applyNotes(target, n)
	applyMetricHistory(target, n)
	applySnapshots(target, n)
}

func applyUpdates(target *nodeDoc, n okr.Node) {
	if len(n.Updates) == 0 {
		return
	}
	out := make([]updateDoc, 0, len(n.Updates))
	for _, u := range n.Updates {
		out = append(out, updateDoc{
			Date:     u.Date.String(),
			Status:   string(u.Status),
			Progress: u.Progress.Int(),
			Note:     u.Note,
			Author:   u.Author,
		})
	}
	target.Updates = out
}

func applyNotes(target *nodeDoc, n okr.Node) {
	if len(n.Notes) == 0 {
		return
	}
	out := make([]noteDoc, 0, len(n.Notes))
	for _, note := range n.Notes {
		out = append(out, noteDoc{
			Date:      note.Date.String(),
			Author:    note.Author,
			Comment:   note.Comment,
			Learnings: note.Learnings,
			NextSteps: note.NextSteps,
		})
	}
	target.Notes = out
}

func applyMetricHistory(target *nodeDoc, n okr.Node) {
	if len(n.MetricHistory) == 0 {
		return
	}
	out := make([]metricPointDoc, 0, len(n.MetricHistory))
	for _, p := range n.MetricHistory {
		out = append(out, metricPointDoc{Date: p.Date.String(), Current: p.Current})
	}
	target.MetricHistory = out
}

func (d *Document) Bytes() ([]byte, error) {
	return encodeDocument(d.doc)
}

func applySnapshots(target *nodeDoc, n okr.Node) {
	if len(n.TrackerSnapshots) == 0 {
		return
	}
	out := make(map[string]json.RawMessage, len(n.TrackerSnapshots))
	for key, s := range n.TrackerSnapshots {
		var original extras
		if raw, ok := target.JiraIssues[key]; ok {
			_ = json.Unmarshal(raw, &original)
		}

		doc := snapshotDoc{
			Summary:   s.Summary,
			IssueType: s.IssueType,
			Progress:  s.Progress.Int(),
			Assignee:  s.Assignee,
			Labels:    s.Labels,
			DueDate:   s.Due.String(),
			SyncedAt:  formatInstant(s.SyncedAt),
		}
		if s.HasStatus {
			doc.Status = string(s.Status)
		}
		for _, sp := range s.Sprints {
			doc.Sprints = append(doc.Sprints, sprintDoc{
				Name:      sp.Name,
				StartDate: sp.Start.String(),
				EndDate:   sp.End.String(),
			})
		}
		encoded, err := mergeExtras(doc, original)
		if err != nil {
			continue
		}
		out[key] = encoded
	}
	target.JiraIssues = out
}

func formatInstant(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.UTC().Format(time.RFC3339)
}
