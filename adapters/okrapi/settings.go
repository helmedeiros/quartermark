package okrapi

import (
	"encoding/json"
	"net/http"

	"github.com/helmedeiros/quartermark/httpx"
	"github.com/helmedeiros/quartermark/okr"
)

// connectorsSection is where a team's live-data connector config lives.
// Read here for one non-secret field; written by the host application's
// settings page.
const connectorsSection = "connectors"

// Settings is the non-secret configuration the OKR frontend needs to
// render. It exists so the browser can build a ticket link without being
// handed the connector blob, which carries the Jira API token.
type Settings struct {
	JiraBaseURL string `json:"jiraBaseUrl"`
}

// getSettings answers with an empty base URL rather than 404 when no
// connector is configured: "Jira isn't set up" is a normal state for a
// team doing OKRs without it, and the frontend renders plain text instead
// of a link.
func getSettings(store okr.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		raw, ok, err := store.GetTeamBlob(r.Context(), r.PathValue("teamSlug"), connectorsSection)
		if err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, err)
			return
		}

		var settings Settings
		if ok {
			// Only the one field is decoded, so a token cannot leak by a
			// later field being added to the connector blob.
			var blob struct {
				Jira struct {
					BaseURL string `json:"baseUrl"`
				} `json:"jira"`
			}
			if err := json.Unmarshal(raw, &blob); err != nil {
				httpx.WriteError(w, http.StatusInternalServerError, err)
				return
			}
			settings.JiraBaseURL = blob.Jira.BaseURL
		}
		httpx.WriteJSON(w, http.StatusOK, settings)
	}
}
