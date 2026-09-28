package okrapi

import (
	"io"
	"net/http"
)

type settingsResponse struct {
	JiraBaseURL string `json:"jiraBaseUrl"`
}

type refreshRequest struct {
	QuarterID string `json:"quarterId,omitempty"`
	Force     bool   `json:"force,omitempty"`
}

type refreshResponse struct {
	RefreshedQuarters []string `json:"refreshedQuarters"`
	SkippedFresh      []string `json:"skippedFresh"`
	ClosedQuarters    []string `json:"closedQuarters,omitempty"`
}

type refreshNodeRequest struct {
	QuarterID string `json:"quarterId"`
	NodeID    string `json:"nodeId"`
}

type refreshNodeResponse struct {
	Refreshed bool `json:"refreshed"`
}

type searchResult struct {
	Key       string `json:"key"`
	Summary   string `json:"summary"`
	IssueType string `json:"issueType"`
}

func readAll(r *http.Request) ([]byte, error) { return io.ReadAll(r.Body) }
