package connectors

type Connectors struct {
	Jira *JiraConfig `json:"jira,omitempty"`
}

type JiraConfig struct {
	BaseURL string `json:"baseUrl"`
	Email   string `json:"email"`
	Token   string `json:"token"`
}
