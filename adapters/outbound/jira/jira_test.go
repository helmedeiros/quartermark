package jira_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/helmedeiros/quartermark/adapters/outbound/jira"
)

func fakeStatusList(w http.ResponseWriter) {
	_ = json.NewEncoder(w).Encode([]map[string]any{
		{"id": "2", "name": "In Progress", "statusCategory": map[string]any{"key": "indeterminate"}},
		{"id": "3", "name": "Done", "statusCategory": map[string]any{"key": "done"}},
	})
}

func newestFirstHistories() []map[string]any {
	return []map[string]any{
		{"created": "2026-05-05T00:00:00.000+0000", "items": []map[string]any{{"field": "status", "to": "3", "toString": "Done"}}},
		{"created": "2026-05-02T00:00:00.000+0000", "items": []map[string]any{{"field": "status", "to": "2", "toString": "In Progress"}}},
	}
}

func TestClient_SearchIssuesByAssignee_SortsNewestFirstHistoryBeforeClassifying(t *testing.T) {
	var searchRequests int32
	mux := http.NewServeMux()
	mux.HandleFunc("/rest/api/3/status", func(w http.ResponseWriter, r *http.Request) {
		fakeStatusList(w)
	})
	mux.HandleFunc("/rest/api/3/search/jql", func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&searchRequests, 1)
		if got := r.Header.Get("Authorization"); got == "" {
			t.Errorf("expected Authorization header, got none")
		}
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
					"changelog": map[string]any{
						"histories": newestFirstHistories(),
					},
				},
			},
			"isLast": true,
		})
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	client := jira.NewClient(server.URL, "jane@example.com", "token123")
	issues, err := client.SearchIssuesByAssignee(context.Background(), "acc-1", time.Now().AddDate(0, -1, 0), time.Now())
	if err != nil {
		t.Fatalf("SearchIssuesByAssignee: %v", err)
	}
	if len(issues) != 1 {
		t.Fatalf("expected 1 issue, got %d", len(issues))
	}
	issue := issues[0]
	if issue.Key != "ABC-1" || issue.IssueType != "Bug" || issue.Resolved == nil {
		t.Fatalf("unexpected issue: %+v", issue)
	}
	if issue.InProgressAt == nil || issue.DoneAt == nil {
		t.Fatalf("expected both InProgressAt and DoneAt to be derived, got %+v", issue)
	}
	if issue.InProgressAt.Equal(*issue.DoneAt) {
		t.Fatalf("expected InProgressAt and DoneAt to differ, both got %v", issue.InProgressAt)
	}
	if !issue.InProgressAt.Equal(time.Date(2026, 5, 2, 0, 0, 0, 0, time.UTC)) {
		t.Errorf("expected InProgressAt = 2026-05-02 (the indeterminate transition), got %v", issue.InProgressAt)
	}
	if !issue.DoneAt.Equal(time.Date(2026, 5, 5, 0, 0, 0, 0, time.UTC)) {
		t.Errorf("expected DoneAt = 2026-05-05 (the done transition), got %v", issue.DoneAt)
	}
	if atomic.LoadInt32(&searchRequests) != 1 {
		t.Fatalf("expected exactly 1 search request (isLast=true), got %d", searchRequests)
	}
}

func TestClient_SearchIssuesByAssignee_DirectToDoneHopWithNoInProgressStep_LeavesInProgressAtNil(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/rest/api/3/status", func(w http.ResponseWriter, r *http.Request) { fakeStatusList(w) })
	mux.HandleFunc("/rest/api/3/search/jql", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"issues": []map[string]any{
				{
					"key": "ABC-2",
					"fields": map[string]any{
						"issuetype":      map[string]any{"name": "Subtask"},
						"status":         map[string]any{"name": "Done"},
						"created":        "2026-05-01T00:00:00.000+0000",
						"resolutiondate": "2026-05-01T00:10:00.000+0000",
					},
					"changelog": map[string]any{
						"histories": []map[string]any{
							{"created": "2026-05-01T00:10:00.000+0000", "items": []map[string]any{{"field": "status", "to": "3", "toString": "Done"}}},
						},
					},
				},
			},
			"isLast": true,
		})
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	client := jira.NewClient(server.URL, "jane@example.com", "token123")
	issues, err := client.SearchIssuesByAssignee(context.Background(), "acc-1", time.Now().AddDate(0, -1, 0), time.Now())
	if err != nil {
		t.Fatalf("SearchIssuesByAssignee: %v", err)
	}
	if len(issues) != 1 {
		t.Fatalf("expected 1 issue, got %d", len(issues))
	}
	if issues[0].InProgressAt != nil {
		t.Fatalf("expected no InProgressAt (never entered an indeterminate status), got %v", issues[0].InProgressAt)
	}
	if issues[0].DoneAt == nil {
		t.Fatalf("expected DoneAt to still be set")
	}
}

