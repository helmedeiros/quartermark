package jira_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/helmedeiros/quartermark/adapters/driven/jira"
	"github.com/helmedeiros/quartermark/jirasource"
	"github.com/helmedeiros/quartermark/timewindow"
)

func TestIngestAdapter_SearchIssuesByAssignee_MapsFields(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/rest/api/3/status", func(w http.ResponseWriter, r *http.Request) { fakeStatusList(w) })
	mux.HandleFunc("/rest/api/3/search/jql", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"issues": []map[string]any{
				{
					"key": "ABC-1",
					"fields": map[string]any{
						"issuetype":      map[string]any{"name": "Bug"},
						"status":         map[string]any{"name": "Done"},
						"created":        "2026-05-01T00:00:00.000+0000",
						"resolutiondate": "2026-05-05T00:00:00.000+0000",
					},
					"changelog": map[string]any{"histories": newestFirstHistories()},
				},
			},
			"isLast": true,
		})
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	adapter := jira.IngestAdapter{Client: jira.NewClient(server.URL, "jane@example.com", "token123")}
	issues, err := adapter.SearchIssuesByAssignee(context.Background(), "acc-1", timewindow.Window{Since: time.Now().AddDate(0, -1, 0), Until: time.Now()})
	if err != nil {
		t.Fatalf("SearchIssuesByAssignee: %v", err)
	}
	if len(issues) != 1 {
		t.Fatalf("expected 1 issue, got %+v", issues)
	}
	got := issues[0]
	if got.Key != "ABC-1" || got.IssueType != "Bug" || got.Status != "Done" ||
		got.Resolved == nil || got.InProgressAt == nil || got.DoneAt == nil {
		t.Fatalf("unexpected mapped issue (a field was dropped in mapping): %+v", got)
	}
}

func TestIngestAdapter_GetIssuesByKeys_MapsFields(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/rest/api/3/status", func(w http.ResponseWriter, r *http.Request) { fakeStatusList(w) })
	mux.HandleFunc("/rest/api/3/field", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode([]map[string]any{
			{
				"id":     "customfield_10020",
				"name":   "Sprint",
				"schema": map[string]any{"custom": "com.pyxis.greenhopper.jira:gh-sprint"},
			},
		})
	})
	mux.HandleFunc("/rest/api/3/search/jql", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"issues": []map[string]any{
				{
					"key": "PROJ-1",
					"fields": map[string]any{
						"issuetype":      map[string]any{"name": "Epic"},
						"status":         map[string]any{"name": "Done", "statusCategory": map[string]any{"key": "done"}},
						"summary":        "Ship the thing",
						"assignee":       map[string]any{"displayName": "Jane Doe"},
						"labels":         []string{"backend"},
						"created":        "2026-05-01T00:00:00.000+0000",
						"resolutiondate": "2026-05-05T00:00:00.000+0000",
						"duedate":        "2026-12-31",
						"customfield_10020": []map[string]any{
							{"name": "OG Sprint 41", "startDate": "2026-08-31T09:00:00.000+0000", "endDate": "2026-09-14T09:00:00.000+0000"},
						},
					},
					"changelog": map[string]any{"histories": newestFirstHistories()},
				},
			},
			"isLast": true,
		})
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	adapter := jira.IngestAdapter{Client: jira.NewClient(server.URL, "jane@example.com", "token123")}
	issues, err := adapter.GetIssuesByKeys(context.Background(), []string{"PROJ-1"})
	if err != nil {
		t.Fatalf("GetIssuesByKeys: %v", err)
	}
	if len(issues) != 1 {
		t.Fatalf("expected 1 issue, got %+v", issues)
	}
	got := issues[0]
	if got.Key != "PROJ-1" || got.StatusCategory != "done" ||
		got.Created.IsZero() || got.Resolved == nil || got.InProgressAt == nil || got.DoneAt == nil {
		t.Fatalf("unexpected mapped issue (a field was dropped in mapping): %+v", got)
	}
	if got.Summary != "Ship the thing" || got.Assignee != "Jane Doe" || len(got.Labels) != 1 {
		t.Fatalf("expected summary/assignee/labels to be mapped through, got %+v", got)
	}
	if got.DueDate == nil || !got.DueDate.Equal(time.Date(2026, 12, 31, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("expected DueDate to be mapped through, got %+v", got.DueDate)
	}
	if len(got.Sprints) != 1 || got.Sprints[0].Name != "OG Sprint 41" {
		t.Fatalf("expected Sprints to be mapped through, got %+v", got.Sprints)
	}
}

func TestIngestAdapter_GetChildIssues_MapsFields(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/rest/api/3/search/jql", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"issues": []map[string]any{
				{"fields": map[string]any{"created": "2026-01-01T00:00:00.000+0000", "resolutiondate": "2026-01-10T00:00:00.000+0000"}},
			},
			"isLast": true,
		})
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	adapter := jira.IngestAdapter{Client: jira.NewClient(server.URL, "jane@example.com", "token123")}
	children, err := adapter.GetChildIssues(context.Background(), "PROJ-1")
	if err != nil {
		t.Fatalf("GetChildIssues: %v", err)
	}
	want := jirasource.ChildIssue{
		Created:  time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
		Resolved: timePtr(time.Date(2026, 1, 10, 0, 0, 0, 0, time.UTC)),
	}
	if len(children) != 1 || !children[0].Created.Equal(want.Created) ||
		children[0].Resolved == nil || !children[0].Resolved.Equal(*want.Resolved) {
		t.Fatalf("unexpected mapped child: %+v", children)
	}
}

func timePtr(t time.Time) *time.Time { return &t }

func TestIngestAdapter_SearchIssuesByText_MapsFields(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/rest/api/3/search/jql", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"issues": []map[string]any{
				{
					"key": "PROJ-1",
					"fields": map[string]any{
						"summary":   "Ship the thing",
						"issuetype": map[string]any{"name": "Epic"},
					},
				},
			},
		})
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	adapter := jira.IngestAdapter{Client: jira.NewClient(server.URL, "jane@example.com", "token123")}
	results, err := adapter.SearchIssuesByText(context.Background(), "ship", 10)
	if err != nil {
		t.Fatalf("SearchIssuesByText: %v", err)
	}
	want := jirasource.IssueSummary{Key: "PROJ-1", Summary: "Ship the thing", IssueType: "Epic"}
	if len(results) != 1 || results[0] != want {
		t.Fatalf("unexpected mapped result: %+v", results)
	}
}
