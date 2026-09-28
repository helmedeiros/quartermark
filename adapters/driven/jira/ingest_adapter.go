package jira

import (
	"context"

	"github.com/helmedeiros/quartermark/jirasource"
	"github.com/helmedeiros/quartermark/timewindow"
)

type IngestAdapter struct{ *Client }

var _ jirasource.Source = IngestAdapter{}

func toIngestJiraIssue(is Issue) jirasource.Issue {
	return jirasource.Issue{
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

func toIngestJiraSprints(sprints []Sprint) []jirasource.Sprint {
	if sprints == nil {
		return nil
	}
	out := make([]jirasource.Sprint, len(sprints))
	for i, s := range sprints {
		out[i] = jirasource.Sprint{
			Name:      s.Name,
			StartDate: s.StartDate,
			EndDate:   s.EndDate,
		}
	}
	return out
}

func toIngestJiraIssues(issues []Issue) []jirasource.Issue {
	out := make([]jirasource.Issue, len(issues))
	for i, is := range issues {
		out[i] = toIngestJiraIssue(is)
	}
	return out
}

func (a IngestAdapter) SearchIssuesByAssignee(ctx context.Context, accountID string, window timewindow.Window) ([]jirasource.Issue, error) {
	issues, err := a.Client.SearchIssuesByAssignee(ctx, accountID, window.Since, window.Until)
	if err != nil {
		return nil, err
	}
	return toIngestJiraIssues(issues), nil
}

func (a IngestAdapter) GetIssuesByKeys(ctx context.Context, keys []string) ([]jirasource.Issue, error) {
	issues, err := a.Client.GetIssuesByKeys(ctx, keys)
	if err != nil {
		return nil, err
	}
	return toIngestJiraIssues(issues), nil
}

func (a IngestAdapter) GetChildIssues(ctx context.Context, key string) ([]jirasource.ChildIssue, error) {
	children, err := a.Client.GetChildIssues(ctx, key)
	if err != nil {
		return nil, err
	}
	out := make([]jirasource.ChildIssue, len(children))
	for i, c := range children {
		out[i] = jirasource.ChildIssue{Created: c.Created, Resolved: c.Resolved}
	}
	return out, nil
}

func (a IngestAdapter) SearchIssuesByText(ctx context.Context, query string, maxResults int) ([]jirasource.IssueSummary, error) {
	results, err := a.Client.SearchIssuesByText(ctx, query, maxResults)
	if err != nil {
		return nil, err
	}
	out := make([]jirasource.IssueSummary, len(results))
	for i, r := range results {
		out[i] = jirasource.IssueSummary{
			Key:       r.Key,
			Summary:   r.Summary,
			IssueType: r.IssueType,
		}
	}
	return out, nil
}
