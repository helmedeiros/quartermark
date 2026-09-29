package connectors

import (
	"encoding/json"
	"testing"
)

func TestReadingIgnoresMembersThisModuleDoesNotModel(t *testing.T) {
	raw := []byte(`{"jira":{"baseUrl":"https://example.atlassian.net","email":"a@b.c","token":"t"},
		"github":{"token":"gh"},"deployWorkflows":[{"repo":"r","workflowFile":"w.yml"}]}`)

	var config Connectors
	if err := json.Unmarshal(raw, &config); err != nil {
		t.Fatalf("a document with members this module does not model should still read: %v", err)
	}
	if config.Jira == nil || config.Jira.BaseURL != "https://example.atlassian.net" {
		t.Fatalf("jira did not decode: %+v", config.Jira)
	}
}
