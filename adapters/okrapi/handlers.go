// Package okrapi is the HTTP surface of the OKR module: the team registry
// it scopes work to, the blob its tree lives in, and the Jira refresh
// routes that keep progress honest.
//
// It registers onto a mux the caller owns rather than building one, so the
// same routes serve a standalone OKR application and a larger host
// application that happens to include OKRs — neither of which has to know
// about the other.
package okrapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/helmedeiros/quartermark/httpx"
	"github.com/helmedeiros/quartermark/jirasource"
	"github.com/helmedeiros/quartermark/okr"
	"github.com/helmedeiros/quartermark/org"
	"github.com/helmedeiros/quartermark/storeerr"
)

// JiraResolver hands back the Jira client configured for one team.
//
// Narrower than the host application's connector resolver on purpose: the
// OKR routes read Jira and nothing else, so requiring a GitHub client and
// deploy-workflow config to mount them would be asking for dependencies
// none of these handlers can use.
type JiraResolver interface {
	Jira(ctx context.Context, teamSlug string) (jirasource.Source, error)
}

// Mount registers the OKR routes on mux. Paths are absolute, so a host
// application gets the same URLs the standalone server serves.
func Mount(mux *http.ServeMux, store okr.Store, resolver JiraResolver) {
	mux.HandleFunc("GET /teams/{teamSlug}/okr-settings", getSettings(store))

	mux.HandleFunc("GET /teams", listTeams(store))
	mux.HandleFunc("POST /teams", createTeam(store))

	mux.HandleFunc("GET /teams/{teamSlug}/blobs/{section}", getTeamBlob(store))
	mux.HandleFunc("PUT /teams/{teamSlug}/blobs/{section}", putTeamBlob(store))

	mux.HandleFunc("POST /teams/{teamSlug}/okrs/jira-refresh", refreshOkrJira(store, resolver))
	mux.HandleFunc("POST /teams/{teamSlug}/okrs/jira-refresh-node", refreshOkrJiraNode(store, resolver))
	mux.HandleFunc("GET /teams/{teamSlug}/okrs/jira-search", searchJiraIssues(resolver))
}

func getTeamBlob(repo okr.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		data, ok, err := repo.GetTeamBlob(r.Context(), r.PathValue("teamSlug"), r.PathValue("section"))
		httpx.WriteRawOrNotFound(w, data, ok, err, storeerr.ErrNotFound)
	}
}

func putTeamBlob(repo okr.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		teamSlug, section := r.PathValue("teamSlug"), r.PathValue("section")
		httpx.PutRawBlob(w, r, func(raw json.RawMessage) error {
			return putTeamSection(r.Context(), repo, teamSlug, section, raw)
		})
	}
}

// putTeamSection persists one team blob, applying the section's own schema
// rules on the way in. Only "okrs" has a versioned schema today; every
// other section is stored exactly as the client sent it.
//
// The server stamps rather than trusting the client's version, so an older
// frontend build (or a hand-crafted payload) cannot strip the anchor off
// stored data. See okr.UpgradeBlob.
func putTeamSection(ctx context.Context, repo okr.Store, teamSlug, section string, raw []byte) error {
	if section == okrsSection {
		upgraded, _, err := okr.UpgradeBlob(raw)
		if err != nil {
			// A blob from a newer build is a conflict, not a server
			// fault: the request is well-formed and nothing here is
			// broken — the stored shape is simply ahead of this build.
			if errors.Is(err, okr.ErrFutureSchemaVersion) {
				return httpx.WithStatus(err, http.StatusConflict)
			}
			return err
		}
		raw = upgraded
	}
	return repo.PutTeamBlob(ctx, teamSlug, section, raw)
}

func listTeams(repo okr.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		teams, err := repo.ListTeams(r.Context())
		if err != nil {
			httpx.WriteError(w, http.StatusInternalServerError, err)
			return
		}
		httpx.WriteJSON(w, http.StatusOK, teams)
	}
}

func createTeam(repo okr.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var team org.Team
		if !httpx.DecodeJSON(w, r, &team) {
			return
		}
		if team.Slug == "" || team.Name == "" {
			httpx.WriteError(w, http.StatusBadRequest, errors.New("slug and name are required"))
			return
		}
		team.CreatedAt = time.Now().UTC().Format(time.RFC3339)
		if err := repo.CreateTeam(r.Context(), team); err != nil {
			if errors.Is(err, storeerr.ErrAlreadyExists) {
				httpx.WriteError(w, http.StatusConflict, err)
				return
			}
			httpx.WriteError(w, http.StatusInternalServerError, err)
			return
		}
		httpx.WriteJSON(w, http.StatusCreated, team)
	}
}
