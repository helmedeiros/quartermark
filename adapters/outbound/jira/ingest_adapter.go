package jira

import (
	"context"

	"github.com/helmedeiros/quartermark/okr/tracker"
	"github.com/helmedeiros/quartermark/shared/timewindow"
)

type IngestAdapter struct{ *Client }

var _ tracker.Source = IngestAdapter{}

func toIngestJiraIssue(is Issue) tracker.Issue {
	return tracker.Issue{
		Key:            is.Key,
		IssueType:      is.IssueType,
		Status:         is.Status,
		StatusCategory: is.StatusCategory,
		Summary:        is.Summary,
		Assignee:       is.Assignee,
		Labels:         is.Labels,
		Created:        is.Created,
		Resolved:       is.Resolved,
		DueDate:        is.DueDate,
		InProgressAt:   is.InProgressAt,
		DoneAt:         is.DoneAt,
		Sprints:        toIngestJiraSprints(is.Sprints),
	}
}

func toIngestJiraSprints(sprints []Sprint) []tracker.Sprint {
	if sprints == nil {
		return nil
	}
	out := make([]tracker.Sprint, len(sprints))
	for i, s := range sprints {
		out[i] = tracker.Sprint{
			Name:      s.Name,
			StartDate: s.StartDate,
			EndDate:   s.EndDate,
		}
	}
	return out
}

func toIngestJiraIssues(issues []Issue) []tracker.Issue {
	out := make([]tracker.Issue, len(issues))
	for i, is := range issues {
		out[i] = toIngestJiraIssue(is)
	}
	return out
}

func (a IngestAdapter) SearchIssuesByAssignee(ctx context.Context, accountID string, window timewindow.Window) ([]tracker.Issue, error) {
	issues, err := a.Client.SearchIssuesByAssignee(ctx, accountID, window.Since, window.Until)
	if err != nil {
		return nil, err
	}
	return toIngestJiraIssues(issues), nil
}

func (a IngestAdapter) GetIssuesByKeys(ctx context.Context, keys []string) ([]tracker.Issue, error) {
	issues, err := a.Client.GetIssuesByKeys(ctx, keys)
	if err != nil {
		return nil, err
	}
	return toIngestJiraIssues(issues), nil
}

func (a IngestAdapter) GetChildIssues(ctx context.Context, key string) ([]tracker.ChildIssue, error) {
	children, err := a.Client.GetChildIssues(ctx, key)
	if err != nil {
		return nil, err
	}
	out := make([]tracker.ChildIssue, len(children))
	for i, c := range children {
		out[i] = tracker.ChildIssue{Created: c.Created, Resolved: c.Resolved}
	}
	return out, nil
}

func (a IngestAdapter) SearchIssuesByText(ctx context.Context, query string, maxResults int) ([]tracker.IssueSummary, error) {
	results, err := a.Client.SearchIssuesByText(ctx, query, maxResults)
	if err != nil {
		return nil, err
	}
	out := make([]tracker.IssueSummary, len(results))
	for i, r := range results {
		out[i] = tracker.IssueSummary{
			Key:       r.Key,
			Summary:   r.Summary,
			IssueType: r.IssueType,
		}
	}
	return out, nil
}