func TestClient_SearchIssuesByAssignee_EmptyAccountIDSkipsRequest(t *testing.T) {
	client := jira.NewClient("https://example.atlassian.net", "jane@example.com", "token123")
	issues, err := client.SearchIssuesByAssignee(context.Background(), "", time.Now(), time.Now())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if issues != nil {
		t.Fatalf("expected nil issues for empty accountID, got %v", issues)
	}
}

func TestClient_SearchIssuesByAssignee_RetriesOn429ThenSucceeds(t *testing.T) {
	var searchAttempts int32
	mux := http.NewServeMux()
	mux.HandleFunc("/rest/api/3/status", func(w http.ResponseWriter, r *http.Request) { fakeStatusList(w) })
	mux.HandleFunc("/rest/api/3/search/jql", func(w http.ResponseWriter, r *http.Request) {
		if atomic.AddInt32(&searchAttempts, 1) == 1 {
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"issues": []map[string]any{}, "isLast": true})
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	client := jira.NewClient(server.URL, "jane@example.com", "token123")
	_, err := client.SearchIssuesByAssignee(context.Background(), "acc-1", time.Now(), time.Now())
	if err != nil {
		t.Fatalf("expected success after retry, got: %v", err)
	}
	if got := atomic.LoadInt32(&searchAttempts); got != 2 {
		t.Fatalf("expected exactly 2 search attempts (1 failure + 1 success), got %d", got)
	}
}

func TestClient_SearchIssuesByAssignee_FailsFastAfterMaxAttempts(t *testing.T) {
	var searchAttempts int32
	mux := http.NewServeMux()
	mux.HandleFunc("/rest/api/3/status", func(w http.ResponseWriter, r *http.Request) { fakeStatusList(w) })
	mux.HandleFunc("/rest/api/3/search/jql", func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&searchAttempts, 1)
		w.WriteHeader(http.StatusTooManyRequests)
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	client := jira.NewClient(server.URL, "jane@example.com", "token123")
	_, err := client.SearchIssuesByAssignee(context.Background(), "acc-1", time.Now(), time.Now())
	if err == nil {
		t.Fatalf("expected an error after exhausting retries")
	}
	if got := atomic.LoadInt32(&searchAttempts); got != 3 {
		t.Fatalf("expected exactly 3 search attempts (maxAttempts), got %d", got)
	}
}

func TestClient_SearchIssuesByAssignee_PaginatesAcrossMultiplePages(t *testing.T) {
	var searchRequests int32
	mux := http.NewServeMux()
	mux.HandleFunc("/rest/api/3/status", func(w http.ResponseWriter, r *http.Request) { fakeStatusList(w) })
	mux.HandleFunc("/rest/api/3/search/jql", func(w http.ResponseWriter, r *http.Request) {
		if atomic.AddInt32(&searchRequests, 1) == 1 {
			issues := make([]map[string]any, 100)
			for i := range issues {
				issues[i] = map[string]any{
					"key": fmt.Sprintf("PROJ-%d", i),
					"fields": map[string]any{
						"issuetype": map[string]any{"name": "Task"},
						"status":    map[string]any{"name": "Done"},
						"created":   "2026-05-01T00:00:00.000+0000",
					},
				}
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"issues":        issues,
				"nextPageToken": "page-2-token",
				"isLast":        false,
			})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"issues": []map[string]any{
				{
					"key": "PROJ-100",
					"fields": map[string]any{
						"issuetype": map[string]any{"name": "Task"},
						"status":    map[string]any{"name": "Done"},
						"created":   "2026-05-02T00:00:00.000+0000",
					},
				},
			},
			"isLast": true,
		})
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	client := jira.NewClient(server.URL, "jane@example.com", "token123")
	issues, err := client.SearchIssuesByAssignee(context.Background(), "acc-1", time.Now(), time.Now())
	if err != nil {
		t.Fatalf("SearchIssuesByAssignee: %v", err)
	}
	if len(issues) != 101 {
		t.Fatalf("expected 101 issues across 2 pages, got %d", len(issues))
	}
	if got := atomic.LoadInt32(&searchRequests); got != 2 {
		t.Fatalf("expected exactly 2 page requests, got %d", got)
	}
}

func TestClient_GetIssuesByKeys_FiltersMalformedKeysAndReadsStatusCategoryDirectly(t *testing.T) {
	var gotJQL string
	mux := http.NewServeMux()
	mux.HandleFunc("/rest/api/3/search/jql", func(w http.ResponseWriter, r *http.Request) {
		gotJQL = r.URL.Query().Get("jql")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"issues": []map[string]any{
				{
					"key": "PROJ-1",
					"fields": map[string]any{
						"issuetype": map[string]any{"name": "Epic"},
						"status": map[string]any{
							"name":           "Done",
							"statusCategory": map[string]any{"key": "done"},
						},
						"summary":  "Ship the thing",
						"assignee": map[string]any{"displayName": "Jane Doe"},
						"labels":   []string{"backend", "q3"},
					},
				},
			},
			"isLast": true,
		})
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	client := jira.NewClient(server.URL, "jane@example.com", "token123")
	issues, err := client.GetIssuesByKeys(context.Background(), []string{"PROJ-1", "not a key; DROP TABLE"})
	if err != nil {
		t.Fatalf("GetIssuesByKeys: %v", err)
	}
	if gotJQL != "key in (PROJ-1)" {
		t.Fatalf("expected malformed key to be dropped from the JQL, got %q", gotJQL)
	}
	if len(issues) != 1 {
		t.Fatalf("expected 1 issue, got %d", len(issues))
	}
	if issues[0].Key != "PROJ-1" || issues[0].StatusCategory != "done" {
		t.Fatalf("unexpected issue: %+v", issues[0])
	}
	if issues[0].Summary != "Ship the thing" || issues[0].Assignee != "Jane Doe" {
		t.Fatalf("expected summary/assignee to be mapped, got %+v", issues[0])
	}
	if len(issues[0].Labels) != 2 || issues[0].Labels[0] != "backend" {
		t.Fatalf("expected labels to be mapped, got %+v", issues[0].Labels)
	}
}

func TestClient_GetIssuesByKeys_MissingAssignee_DoesNotPanic(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/rest/api/3/search/jql", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"issues": []map[string]any{
				{
					"key": "PROJ-2",
					"fields": map[string]any{
						"issuetype": map[string]any{"name": "Epic"},
						"status": map[string]any{
							"name":           "To Do",
							"statusCategory": map[string]any{"key": "new"},
						},
						"assignee": nil,
					},
				},
			},
			"isLast": true,
		})
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	client := jira.NewClient(server.URL, "jane@example.com", "token123")
	issues, err := client.GetIssuesByKeys(context.Background(), []string{"PROJ-2"})
	if err != nil {
		t.Fatalf("GetIssuesByKeys: %v", err)
	}
	if len(issues) != 1 || issues[0].Assignee != "" {
		t.Fatalf("expected an unassigned issue with empty Assignee, got %+v", issues)
	}
}

