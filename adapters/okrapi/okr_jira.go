package okrapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/helmedeiros/quartermark/httpx"
	"github.com/helmedeiros/quartermark/okr"
)

// okrsSection is the team_blobs section holding the OKR tree. Named once
// because both the generic blob route and the Jira refresh handlers below
// key off it.
const okrsSection = "okrs"

type jiraRefreshRequest struct {
	QuarterID string `json:"quarterId,omitempty"`
	Force     bool   `json:"force,omitempty"`
}

type jiraRefreshResult struct {
	RefreshedQuarters []string `json:"refreshedQuarters"`
	SkippedFresh      []string `json:"skippedFresh"`
	ClosedQuarters    []string `json:"closedQuarters,omitempty"`
}

func refreshOkrJira(repo okr.Store, resolver JiraResolver) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		teamSlug := r.PathValue("teamSlug")
		jira, err := resolver.Jira(r.Context(), teamSlug)
		if err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, err)
			return
		}
		if jira == nil {
			httpx.WriteError(w, http.StatusServiceUnavailable, fmt.Errorf("jira is not configured for team %s", teamSlug))
			return
		}

		var req jiraRefreshRequest
		if body, _ := readAllOptional(r); len(body) > 0 {
			if err := json.Unmarshal(body, &req); err != nil {
				httpx.WriteError(w, http.StatusBadRequest, fmt.Errorf("invalid JSON body: %w", err))
				return
			}
		}

		raw, ok, err := repo.GetTeamBlob(r.Context(), teamSlug, okrsSection)
		if err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, err)
			return
		}
		if !ok {
			httpx.WriteError(w, http.StatusNotFound, errors.New("no okrs blob for this team"))
			return
		}

		var doc map[string]any
		if err := json.Unmarshal(raw, &doc); err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, fmt.Errorf("parse okrs blob: %w", err))
			return
		}
		quarters, _ := doc["quarters"].([]any)

		result := jiraRefreshResult{RefreshedQuarters: []string{}, SkippedFresh: []string{}}
		now := time.Now().UTC()

		for _, qAny := range quarters {
			quarter, ok := qAny.(map[string]any)
			if !ok {
				continue
			}
			quarterID, _ := quarter["quarterId"].(string)
			if req.QuarterID != "" && quarterID != req.QuarterID {
				continue
			}

			if !req.Force && okr.IsRefreshFresh(quarter["jiraRefreshedAt"], now) {
				result.SkippedFresh = append(result.SkippedFresh, quarterID)
				continue
			}

			asOf, err := okr.RefreshQuarterFromJira(r.Context(), jira, quarter, now)
			if err != nil {
				httpx.WriteError(w, http.StatusBadGateway, err)
				return
			}
			quarter["jiraRefreshedAt"] = now.Format(time.RFC3339)
			quarter["jiraAsOf"] = asOf.Format(time.RFC3339)
			result.RefreshedQuarters = append(result.RefreshedQuarters, quarterID)
			if asOf.Before(now) {
				result.ClosedQuarters = append(result.ClosedQuarters, quarterID)
			}
		}

		updated, err := json.Marshal(doc)
		if err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, fmt.Errorf("marshal okrs blob: %w", err))
			return
		}
		if err := putTeamSection(r.Context(), repo, teamSlug, okrsSection, updated); err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, err)
			return
		}

		httpx.WriteJSON(w, http.StatusOK, result)
	}
}

type jiraRefreshNodeRequest struct {
	QuarterID string `json:"quarterId"`
	NodeID    string `json:"nodeId"`
}

func refreshOkrJiraNode(repo okr.Store, resolver JiraResolver) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		teamSlug := r.PathValue("teamSlug")
		jira, err := resolver.Jira(r.Context(), teamSlug)
		if err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, err)
			return
		}
		if jira == nil {
			httpx.WriteError(w, http.StatusServiceUnavailable, fmt.Errorf("jira is not configured for team %s", teamSlug))
			return
		}

		var req jiraRefreshNodeRequest
		if !httpx.DecodeJSON(w, r, &req) {
			return
		}
		if req.QuarterID == "" || req.NodeID == "" {
			httpx.WriteError(w, http.StatusBadRequest, errors.New("quarterId and nodeId are required"))
			return
		}

		raw, ok, err := repo.GetTeamBlob(r.Context(), teamSlug, okrsSection)
		if err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, err)
			return
		}
		if !ok {
			httpx.WriteError(w, http.StatusNotFound, errors.New("no okrs blob for this team"))
			return
		}

		var doc map[string]any
		if err := json.Unmarshal(raw, &doc); err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, fmt.Errorf("parse okrs blob: %w", err))
			return
		}
		quarters, _ := doc["quarters"].([]any)
		var quarter map[string]any
		for _, qAny := range quarters {
			q, ok := qAny.(map[string]any)
			if !ok {
				continue
			}
			if qid, _ := q["quarterId"].(string); qid == req.QuarterID {
				quarter = q
				break
			}
		}
		if quarter == nil {
			httpx.WriteError(w, http.StatusNotFound, fmt.Errorf("quarter %s not found", req.QuarterID))
			return
		}

		found, err := okr.RefreshNodeFromJira(r.Context(), jira, quarter, req.NodeID, time.Now().UTC())
		if err != nil {
			httpx.WriteError(w, http.StatusBadGateway, err)
			return
		}
		if !found {
			httpx.WriteError(w, http.StatusNotFound, fmt.Errorf("node %s not found in quarter %s", req.NodeID, req.QuarterID))
			return
		}

		updated, err := json.Marshal(doc)
		if err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, fmt.Errorf("marshal okrs blob: %w", err))
			return
		}
		if err := putTeamSection(r.Context(), repo, teamSlug, okrsSection, updated); err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, err)
			return
		}

		httpx.WriteJSON(w, http.StatusOK, map[string]bool{"refreshed": true})
	}
}

type jiraSearchResultItem struct {
	Key       string `json:"key"`
	Summary   string `json:"summary"`
	IssueType string `json:"issueType"`
}

func searchJiraIssues(resolver JiraResolver) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		teamSlug := r.PathValue("teamSlug")
		jira, err := resolver.Jira(r.Context(), teamSlug)
		if err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, err)
			return
		}
		if jira == nil {
			httpx.WriteError(w, http.StatusServiceUnavailable, fmt.Errorf("jira is not configured for team %s", teamSlug))
			return
		}
		query := r.URL.Query().Get("q")
		results, err := jira.SearchIssuesByText(r.Context(), query, 20)
		if err != nil {
			httpx.WriteError(w, http.StatusBadGateway, fmt.Errorf("search jira: %w", err))
			return
		}
		out := make([]jiraSearchResultItem, len(results))
		for i, res := range results {
			out[i] = jiraSearchResultItem{Key: res.Key, Summary: res.Summary, IssueType: res.IssueType}
		}
		httpx.WriteJSON(w, http.StatusOK, out)
	}
}

func readAllOptional(r *http.Request) ([]byte, error) {
	if r.Body == nil {
		return nil, nil
	}
	defer func() { _ = r.Body.Close() }()
	return io.ReadAll(r.Body)
}
