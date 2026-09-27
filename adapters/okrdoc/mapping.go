package okrdoc

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/helmedeiros/quartermark/okr"
)

// Decode reads a stored document into the domain.
//
// Strict: a value outside the vocabulary is an error here rather than a
// surprise later. The alternative — accepting it and rendering
// something neutral — is how an unrecognised status reached a chart and
// took the page down with it.
func Decode(raw []byte) (okr.TeamOkrs, error) {
	doc, err := decodeDocument(raw)
	if err != nil {
		return okr.TeamOkrs{}, err
	}

	team := okr.TeamOkrs{Team: doc.Team, Clusters: doc.Clusters}
	for _, q := range doc.Quarters {
		quarter, err := toQuarter(q)
		if err != nil {
			return okr.TeamOkrs{}, err
		}
		team.Quarters = append(team.Quarters, quarter)
	}
	return team, nil
}

func toQuarter(q quarterDoc) (okr.Quarter, error) {
	out := okr.Quarter{
		ID:       q.QuarterID,
		Label:    q.Label,
		Capacity: q.TeamCapacity,
	}
	if q.Locked != nil {
		out.Locked = *q.Locked
	}

	var err error
	if out.Start, err = okr.ParseDate(q.StartDate); err != nil {
		return okr.Quarter{}, fmt.Errorf("quarter %s start: %w", q.QuarterID, err)
	}
	if out.End, err = okr.ParseDate(q.EndDate); err != nil {
		return okr.Quarter{}, fmt.Errorf("quarter %s end: %w", q.QuarterID, err)
	}
	if out.TrackerRefreshedAt, err = parseInstant(q.JiraRefreshedAt); err != nil {
		return okr.Quarter{}, fmt.Errorf("quarter %s refreshedAt: %w", q.QuarterID, err)
	}
	if out.TrackerAsOf, err = parseInstant(q.JiraAsOf); err != nil {
		return okr.Quarter{}, fmt.Errorf("quarter %s asOf: %w", q.QuarterID, err)
	}

	for _, o := range q.Objectives {
		node, err := toNode(o)
		if err != nil {
			return okr.Quarter{}, fmt.Errorf("quarter %s: %w", q.QuarterID, err)
		}
		out.Objectives = append(out.Objectives, node)
	}
	return out, nil
}

func toNode(n nodeDoc) (okr.Node, error) {
	nodeType, err := okr.ParseNodeType(n.Type)
	if err != nil {
		return okr.Node{}, fmt.Errorf("node %s: %w", n.ID, err)
	}
	status, err := okr.ParseStatus(n.Status)
	if err != nil {
		return okr.Node{}, fmt.Errorf("node %s: %w", n.ID, err)
	}
	progress, err := okr.NewProgress(n.Progress)
	if err != nil {
		return okr.Node{}, fmt.Errorf("node %s: %w", n.ID, err)
	}

	out := okr.Node{
		ID:               n.ID,
		Type:             nodeType,
		Title:            n.Title,
		Description:      n.Description,
		Owner:            n.Owner,
		Groups:           n.Groups,
		Labels:           n.Labels,
		Link:             n.Link,
		Status:           status,
		Progress:         progress,
		Weight:           n.Weight,
		Allocation:       n.Allocation,
		ActualAllocation: n.ActualAllocation,
		EffortWeeks:      n.EffortWeeks,
		TrackerKeys:      n.JiraKeys,
	}
	if n.ContributesToParentGrade != nil {
		out.ContributesToParentGrade = *n.ContributesToParentGrade
	}

	if out.StatusMode, err = parseModeOrEmpty(n.StatusMode); err != nil {
		return okr.Node{}, fmt.Errorf("node %s statusMode: %w", n.ID, err)
	}
	if out.ProgressMode, err = parseModeOrEmpty(n.ProgressMode); err != nil {
		return okr.Node{}, fmt.Errorf("node %s progressMode: %w", n.ID, err)
	}
	if n.Commitment != "" {
		if out.Commitment, err = okr.ParseCommitment(n.Commitment); err != nil {
			return okr.Node{}, fmt.Errorf("node %s: %w", n.ID, err)
		}
	}
	if out.Start, err = okr.ParseDate(n.StartDate); err != nil {
		return okr.Node{}, fmt.Errorf("node %s start: %w", n.ID, err)
	}
	if out.Due, err = okr.ParseDate(n.DueDate); err != nil {
		return okr.Node{}, fmt.Errorf("node %s due: %w", n.ID, err)
	}

	// The metric's parts are flat on the document and a concept in the
	// domain. It exists when the document says what kind it is.
	if n.MetricType != "" {
		metricType, err := okr.ParseMetricType(n.MetricType)
		if err != nil {
			return okr.Node{}, fmt.Errorf("node %s: %w", n.ID, err)
		}
		out.Metric = &okr.Metric{
			Type:    metricType,
			Target:  n.Target,
			Current: n.Current,
			Unit:    n.Unit,
		}
	}

	if out.Updates, err = toUpdates(n); err != nil {
		return okr.Node{}, err
	}
	if out.Notes, err = toNotes(n); err != nil {
		return okr.Node{}, err
	}
	if out.MetricHistory, err = toMetricHistory(n); err != nil {
		return okr.Node{}, err
	}
	if out.TrackerSnapshots, err = toSnapshots(n); err != nil {
		return okr.Node{}, err
	}

	for _, c := range n.Children {
		child, err := toNode(c)
		if err != nil {
			return okr.Node{}, err
		}
		out.Children = append(out.Children, child)
	}
	return out, nil
}