func TestClient_GetIssuesByKeys_ParsesDueDate(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/rest/api/3/search/jql", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"issues": []map[string]any{
				{
					"key": "PROJ-3",
					"fields": map[string]any{
						"issuetype": map[string]any{"name": "Epic"},
						"status":    map[string]any{"name": "To Do", "statusCategory": map[string]any{"key": "new"}},
						"created":   "2026-05-01T00:00:00.000+0000",
						"duedate":   "2026-12-31",
					},
				},
				{
					"key": "PROJ-4",
					"fields": map[string]any{
						"issuetype": map[string]any{"name": "Epic"},
						"status":    map[string]any{"name": "To Do", "statusCategory": map[string]any{"key": "new"}},
						"created":   "2026-05-01T00:00:00.000+0000",
					},
				},
			},
			"isLast": true,
		})
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	client := jira.NewClient(server.URL, "jane@example.com", "token123")
	issues, err := client.GetIssuesByKeys(context.Background(), []string{"PROJ-3", "PROJ-4"})
	if err != nil {
		t.Fatalf("GetIssuesByKeys: %v", err)
	}
	if len(issues) != 2 {
		t.Fatalf("expected 2 issues, got %d", len(issues))
	}
	withDue := issues[0]
	if withDue.DueDate == nil || !withDue.DueDate.Equal(time.Date(2026, 12, 31, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("expected DueDate = 2026-12-31, got %v", withDue.DueDate)
	}
	withoutDue := issues[1]
	if withoutDue.DueDate != nil {
		t.Fatalf("expected nil DueDate when duedate is absent, got %v", withoutDue.DueDate)
	}
}

