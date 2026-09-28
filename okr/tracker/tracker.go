package tracker

import (
	"context"
	"time"

	"github.com/helmedeiros/quartermark/shared/timewindow"
)

type Issue struct {
	Key, IssueType, Status string
	StatusCategory         string
	Summary                string
	Assignee               string
	Labels                 []string
	Created                time.Time
	Resolved               *time.Time
	DueDate                *time.Time
	InProgressAt, DoneAt   *time.Time
	Sprints                []Sprint
}

type Sprint struct {
	Name      string
	StartDate *time.Time
	EndDate   *time.Time
}

type ChildIssue struct {
	Created  time.Time
	Resolved *time.Time
}

type IssueSummary struct {
	Key       string
	Summary   string
	IssueType string
}

type Source interface {
	SearchIssuesByAssignee(ctx context.Context, accountID string, window timewindow.Window) ([]Issue, error)
	GetIssuesByKeys(ctx context.Context, keys []string) ([]Issue, error)
	GetChildIssues(ctx context.Context, key string) ([]ChildIssue, error)
	SearchIssuesByText(ctx context.Context, query string, maxResults int) ([]IssueSummary, error)
}
