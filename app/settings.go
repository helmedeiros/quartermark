package app

import (
	"encoding/json"
	"fmt"
)

func parseSettings(raw []byte) (Settings, error) {
	var record struct {
		Jira struct {
			BaseURL string `json:"baseUrl"`
		} `json:"jira"`
	}
	if err := json.Unmarshal(raw, &record); err != nil {
		return Settings{}, fmt.Errorf("app: reading connector settings: %w", err)
	}
	return Settings{TrackerBaseURL: record.Jira.BaseURL}, nil
}
