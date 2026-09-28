package app

import (
	"encoding/json"
	"fmt"
)

// parseSettings reads only the one non-secret field out of the
// connector record.
//
// Decoding just that field, rather than the whole record and then
// picking, means a token cannot leak later because someone added a
// field next to it.
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
