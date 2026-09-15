// Package jirasource is the port through which the rest of the system
// reads Jira, plus the data it reads back.
//
// It holds no HTTP and no persistence: internal/adapters/jira implements
// the interface, internal/ingest uses it for delivery metrics, and
// internal/okr uses it for OKR progress. Keeping the port here is what
// lets the OKR side depend on Jira without depending on the delivery
// metrics pipeline it has nothing to do with.
package jirasource

import (
	"context"
	"time"

	"github.com/helmedeiros/quartermark/timewindow"
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

// ChildIssue is deliberately thinner than Issue: progress roll-up only
// needs to know how many children exist and when each was resolved.
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
