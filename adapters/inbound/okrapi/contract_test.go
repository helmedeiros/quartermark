package okrapi_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"testing"

	"github.com/helmedeiros/quartermark/okr/tracker"
	"github.com/helmedeiros/quartermark/shared/timewindow"
)

type unreachableJira struct{}

var errJiraDown = errors.New("jira is unreachable")

func (unreachableJira) SearchIssuesByAssignee(context.Context, string, timewindow.Window) ([]tracker.Issue, error) {
	return nil, errJiraDown
}

func (unreachableJira) GetIssuesByKeys(context.Context, []string) ([]tracker.Issue, error) {
	return nil, errJiraDown
}

func (unreachableJira) GetChildIssues(context.Context, string) ([]tracker.ChildIssue, error) {
	return nil, errJiraDown
}

func (unreachableJira) SearchIssuesByText(context.Context, string, int) ([]tracker.IssueSummary, error) {
	return nil, errJiraDown
}

const onePlan = `{"team":"Acme","quarters":[
	{"quarterId":"2026-q3","objectives":[
		{"id":"O-1","type":"objective","title":"Ship it","status":"not_started","progress":0,"jiraKeys":["PROJ-1"]}
	]}
]}`

func storeWithPlan() *fakeStore {
	store := newFakeStore()
	store.blobs[blobKey("acme", "okrs")] = []byte(onePlan)
	return store
}

func TestTheStatusCodesAHostDependsOn(t *testing.T) {
	for _, tc := range []struct {
		name            string
		store           func() *fakeStore
		tracker         func() *fakeStore
		method, path    string
		body            string
		seed            func(*testing.T, string)
		want            int
		unreachable     bool
		withStubTracker bool
	}{
		{name: "unknown section is not found", store: newFakeStore,
			method: http.MethodGet, path: "/teams/acme/blobs/nope", want: http.StatusNotFound},

		{name: "creating a team without a name is a bad request", store: newFakeStore,
			method: http.MethodPost, path: "/teams", body: `{"slug":"acme"}`, want: http.StatusBadRequest},

		{name: "refreshing a team with no plan is not found", store: newFakeStore,
			method: http.MethodPost, path: "/teams/acme/okrs/jira-refresh",
			want: http.StatusNotFound, withStubTracker: true},

		{name: "refreshing with no tracker configured is unavailable", store: storeWithPlan,
			method: http.MethodPost, path: "/teams/acme/okrs/jira-refresh",
			want: http.StatusServiceUnavailable},

		{name: "a tracker that cannot be reached is a bad gateway", store: storeWithPlan,
			method: http.MethodPost, path: "/teams/acme/okrs/jira-refresh",
			want: http.StatusBadGateway, unreachable: true},

		{name: "searching an unreachable tracker is a bad gateway", store: storeWithPlan,
			method: http.MethodGet, path: "/teams/acme/okrs/jira-search?q=PROJ",
			want: http.StatusBadGateway, unreachable: true},

		{name: "refreshing a node without a quarterId is a bad request", store: storeWithPlan,
			method: http.MethodPost, path: "/teams/acme/okrs/jira-refresh-node",
			body: `{"nodeId":"O-1"}`, want: http.StatusBadRequest, withStubTracker: true},

		{name: "refreshing a node without a nodeId is a bad request", store: storeWithPlan,
			method: http.MethodPost, path: "/teams/acme/okrs/jira-refresh-node",
			body: `{"quarterId":"2026-q3"}`, want: http.StatusBadRequest, withStubTracker: true},

		{name: "refreshing a node that does not exist is not found", store: storeWithPlan,
			method: http.MethodPost, path: "/teams/acme/okrs/jira-refresh-node",
			body: `{"quarterId":"2026-q3","nodeId":"ghost"}`,
			want: http.StatusNotFound, withStubTracker: true},

		{name: "refreshing a node in a quarter that does not exist is not found",
			store:  storeWithPlan,
			method: http.MethodPost, path: "/teams/acme/okrs/jira-refresh-node",
			body: `{"quarterId":"2099-q1","nodeId":"O-1"}`,
			want: http.StatusNotFound, withStubTracker: true},

		{name: "refreshing a real node succeeds", store: storeWithPlan,
			method: http.MethodPost, path: "/teams/acme/okrs/jira-refresh-node",
			body: `{"quarterId":"2026-q3","nodeId":"O-1"}`,
			want: http.StatusOK, withStubTracker: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := tc.store()
			var srv = mount(t, store, noTracker{})
			if tc.unreachable {
				srv = mount(t, store, withTracker{tracker: unreachableJira{}})
			} else if tc.withStubTracker {
				srv = mount(t, store, withTracker{tracker: stubJira{issues: map[string]tracker.Issue{}}})
			}

			if got := do(t, srv, tc.method, tc.path, tc.body).StatusCode; got != tc.want {
				t.Fatalf("%s %s = %d, want %d", tc.method, tc.path, got, tc.want)
			}
		})
	}
}

func TestACreatedTeamIsReturnedWithItsTimestamp(t *testing.T) {
	srv := mount(t, newFakeStore(), noTracker{})

	resp := do(t, srv, http.MethodPost, "/teams", `{"slug":"acme","name":"Acme Squad"}`)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("POST /teams = %d, want 201", resp.StatusCode)
	}

	var created map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&created); err != nil {
		t.Fatal(err)
	}
	for _, field := range []string{"slug", "name", "createdAt"} {
		if value, ok := created[field]; !ok || value == "" {
			t.Errorf("the created team is missing %s: %v", field, created)
		}
	}
}
