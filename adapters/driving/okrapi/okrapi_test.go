package okrapi_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/helmedeiros/quartermark/adapters/driven/okrdoc"
	"github.com/helmedeiros/quartermark/adapters/driving/okrapi"
	"github.com/helmedeiros/quartermark/app"
	"github.com/helmedeiros/quartermark/okr"
	"github.com/helmedeiros/quartermark/okr/tracker"
	"github.com/helmedeiros/quartermark/org"
	"github.com/helmedeiros/quartermark/timewindow"
)

type fakeStore struct {
	teams map[string]org.Team
	blobs map[string][]byte
}

func newFakeStore() *fakeStore {
	return &fakeStore{teams: map[string]org.Team{}, blobs: map[string][]byte{}}
}

func blobKey(teamSlug, section string) string { return teamSlug + "/" + section }

func (f *fakeStore) GetSection(ctx context.Context, teamSlug, section string) ([]byte, bool, error) {
	return f.GetTeamBlob(ctx, teamSlug, section)
}

func (f *fakeStore) PutSection(ctx context.Context, teamSlug, section string, data []byte) error {
	return f.PutTeamBlob(ctx, teamSlug, section, data)
}

func (f *fakeStore) List(ctx context.Context) ([]org.Team, error) { return f.ListTeams(ctx) }

func (f *fakeStore) Get(ctx context.Context, slug string) (org.Team, error) {
	return f.GetTeam(ctx, slug)
}

func (f *fakeStore) Create(ctx context.Context, t org.Team) error { return f.CreateTeam(ctx, t) }

func (f *fakeStore) Load(ctx context.Context, teamSlug string) (okr.TeamOkrs, bool, error) {
	raw, ok, err := f.GetTeamBlob(ctx, teamSlug, "okrs")
	if err != nil || !ok {
		return okr.TeamOkrs{}, ok, err
	}
	doc, err := okrdoc.Parse(raw)
	if err != nil {
		return okr.TeamOkrs{}, true, err
	}
	plan, err := doc.Domain()
	return plan, true, err
}

func (f *fakeStore) Save(ctx context.Context, teamSlug string, plan okr.TeamOkrs) error {
	raw, ok, err := f.GetTeamBlob(ctx, teamSlug, "okrs")
	if err != nil || !ok {
		return err
	}
	doc, err := okrdoc.Parse(raw)
	if err != nil {
		return err
	}
	if err := doc.Apply(plan); err != nil {
		return err
	}
	updated, err := doc.Bytes()
	if err != nil {
		return err
	}
	return f.PutTeamBlob(ctx, teamSlug, "okrs", updated)
}

func (f *fakeStore) GetTeamBlob(_ context.Context, teamSlug, section string) ([]byte, bool, error) {
	b, ok := f.blobs[blobKey(teamSlug, section)]
	return b, ok, nil
}

func (f *fakeStore) PutTeamBlob(_ context.Context, teamSlug, section string, data []byte) error {
	f.blobs[blobKey(teamSlug, section)] = data
	return nil
}

func (f *fakeStore) ListTeams(context.Context) ([]org.Team, error) {
	out := make([]org.Team, 0, len(f.teams))
	for _, t := range f.teams {
		out = append(out, t)
	}
	return out, nil
}

func (f *fakeStore) GetTeam(_ context.Context, slug string) (org.Team, error) {
	t, ok := f.teams[slug]
	if !ok {
		return org.Team{}, okr.ErrNotFound
	}
	return t, nil
}

func (f *fakeStore) CreateTeam(_ context.Context, t org.Team) error {
	if _, exists := f.teams[t.Slug]; exists {
		return okr.ErrAlreadyExists
	}
	f.teams[t.Slug] = t
	return nil
}

type noTracker struct{}

func (noTracker) For(context.Context, string) (tracker.Source, error) { return nil, nil }

func mount(t *testing.T, store *fakeStore, tracker app.Tracker) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	okrapi.Mount(mux, app.New(store, store, store, tracker))
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func do(t *testing.T, srv *httptest.Server, method, path, body string) *http.Response {
	t.Helper()
	var r *http.Request
	var err error
	if body == "" {
		r, err = http.NewRequest(method, srv.URL+path, nil)
	} else {
		r, err = http.NewRequest(method, srv.URL+path, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
	}
	if err != nil {
		t.Fatal(err)
	}
	resp, err := http.DefaultClient.Do(r)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = resp.Body.Close() })
	return resp
}