func TestClient_GetIssuesByKeys_ParsesSprintsFromTheDiscoveredCustomField(t *testing.T) {
	var gotFields string
	mux := http.NewServeMux()
	mux.HandleFunc("/rest/api/3/field", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode([]map[string]any{
			{"id": "customfield_10001", "name": "Story Points"},
			{
				"id":   "customfield_10020",
				"name": "Sprint",
				"schema": map[string]any{
					"custom": "com.pyxis.greenhopper.jira:gh-sprint",
				},
			},
		})
	})
	mux.HandleFunc("/rest/api/3/search/jql", func(w http.ResponseWriter, r *http.Request) {
		gotFields = r.URL.Query().Get("fields")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"issues": []map[string]any{
				{
					"key": "PROJ-5",
					"fields": map[string]any{
						"issuetype": map[string]any{"name": "Story"},
						"status":    map[string]any{"name": "In Progress", "statusCategory": map[string]any{"key": "indeterminate"}},
						"created":   "2026-08-01T00:00:00.000+0000",
						"customfield_10020": []map[string]any{
							{
								"name":      "OG Sprint 41",
								"startDate": "2026-08-31T09:00:00.000+0000",
								"endDate":   "2026-09-14T09:00:00.000+0000",
							},
							{"name": "OG Sprint 42"},
						},
					},
				},
				{
					"key": "PROJ-6",
					"fields": map[string]any{
						"issuetype": map[string]any{"name": "Story"},
						"status":    map[string]any{"name": "To Do", "statusCategory": map[string]any{"key": "new"}},
						"created":   "2026-08-01T00:00:00.000+0000",
					},
				},
			},
			"isLast": true,
		})
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	client := jira.NewClient(server.URL, "jane@example.com", "token123")
	issues, err := client.GetIssuesByKeys(context.Background(), []string{"PROJ-5", "PROJ-6"})
	if err != nil {
		t.Fatalf("GetIssuesByKeys: %v", err)
	}
	if !strings.Contains(gotFields, "customfield_10020") {
		t.Fatalf("expected the discovered sprint field id in the fields param, got %q", gotFields)
	}

	withSprints := issues[0]
	if len(withSprints.Sprints) != 2 {
		t.Fatalf("expected 2 sprints, got %d", len(withSprints.Sprints))
	}
	first := withSprints.Sprints[0]
	if first.Name != "OG Sprint 41" {
		t.Fatalf("expected first sprint name %q, got %q", "OG Sprint 41", first.Name)
	}
	if first.StartDate == nil || !first.StartDate.Equal(time.Date(2026, 8, 31, 9, 0, 0, 0, time.UTC)) {
		t.Fatalf("expected StartDate = 2026-08-31T09:00Z, got %v", first.StartDate)
	}
	if first.EndDate == nil || !first.EndDate.Equal(time.Date(2026, 9, 14, 9, 0, 0, 0, time.UTC)) {
		t.Fatalf("expected EndDate = 2026-09-14T09:00Z, got %v", first.EndDate)
	}
	second := withSprints.Sprints[1]
	if second.Name != "OG Sprint 42" || second.StartDate != nil || second.EndDate != nil {
		t.Fatalf("expected second sprint with no dates yet, got %+v", second)
	}

	withoutSprints := issues[1]
	if withoutSprints.Sprints != nil {
		t.Fatalf("expected nil Sprints when the issue has none, got %v", withoutSprints.Sprints)
	}
}

