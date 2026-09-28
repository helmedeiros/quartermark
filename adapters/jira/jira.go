package jira

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/helmedeiros/quartermark/httpx"
)

const (
	maxPages    = 5
	maxAttempts = 3
	backoffBase = 500 * time.Millisecond
	requestGap  = 500 * time.Millisecond
)

type Client struct {
	httpClient   *http.Client
	baseURL      string
	email, token string
	limiter      *rateLimiter

	statusCatOnce sync.Once
	statusCatByID map[string]string
	statusCatErr  error

	sprintFieldOnce sync.Once
	sprintFieldID   string
	sprintFieldErr  error
}

func NewClient(baseURL, email, token string) *Client {
	return &Client{
		httpClient: &http.Client{Timeout: 20 * time.Second},
		baseURL:    strings.TrimRight(baseURL, "/"),
		email:      email,
		token:      token,
		limiter:    &rateLimiter{gap: requestGap},
	}
}

type rateLimiter struct {
	mu   sync.Mutex
	last time.Time
	gap  time.Duration
}

func (r *rateLimiter) wait(ctx context.Context) error {
	r.mu.Lock()
	now := time.Now()
	wait := time.Duration(0)
	if since := now.Sub(r.last); since < r.gap {
		wait = r.gap - since
	}
	r.last = now.Add(wait)
	r.mu.Unlock()

	if wait <= 0 {
		return nil
	}
	select {
	case <-time.After(wait):
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (c *Client) authHeader() string {
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(c.email+":"+c.token))
}

func (c *Client) do(ctx context.Context, req *http.Request) (*http.Response, error) {
	req.Header.Set("Authorization", c.authHeader())
	req.Header.Set("Accept", "application/json")

	var lastErr error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		if err := c.limiter.wait(ctx); err != nil {
			return nil, err
		}
		resp, err := c.httpClient.Do(req)
		switch {
		case err != nil:
			lastErr = err
		case resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500:
			lastErr = fmt.Errorf("jira API returned status %d", resp.StatusCode)
			_ = resp.Body.Close()
		default:
			return resp, nil
		}

		if attempt == maxAttempts {
			break
		}
		sleep := backoffBase << (attempt - 1)
		jittered := time.Duration(float64(sleep) * (0.5 + rand.Float64()*0.5))
		select {
		case <-time.After(jittered):
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	return nil, fmt.Errorf("jira request failed after %d attempts: %w", maxAttempts, lastErr)
}

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

type historyItem struct {
	Field        string `json:"field"`
	ToStatusID   string `json:"to"`
	ToStatusName string `json:"toString"`
}

type history struct {
	Created jiraTime      `json:"created"`
	Items   []historyItem `json:"items"`
}

type jiraTime time.Time

const jiraTimeLayout = "2006-01-02T15:04:05.000-0700"

func (t *jiraTime) UnmarshalJSON(data []byte) error {
	s := strings.Trim(string(data), `"`)
	if s == "" || s == "null" {
		return nil
	}
	parsed, err := time.Parse(jiraTimeLayout, s)
	if err != nil {
		parsed, err = time.Parse(time.RFC3339, s)
	}
	if err != nil {
		parsed, err = time.Parse("2006-01-02", s)
	}
	if err != nil {
		return fmt.Errorf("parse jira timestamp %q: %w", s, err)
	}
	*t = jiraTime(parsed)
	return nil
}

func (t jiraTime) Time() time.Time { return time.Time(t) }

func jiraTimePtr(t *jiraTime) *time.Time {
	if t == nil {
		return nil
	}
	converted := t.Time()
	return &converted
}

type jiraSearchPage[T any] struct {
	Issues        []T    `json:"issues"`
	NextPageToken string `json:"nextPageToken"`
	IsLast        *bool  `json:"isLast"`
}

func paginateJiraSearch[T, R any](
	ctx context.Context,
	c *Client,
	jql, fields, expand string,
	toItems func([]T) []R,
) ([]R, error) {
	var out []R
	nextPageToken := ""
	for page := 1; page <= maxPages; page++ {
		q := url.Values{}
		q.Set("jql", jql)
		q.Set("fields", fields)
		if expand != "" {
			q.Set("expand", expand)
		}
		q.Set("maxResults", "100")
		if nextPageToken != "" {
			q.Set("nextPageToken", nextPageToken)
		}
		reqURL := fmt.Sprintf("%s/rest/api/3/search/jql?%s", c.baseURL, q.Encode())
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
		if err != nil {
			return out, err
		}
		resp, err := c.do(ctx, req)
		if err != nil {
			return out, err
		}

		var body jiraSearchPage[T]
		if err := httpx.DecodeAndClose(resp, &body, "jira"); err != nil {
			return out, err
		}

		out = append(out, toItems(body.Issues)...)

		if body.NextPageToken == "" || (body.IsLast != nil && *body.IsLast) || len(body.Issues) < 100 {
			break
		}
		nextPageToken = body.NextPageToken
	}
	return out, nil
}

func (c *Client) SearchIssuesByAssignee(ctx context.Context, accountID string, since, until time.Time) ([]Issue, error) {
	if accountID == "" {
		return nil, nil
	}
	jql := fmt.Sprintf(`assignee = "%s" AND resolved >= "%s" AND resolved <= "%s" ORDER BY resolved`,
		accountID, since.Format("2006-01-02"), until.Format("2006-01-02"))

	categoryByStatusID := c.statusCategoriesByID(ctx)

	type item struct {
		Key    string `json:"key"`
		Fields struct {
			IssueType struct {
				Name string `json:"name"`
			} `json:"issuetype"`
			Status struct {
				Name string `json:"name"`
			} `json:"status"`
			Created        jiraTime  `json:"created"`
			Resolutiondate *jiraTime `json:"resolutiondate"`
		} `json:"fields"`
		Changelog *struct {
			Histories []history `json:"histories"`
		} `json:"changelog"`
	}

	return paginateJiraSearch(ctx, c, jql, "issuetype,status,created,resolutiondate", "changelog", func(items []item) []Issue {
		out := make([]Issue, 0, len(items))
		for _, it := range items {
			issue := Issue{
				Key:       it.Key,
				IssueType: it.Fields.IssueType.Name,
				Status:    it.Fields.Status.Name,
				Created:   it.Fields.Created.Time(),
				Resolved:  jiraTimePtr(it.Fields.Resolutiondate),
			}
			if it.Changelog != nil {
				issue.InProgressAt, issue.DoneAt = deriveTransitions(it.Changelog.Histories, categoryByStatusID, issue.Resolved != nil)
			}
			out = append(out, issue)
		}
		return out
	})
}

var jiraKeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]*-[0-9]+$`)
var jiraKeyEmbeddedPattern = regexp.MustCompile(`[A-Z][A-Z0-9_]*-[0-9]+`)

func embeddedJiraKey(query string) string {
	return jiraKeyEmbeddedPattern.FindString(strings.ToUpper(query))
}

func validJiraKeys(keys []string) []string {
	valid := make([]string, 0, len(keys))
	for _, k := range keys {
		if jiraKeyPattern.MatchString(k) {
			valid = append(valid, k)
		}
	}
	return valid
}

func (c *Client) GetIssuesByKeys(ctx context.Context, keys []string) ([]Issue, error) {
	valid := validJiraKeys(keys)
	if len(valid) == 0 {
		return nil, nil
	}
	jql := fmt.Sprintf("key in (%s)", strings.Join(valid, ","))

	categoryByStatusID := c.statusCategoriesByID(ctx)
	sprintFieldID := c.resolvedSprintFieldID(ctx)

	type item struct {
		Key       string          `json:"key"`
		Fields    json.RawMessage `json:"fields"`
		Changelog *struct {
			Histories []history `json:"histories"`
		} `json:"changelog"`
	}

	fields := "issuetype,status,created,resolutiondate,duedate,summary,assignee,labels"
	if sprintFieldID != "" {
		fields += "," + sprintFieldID
	}

	return paginateJiraSearch(ctx, c, jql, fields, "changelog", func(items []item) []Issue {
		out := make([]Issue, 0, len(items))
		for _, it := range items {
			var f struct {
				IssueType struct {
					Name string `json:"name"`
				} `json:"issuetype"`
				Status struct {
					Name           string `json:"name"`
					StatusCategory struct {
						Key string `json:"key"`
					} `json:"statusCategory"`
				} `json:"status"`
				Summary  string `json:"summary"`
				Assignee *struct {
					DisplayName string `json:"displayName"`
				} `json:"assignee"`
				Labels         []string  `json:"labels"`
				Created        jiraTime  `json:"created"`
				Resolutiondate *jiraTime `json:"resolutiondate"`
				Duedate        *jiraTime `json:"duedate"`
			}
			_ = json.Unmarshal(it.Fields, &f)

			issue := Issue{
				Key:            it.Key,
				IssueType:      f.IssueType.Name,
				Status:         f.Status.Name,
				StatusCategory: f.Status.StatusCategory.Key,
				Summary:        f.Summary,
				Labels:         f.Labels,
				Created:        f.Created.Time(),
				Resolved:       jiraTimePtr(f.Resolutiondate),
				DueDate:        jiraTimePtr(f.Duedate),
			}
			if f.Assignee != nil {
				issue.Assignee = f.Assignee.DisplayName
			}
			if sprintFieldID != "" {
				var byField map[string]json.RawMessage
				if json.Unmarshal(it.Fields, &byField) == nil {
					issue.Sprints = toSprints(byField[sprintFieldID])
				}
			}
			if it.Changelog != nil {
				issue.InProgressAt, issue.DoneAt = deriveTransitions(it.Changelog.Histories, categoryByStatusID, issue.Resolved != nil)
			}
			out = append(out, issue)
		}
		return out
	})
}

type IssueSummary struct {
	Key       string
	Summary   string
	IssueType string
}

func (c *Client) SearchIssuesByText(ctx context.Context, query string, maxResults int) ([]IssueSummary, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return nil, nil
	}
	if maxResults <= 0 || maxResults > 50 {
		maxResults = 20
	}
	jql := fmt.Sprintf("text ~ %q ORDER BY updated DESC", query+"*")
	if key := embeddedJiraKey(query); key != "" {
		jql = fmt.Sprintf("key = %s OR text ~ %q ORDER BY updated DESC", key, query+"*")
	}

	q := url.Values{}
	q.Set("jql", jql)
	q.Set("fields", "summary,issuetype")
	q.Set("maxResults", strconv.Itoa(maxResults))
	reqURL := fmt.Sprintf("%s/rest/api/3/search/jql?%s", c.baseURL, q.Encode())
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.do(ctx, req)
	if err != nil {
		return nil, err
	}

	var body struct {
		Issues []struct {
			Key    string `json:"key"`
			Fields struct {
				Summary   string `json:"summary"`
				IssueType struct {
					Name string `json:"name"`
				} `json:"issuetype"`
			} `json:"fields"`
		} `json:"issues"`
	}
	if err := httpx.DecodeAndClose(resp, &body, "jira"); err != nil {
		return nil, err
	}

	out := make([]IssueSummary, 0, len(body.Issues))
	for _, it := range body.Issues {
		out = append(out, IssueSummary{
			Key:       it.Key,
			Summary:   it.Fields.Summary,
			IssueType: it.Fields.IssueType.Name,
		})
	}
	return out, nil
}

type ChildIssue struct {
	Created  time.Time
	Resolved *time.Time
}

func (c *Client) GetChildIssues(ctx context.Context, key string) ([]ChildIssue, error) {
	if !jiraKeyPattern.MatchString(key) {
		return nil, nil
	}
	jql := fmt.Sprintf(`parent = "%s"`, key)

	type item struct {
		Fields struct {
			Created        jiraTime  `json:"created"`
			Resolutiondate *jiraTime `json:"resolutiondate"`
		} `json:"fields"`
	}

	return paginateJiraSearch(ctx, c, jql, "created,resolutiondate", "", func(items []item) []ChildIssue {
		out := make([]ChildIssue, 0, len(items))
		for _, it := range items {
			out = append(out, ChildIssue{
				Created:  it.Fields.Created.Time(),
				Resolved: jiraTimePtr(it.Fields.Resolutiondate),
			})
		}
		return out
	})
}

func (c *Client) statusCategoriesByID(ctx context.Context) map[string]string {
	c.statusCatOnce.Do(func() {
		c.statusCatByID, c.statusCatErr = c.fetchStatusCategories(ctx)
	})
	return c.statusCatByID
}

func (c *Client) fetchStatusCategories(ctx context.Context) (map[string]string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/rest/api/3/status", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.do(ctx, req)
	if err != nil {
		return nil, err
	}
	var statuses []struct {
		ID             string `json:"id"`
		StatusCategory struct {
			Key string `json:"key"`
		} `json:"statusCategory"`
	}
	if err := httpx.DecodeAndClose(resp, &statuses, "jira"); err != nil {
		return nil, err
	}
	out := make(map[string]string, len(statuses))
	for _, s := range statuses {
		out[s.ID] = s.StatusCategory.Key
	}
	return out, nil
}

const sprintCustomFieldSchema = "com.pyxis.greenhopper.jira:gh-sprint"

func (c *Client) resolvedSprintFieldID(ctx context.Context) string {
	c.sprintFieldOnce.Do(func() {
		c.sprintFieldID, c.sprintFieldErr = c.fetchSprintFieldID(ctx)
	})
	return c.sprintFieldID
}

func (c *Client) fetchSprintFieldID(ctx context.Context) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/rest/api/3/field", nil)
	if err != nil {
		return "", err
	}
	resp, err := c.do(ctx, req)
	if err != nil {
		return "", err
	}
	var fields []struct {
		ID     string `json:"id"`
		Schema *struct {
			Custom string `json:"custom"`
		} `json:"schema"`
	}
	if err := httpx.DecodeAndClose(resp, &fields, "jira"); err != nil {
		return "", err
	}
	for _, f := range fields {
		if f.Schema != nil && f.Schema.Custom == sprintCustomFieldSchema {
			return f.ID, nil
		}
	}
	return "", nil
}

type jiraSprintField struct {
	Name      string    `json:"name"`
	StartDate *jiraTime `json:"startDate"`
	EndDate   *jiraTime `json:"endDate"`
}

func toSprints(raw json.RawMessage) []Sprint {
	if len(raw) == 0 {
		return nil
	}
	var fields []jiraSprintField
	if err := json.Unmarshal(raw, &fields); err != nil {
		return nil
	}
	out := make([]Sprint, 0, len(fields))
	for _, f := range fields {
		out = append(out, Sprint{
			Name:      f.Name,
			StartDate: jiraTimePtr(f.StartDate),
			EndDate:   jiraTimePtr(f.EndDate),
		})
	}
	return out
}

func chronological(histories []history) []history {
	sorted := make([]history, len(histories))
	copy(sorted, histories)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Created.Time().Before(sorted[j].Created.Time()) })
	return sorted
}

func deriveTransitions(histories []history, categoryByStatusID map[string]string, resolved bool) (inProgressAt, doneAt *time.Time) {
	for _, h := range chronological(histories) {
		for _, item := range h.Items {
			if item.Field != "status" {
				continue
			}
			switch categoryByStatusID[item.ToStatusID] {
			case "indeterminate":
				if inProgressAt == nil {
					t := h.Created.Time()
					inProgressAt = &t
				}
			case "done":
				if resolved {
					t := h.Created.Time()
					doneAt = &t
				}
			}
		}
	}
	return inProgressAt, doneAt
}