func TestMountServesTheTeamRegistry(t *testing.T) {
	store := newFakeStore()
	srv := mount(t, store, noTracker{})

	if got := do(t, srv, http.MethodPost, "/teams", `{"slug":"acme","name":"Acme Squad"}`).StatusCode; got != http.StatusCreated {
		t.Fatalf("POST /teams = %d, want 201", got)
	}

	resp := do(t, srv, http.MethodGet, "/teams", "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET /teams = %d", resp.StatusCode)
	}
	var teams []org.Team
	if err := json.NewDecoder(resp.Body).Decode(&teams); err != nil {
		t.Fatal(err)
	}
	if len(teams) != 1 || teams[0].Slug != "acme" {
		t.Fatalf("teams = %+v", teams)
	}
}

func TestCreatingTheSameTeamTwiceConflicts(t *testing.T) {
	srv := mount(t, newFakeStore(), noTracker{})
	do(t, srv, http.MethodPost, "/teams", `{"slug":"acme","name":"Acme Squad"}`)

	if got := do(t, srv, http.MethodPost, "/teams", `{"slug":"acme","name":"Acme Squad"}`).StatusCode; got != http.StatusConflict {
		t.Fatalf("duplicate POST /teams = %d, want 409", got)
	}
}

func TestTeamRequiresSlugAndName(t *testing.T) {
	srv := mount(t, newFakeStore(), noTracker{})
	if got := do(t, srv, http.MethodPost, "/teams", `{"slug":"acme"}`).StatusCode; got != http.StatusBadRequest {
		t.Fatalf("POST /teams without a name = %d, want 400", got)
	}
}

func TestBlobRoundTripAndMissingSection(t *testing.T) {
	srv := mount(t, newFakeStore(), noTracker{})

	if got := do(t, srv, http.MethodGet, "/teams/acme/blobs/routines", "").StatusCode; got != http.StatusNotFound {
		t.Fatalf("GET of an absent section = %d, want 404", got)
	}
	if got := do(t, srv, http.MethodPut, "/teams/acme/blobs/routines", `{"hello":"world"}`).StatusCode; got != http.StatusNoContent {
		t.Fatalf("PUT = %d, want 204", got)
	}
	resp := do(t, srv, http.MethodGet, "/teams/acme/blobs/routines", "")
	var got map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	if got["hello"] != "world" {
		t.Fatalf("round-trip lost the body: %+v", got)
	}
}

func TestOkrsBlobIsStampedOnWrite(t *testing.T) {
	store := newFakeStore()
	srv := mount(t, store, noTracker{})

	do(t, srv, http.MethodPut, "/teams/acme/blobs/okrs", `{"team":"Acme","quarters":[]}`)

	stored := store.blobs[blobKey("acme", "okrs")]
	if v := okr.BlobVersion(stored); v != okr.SchemaVersion {
		t.Fatalf("stored version = %d, want %d", v, okr.SchemaVersion)
	}
}

func TestFutureVersionOkrsBlobConflicts(t *testing.T) {
	srv := mount(t, newFakeStore(), noTracker{})
	body := `{"schemaVersion":9999,"quarters":[]}`
	if got := do(t, srv, http.MethodPut, "/teams/acme/blobs/okrs", body).StatusCode; got != http.StatusConflict {
		t.Fatalf("PUT of a future-version blob = %d, want 409", got)
	}
}