func TestClient_GetIssuesByKeys_DerivesHistoryFromChangelog(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/rest/api/3/status", func(w http.ResponseWriter, r *http.Request) { fakeStatusList(w) })
	mux.HandleFunc("/rest/api/3/search/jql", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"issues": []map[string]any{
				{
					"key": "PROJ-1",
					"fields": map[string]any{
						"issuetype":      map[string]any{"name": "Epic"},
						"status":         map[string]any{"name": "Done", "statusCategory": map[string]any{"key": "done"}},
						"created":        "2026-05-01T00:00:00.000+0000",
						"resolutiondate": "2026-05-05T00:00:00.000+0000",
					},
					"changelog": map[string]any{
						"histories": newestFirstHistories(),
					},
				},
			},
			"isLast": true,
		})
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	client := jira.NewClient(server.URL, "jane@example.com", "token123")
	issues, err := client.GetIssuesByKeys(context.Background(), []string{"PROJ-1"})
	if err != nil {
		t.Fatalf("GetIssuesByKeys: %v", err)
	}
	if len(issues) != 1 {
		t.Fatalf("expected 1 issue, got %d", len(issues))
	}
	issue := issues[0]
	if issue.StatusCategory != "done" {
		t.Fatalf("expected StatusCategory=done, got %q", issue.StatusCategory)
	}
	if issue.Created.IsZero() || !issue.Created.Equal(time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("expected Created = 2026-05-01, got %v", issue.Created)
	}
	if issue.InProgressAt == nil || !issue.InProgressAt.Equal(time.Date(2026, 5, 2, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("expected InProgressAt = 2026-05-02, got %v", issue.InProgressAt)
	}
	if issue.DoneAt == nil || !issue.DoneAt.Equal(time.Date(2026, 5, 5, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("expected DoneAt = 2026-05-05, got %v", issue.DoneAt)
	}
}

func TestClient_GetChildIssues_ReturnsCreatedAndResolvedPerChild(t *testing.T) {
	var gotJQL string
	mux := http.NewServeMux()
	mux.HandleFunc("/rest/api/3/search/jql", func(w http.ResponseWriter, r *http.Request) {
		gotJQL = r.URL.Query().Get("jql")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"issues": []map[string]any{
				{"fields": map[string]any{"created": "2026-01-01T00:00:00.000+0000", "resolutiondate": "2026-01-10T00:00:00.000+0000"}},
				{"fields": map[string]any{"created": "2026-02-01T00:00:00.000+0000"}},
			},
			"isLast": true,
		})
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	client := jira.NewClient(server.URL, "jane@example.com", "token123")
	children, err := client.GetChildIssues(context.Background(), "PROJ-1")
	if err != nil {
		t.Fatalf("GetChildIssues: %v", err)
	}
	if len(children) != 2 {
		t.Fatalf("expected 2 children, got %d", len(children))
	}
	if !children[0].Created.Equal(time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)) || children[0].Resolved == nil {
		t.Fatalf("unexpected first child: %+v", children[0])
	}
	if !children[1].Created.Equal(time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)) || children[1].Resolved != nil {
		t.Fatalf("expected second child unresolved, got %+v", children[1])
	}
	if gotJQL != `parent = "PROJ-1"` {
		t.Fatalf("unexpected JQL: %q", gotJQL)
	}
}

func TestClient_GetChildIssues_NoChildren_ReturnsEmpty(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/rest/api/3/search/jql", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"issues": []map[string]any{}, "isLast": true})
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	client := jira.NewClient(server.URL, "jane@example.com", "token123")
	children, err := client.GetChildIssues(context.Background(), "PROJ-1")
	if err != nil {
		t.Fatalf("GetChildIssues: %v", err)
	}
	if len(children) != 0 {
		t.Fatalf("expected no children, got %+v", children)
	}
}

func TestClient_GetIssuesByKeys_NoValidKeys_SkipsRequest(t *testing.T) {
	var requests int32
	mux := http.NewServeMux()
	mux.HandleFunc("/rest/api/3/search/jql", func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&requests, 1)
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	client := jira.NewClient(server.URL, "jane@example.com", "token123")
	issues, err := client.GetIssuesByKeys(context.Background(), []string{"not-a-key"})
	if err != nil {
		t.Fatalf("GetIssuesByKeys: %v", err)
	}
	if issues != nil {
		t.Fatalf("expected no issues, got %+v", issues)
	}
	if atomic.LoadInt32(&requests) != 0 {
		t.Fatalf("expected no HTTP request when there are no valid keys")
	}
}

