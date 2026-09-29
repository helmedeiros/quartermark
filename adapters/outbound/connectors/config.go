package connectors

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
	Token   string `json:"token,omitempty"`
	BaseURL string `json:"baseUrl,omitempty"`
}

type DeployWorkflowConfig struct {
	Repo         string `json:"repo"`
	WorkflowFile string `json:"workflowFile"`
}