func toUpdates(n nodeDoc) ([]okr.Update, error) {
	if len(n.Updates) == 0 {
		return nil, nil
	}
	out := make([]okr.Update, 0, len(n.Updates))
	for _, u := range n.Updates {
		date, err := okr.ParseDate(u.Date)
		if err != nil {
			return nil, fmt.Errorf("node %s update: %w", n.ID, err)
		}
		progress, err := okr.NewProgress(u.Progress)
		if err != nil {
			return nil, fmt.Errorf("node %s update %s: %w", n.ID, u.Date, err)
		}
		entry := okr.Update{Date: date, Progress: progress, Note: u.Note, Author: u.Author}
		// An update predating the status field carries none, and that
		// is history rather than an error.
		if u.Status != "" {
			if entry.Status, err = okr.ParseStatus(u.Status); err != nil {
				return nil, fmt.Errorf("node %s update %s: %w", n.ID, u.Date, err)
			}
		}
		out = append(out, entry)
	}
	return out, nil
}

func toNotes(n nodeDoc) ([]okr.Note, error) {
	if len(n.Notes) == 0 {
		return nil, nil
	}
	out := make([]okr.Note, 0, len(n.Notes))
	for _, note := range n.Notes {
		date, err := okr.ParseDate(note.Date)
		if err != nil {
			return nil, fmt.Errorf("node %s note: %w", n.ID, err)
		}
		out = append(out, okr.Note{
			Date:      date,
			Author:    note.Author,
			Comment:   note.Comment,
			Learnings: note.Learnings,
			NextSteps: note.NextSteps,
		})
	}
	return out, nil
}

func toMetricHistory(n nodeDoc) ([]okr.MetricPoint, error) {
	if len(n.MetricHistory) == 0 {
		return nil, nil
	}
	out := make([]okr.MetricPoint, 0, len(n.MetricHistory))
	for _, p := range n.MetricHistory {
		date, err := okr.ParseDate(p.Date)
		if err != nil {
			return nil, fmt.Errorf("node %s metric history: %w", n.ID, err)
		}
		out = append(out, okr.MetricPoint{Date: date, Current: p.Current})
	}
	return out, nil
}

func toSnapshots(n nodeDoc) (map[string]okr.TrackerSnapshot, error) {
	if len(n.JiraIssues) == 0 {
		return nil, nil
	}
	out := make(map[string]okr.TrackerSnapshot, len(n.JiraIssues))
	for key, raw := range n.JiraIssues {
		var s snapshotDoc
		if err := json.Unmarshal(raw, &s); err != nil {
			return nil, fmt.Errorf("node %s snapshot %s: %w", n.ID, key, err)
		}
		snapshot, err := s.toDomain(key)
		if err != nil {
			return nil, fmt.Errorf("node %s snapshot %s: %w", n.ID, key, err)
		}
		out[key] = snapshot
	}
	return out, nil
}

func parseModeOrEmpty(s string) (okr.Mode, error) {
	if s == "" {
		return "", nil
	}
	return okr.ParseMode(s)
}

// parseInstant reads an RFC3339 timestamp, treating absence as the zero
// time — a quarter that has never been refreshed has no refresh time.
func parseInstant(s string) (time.Time, error) {
	if s == "" {
		return time.Time{}, nil
	}
	return time.Parse(time.RFC3339, s)
}

func (s snapshotDoc) toDomain(key string) (okr.TrackerSnapshot, error) {
	out := okr.TrackerSnapshot{
		Key:       key,
		Summary:   s.Summary,
		IssueType: s.IssueType,
		Assignee:  s.Assignee,
		Labels:    s.Labels,
	}

	var err error
	if s.Status != "" {
		if out.Status, err = okr.ParseStatus(s.Status); err != nil {
			return okr.TrackerSnapshot{}, err
		}
		out.HasStatus = true
	}
	if out.Progress, err = okr.NewProgress(s.Progress); err != nil {
		return okr.TrackerSnapshot{}, err
	}
	if out.Due, err = okr.ParseDate(s.DueDate); err != nil {
		return okr.TrackerSnapshot{}, err
	}
	if out.SyncedAt, err = parseInstant(s.SyncedAt); err != nil {
		return okr.TrackerSnapshot{}, err
	}

	for _, sp := range s.Sprints {
		sprint := okr.Sprint{Name: sp.Name}
		if sprint.Start, err = okr.ParseDate(sp.StartDate); err != nil {
			return okr.TrackerSnapshot{}, err
		}
		if sprint.End, err = okr.ParseDate(sp.EndDate); err != nil {
			return okr.TrackerSnapshot{}, err
		}
		out.Sprints = append(out.Sprints, sprint)
	}
	return out, nil
}