func TestSettingsExposesTheJiraHostButNotTheToken(t *testing.T) {
	store := newFakeStore()
	store.blobs[blobKey("acme", "connectors")] = []byte(
		`{"jira":{"baseUrl":"https://example.atlassian.net","email":"bot@example.com","token":"secret-token"}}`)
	srv := mount(t, store, noTracker{})

	resp := do(t, srv, http.MethodGet, "/teams/acme/okr-settings", "")
	var got struct {
		JiraBaseURL string `json:"jiraBaseUrl"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	if got.JiraBaseURL != "https://example.atlassian.net" {
		t.Fatalf("jiraBaseUrl = %q", got.JiraBaseURL)
	}
	store.blobs[blobKey("acme", "connectors")] = []byte(
		`{"jira":{"baseUrl":"https://example.atlassian.net","token":"secret-token"}}`)
	raw := do(t, srv, http.MethodGet, "/teams/acme/okr-settings", "")
	buf := make([]byte, 512)
	n, _ := raw.Body.Read(buf)
	if strings.Contains(string(buf[:n]), "secret-token") {
		t.Fatalf("the token reached the wire: %s", buf[:n])
	}
}

func TestJiraRoutesReportUnconfiguredRatherThanFailing(t *testing.T) {
	srv := mount(t, newFakeStore(), noTracker{})

	for _, tc := range []struct{ method, path string }{
		{http.MethodPost, "/teams/acme/okrs/jira-refresh"},
		{http.MethodGet, "/teams/acme/okrs/jira-search?q=PROJ"},
	} {
		if got := do(t, srv, tc.method, tc.path, "").StatusCode; got != http.StatusServiceUnavailable {
			t.Fatalf("%s %s = %d, want 503", tc.method, tc.path, got)
		}
	}
}

type stubJira struct{ issues map[string]tracker.Issue }

func (s stubJira) SearchIssuesByAssignee(context.Context, string, timewindow.Window) ([]tracker.Issue, error) {
	return nil, nil
}

func (s stubJira) GetIssuesByKeys(_ context.Context, keys []string) ([]tracker.Issue, error) {
	out := make([]tracker.Issue, 0, len(keys))
	for _, k := range keys {
		if issue, ok := s.issues[k]; ok {
			out = append(out, issue)
		}
	}
	return out, nil
}

func (s stubJira) GetChildIssues(context.Context, string) ([]tracker.ChildIssue, error) {
	return nil, nil
}

func (s stubJira) SearchIssuesByText(_ context.Context, _ string, _ int) ([]tracker.IssueSummary, error) {
	return []tracker.IssueSummary{{Key: "PROJ-1", Summary: "Ship it", IssueType: "Epic"}}, nil
}

type withTracker struct{ tracker tracker.Source }

func (w withTracker) For(context.Context, string) (tracker.Source, error) {
	return w.tracker, nil
}

func TestJiraRefreshWritesProgressBackIntoTheBlob(t *testing.T) {
	store := newFakeStore()
	store.blobs[blobKey("acme", "okrs")] = []byte(`{"team":"Acme","quarters":[
		{"quarterId":"2026-q3","objectives":[
			{"id":"O-1","type":"objective","title":"Ship it","status":"not_started","progress":0,"jiraKeys":["PROJ-1"]}
		]}
	]}`)
	jira := stubJira{issues: map[string]tracker.Issue{
		"PROJ-1": {Key: "PROJ-1", IssueType: "Epic", Status: "Done", StatusCategory: "done", Summary: "Ship it"},
	}}
	srv := mount(t, store, withTracker{tracker: jira})

	resp := do(t, srv, http.MethodPost, "/teams/acme/okrs/jira-refresh", `{"force":true}`)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("jira-refresh = %d, want 200", resp.StatusCode)
	}
	var result struct {
		RefreshedQuarters []string `json:"refreshedQuarters"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatal(err)
	}
	if len(result.RefreshedQuarters) != 1 || result.RefreshedQuarters[0] != "2026-q3" {
		t.Fatalf("refreshedQuarters = %+v", result.RefreshedQuarters)
	}

	stored := string(store.blobs[blobKey("acme", "okrs")])
	if !strings.Contains(stored, "jiraRefreshedAt") {
		t.Fatalf("refresh timestamp was not persisted: %s", stored)
	}
	if v := okr.BlobVersion(store.blobs[blobKey("acme", "okrs")]); v != okr.SchemaVersion {
		t.Fatalf("version after refresh = %d, want %d", v, okr.SchemaVersion)
	}
}

func TestJiraSearchReturnsMatches(t *testing.T) {
	srv := mount(t, newFakeStore(), withTracker{tracker: stubJira{}})

	resp := do(t, srv, http.MethodGet, "/teams/acme/okrs/jira-search?q=PROJ", "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("jira-search = %d", resp.StatusCode)
	}
	body := make([]byte, 512)
	n, _ := resp.Body.Read(body)
	if !strings.Contains(string(body[:n]), "PROJ-1") {
		t.Fatalf("search result missing the match: %s", body[:n])
	}
}

func TestJiraRefreshOnAnAbsentBlobIsNotFound(t *testing.T) {
	srv := mount(t, newFakeStore(), withTracker{tracker: stubJira{}})
	if got := do(t, srv, http.MethodPost, "/teams/acme/okrs/jira-refresh", `{}`).StatusCode; got != http.StatusNotFound {
		t.Fatalf("refresh with no okrs blob = %d, want 404", got)
	}
}