func TestClient_SearchIssuesByText_MapsSummaryAndIssueType(t *testing.T) {
	var gotJQL, gotMaxResults string
	mux := http.NewServeMux()
	mux.HandleFunc("/rest/api/3/search/jql", func(w http.ResponseWriter, r *http.Request) {
		gotJQL = r.URL.Query().Get("jql")
		gotMaxResults = r.URL.Query().Get("maxResults")
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

	client := jira.NewClient(server.URL, "jane@example.com", "token123")
	results, err := client.SearchIssuesByText(context.Background(), "ship", 10)
	if err != nil {
		t.Fatalf("SearchIssuesByText: %v", err)
	}
	if len(results) != 1 || results[0].Key != "PROJ-1" || results[0].Summary != "Ship the thing" || results[0].IssueType != "Epic" {
		t.Fatalf("unexpected results: %+v", results)
	}
	if gotJQL != `text ~ "ship*" ORDER BY updated DESC` {
		t.Fatalf("unexpected JQL: %q", gotJQL)
	}
	if gotMaxResults != "10" {
		t.Fatalf("expected maxResults=10, got %q", gotMaxResults)
	}
}

func TestClient_SearchIssuesByText_BareKey_AlsoMatchesByKey(t *testing.T) {
	var gotJQL string
	mux := http.NewServeMux()
	mux.HandleFunc("/rest/api/3/search/jql", func(w http.ResponseWriter, r *http.Request) {
		gotJQL = r.URL.Query().Get("jql")
		_ = json.NewEncoder(w).Encode(map[string]any{"issues": []map[string]any{}})
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	client := jira.NewClient(server.URL, "jane@example.com", "token123")
	if _, err := client.SearchIssuesByText(context.Background(), "PROJ-763", 10); err != nil {
		t.Fatalf("SearchIssuesByText: %v", err)
	}
	if gotJQL != `key = PROJ-763 OR text ~ "PROJ-763*" ORDER BY updated DESC` {
		t.Fatalf("expected the JQL to also match by key, got %q", gotJQL)
	}
}

func TestClient_SearchIssuesByText_PastedURL_ExtractsTheKey(t *testing.T) {
	var gotJQL string
	mux := http.NewServeMux()
	mux.HandleFunc("/rest/api/3/search/jql", func(w http.ResponseWriter, r *http.Request) {
		gotJQL = r.URL.Query().Get("jql")
		_ = json.NewEncoder(w).Encode(map[string]any{"issues": []map[string]any{}})
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	client := jira.NewClient(server.URL, "jane@example.com", "token123")
	query := "https://example.atlassian.net/browse/PROJ-763"
	if _, err := client.SearchIssuesByText(context.Background(), query, 10); err != nil {
		t.Fatalf("SearchIssuesByText: %v", err)
	}
	if !strings.Contains(gotJQL, "key = PROJ-763") {
		t.Fatalf("expected the key extracted from the pasted URL to be searched, got %q", gotJQL)
	}
}

func TestClient_SearchIssuesByText_BlankQuery_SkipsRequest(t *testing.T) {
	var requests int32
	mux := http.NewServeMux()
	mux.HandleFunc("/rest/api/3/search/jql", func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&requests, 1)
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	client := jira.NewClient(server.URL, "jane@example.com", "token123")
	results, err := client.SearchIssuesByText(context.Background(), "   ", 10)
	if err != nil {
		t.Fatalf("SearchIssuesByText: %v", err)
	}
	if results != nil {
		t.Fatalf("expected no results for a blank query, got %+v", results)
	}
	if atomic.LoadInt32(&requests) != 0 {
		t.Fatalf("expected no HTTP request for a blank query")
	}
}

func TestClient_SearchIssuesByText_ClampsOutOfRangeMaxResults(t *testing.T) {
	var gotMaxResults string
	mux := http.NewServeMux()
	mux.HandleFunc("/rest/api/3/search/jql", func(w http.ResponseWriter, r *http.Request) {
		gotMaxResults = r.URL.Query().Get("maxResults")
		_ = json.NewEncoder(w).Encode(map[string]any{"issues": []map[string]any{}})
	})
	server := httptest.NewServer(mux)
	defer server.Close()

	client := jira.NewClient(server.URL, "jane@example.com", "token123")
	if _, err := client.SearchIssuesByText(context.Background(), "ship", 1000); err != nil {
		t.Fatalf("SearchIssuesByText: %v", err)
	}
	if gotMaxResults != "20" {
		t.Fatalf("expected out-of-range maxResults to clamp to 20, got %q", gotMaxResults)
	}
}
