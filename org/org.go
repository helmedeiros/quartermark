// Package org holds how an organisation's teams are set up: the registry
// of which teams exist, and the live-data connectors each one is wired to.
//
// Kept apart from whatever else a host application models, because a
// team registry and a Jira base URL are the same regardless of what that
// application is otherwise about.
package org

// Team is a registry entry for a team this instance tracks. Team-scoped
// data itself (OKRs, engagement, absences, routines, features, connector
// config) lives in team_blobs keyed by Slug; Team only answers "does this
// team exist".
type Team struct {
	Slug      string `json:"slug"`
	Name      string `json:"name"`
	CreatedAt string `json:"createdAt"`
}

// Connectors is a team's live-data connector configuration, stored as the
// team_blobs section "connectors". Any field may be nil or empty: a team
// with nothing configured just gets the import-only experience.
type Connectors struct {
	Jira            *JiraConfig            `json:"jira,omitempty"`
	GitHub          *GitHubConfig          `json:"github,omitempty"`
	DeployWorkflows []DeployWorkflowConfig `json:"deployWorkflows,omitempty"`
}

type JiraConfig struct {
	BaseURL string `json:"baseUrl"`
	Email   string `json:"email"`
	Token   string `json:"token"`
}

type GitHubConfig struct {
	// Token is optional. Empty means fall back to the operator's local
	// `gh auth token` (see adapters/github.TokenFromGHCLI).
	Token string `json:"token,omitempty"`
	// BaseURL is only needed for GitHub Enterprise.
	BaseURL string `json:"baseUrl,omitempty"`
}

// DeployWorkflowConfig keeps its suffix rather than shortening to
// DeployWorkflow: ingest.DeployWorkflow already exists and is a different
// thing (a resolved workflow, not its configuration).
type DeployWorkflowConfig struct {
	Repo         string `json:"repo"`
	WorkflowFile string `json:"workflowFile"`
}
