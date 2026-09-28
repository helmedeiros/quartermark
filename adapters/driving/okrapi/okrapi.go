package okrapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/helmedeiros/quartermark/app"
	"github.com/helmedeiros/quartermark/httpx"
	"github.com/helmedeiros/quartermark/okr"
	"github.com/helmedeiros/quartermark/org"
	"github.com/helmedeiros/quartermark/storeerr"
)

const okrsSection = "okrs"

func Mount(mux *http.ServeMux, service *app.Service) {
	mux.HandleFunc("GET /teams", listTeams(service))
	mux.HandleFunc("POST /teams", createTeam(service))

	mux.HandleFunc("GET /teams/{teamSlug}/okr-settings", readSettings(service))
	mux.HandleFunc("GET /teams/{teamSlug}/blobs/{section}", readSection(service))
	mux.HandleFunc("PUT /teams/{teamSlug}/blobs/{section}", writeSection(service))

	mux.HandleFunc("POST /teams/{teamSlug}/okrs/jira-refresh", refreshFromTracker(service))
	mux.HandleFunc("POST /teams/{teamSlug}/okrs/jira-refresh-node", refreshNodeFromTracker(service))
	mux.HandleFunc("GET /teams/{teamSlug}/okrs/jira-search", searchTracker(service))
}

func listTeams(service *app.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		teams, err := service.ListTeams(r.Context())
		if err != nil {
			writeFailure(w, err)
			return
		}
		httpx.WriteJSON(w, http.StatusOK, teams)
	}
}

func createTeam(service *app.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var team org.Team
		if !httpx.DecodeJSON(w, r, &team) {
			return
		}
		created, err := service.CreateTeam(r.Context(), team)
		if err != nil {
			writeFailure(w, err)
			return
		}
		httpx.WriteJSON(w, http.StatusCreated, created)
	}
}

func readSettings(service *app.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		settings, err := service.ReadSettings(r.Context(), r.PathValue("teamSlug"))
		if err != nil {
			writeFailure(w, err)
			return
		}
		httpx.WriteJSON(w, http.StatusOK, settingsResponse{JiraBaseURL: settings.TrackerBaseURL})
	}
}

func readSection(service *app.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		data, ok, err := service.ReadSection(r.Context(), r.PathValue("teamSlug"), r.PathValue("section"))
		httpx.WriteRawOrNotFound(w, data, ok, err, storeerr.ErrNotFound)
	}
}

func writeSection(service *app.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var raw json.RawMessage
		if !httpx.DecodeJSON(w, r, &raw) {
			return
		}
		err := service.WriteSection(r.Context(),
			r.PathValue("teamSlug"), r.PathValue("section"), raw)
		if err != nil {
			writeFailure(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func refreshFromTracker(service *app.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body refreshRequest
		if raw, _ := readAllOptional(r); len(raw) > 0 {
			if err := json.Unmarshal(raw, &body); err != nil {
				httpx.WriteError(w, http.StatusBadRequest, err)
				return
			}
		}

		result, err := service.RefreshFromTracker(r.Context(), r.PathValue("teamSlug"),
			app.RefreshRequest{QuarterID: body.QuarterID, Force: body.Force})
		if err != nil {
			writeFailure(w, err)
			return
		}
		httpx.WriteJSON(w, http.StatusOK, refreshResponse{
			RefreshedQuarters: result.Refreshed,
			SkippedFresh:      result.SkippedFresh,
			ClosedQuarters:    result.Closed,
		})
	}
}

func refreshNodeFromTracker(service *app.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body refreshNodeRequest
		if !httpx.DecodeJSON(w, r, &body) {
			return
		}
		if body.QuarterID == "" || body.NodeID == "" {
			httpx.WriteError(w, http.StatusBadRequest,
				errors.New("quarterId and nodeId are both required"))
			return
		}
		refreshed, err := service.RefreshNodeFromTracker(r.Context(),
			r.PathValue("teamSlug"), body.QuarterID, body.NodeID)
		if err != nil {
			writeFailure(w, err)
			return
		}
		httpx.WriteJSON(w, http.StatusOK, refreshNodeResponse{Refreshed: refreshed})
	}
}

func searchTracker(service *app.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		results, err := service.SearchTracker(r.Context(),
			r.PathValue("teamSlug"), r.URL.Query().Get("q"))
		if err != nil {
			writeFailure(w, err)
			return
		}
		out := make([]searchResult, 0, len(results))
		for _, res := range results {
			out = append(out, searchResult{Key: res.Key, Summary: res.Summary, IssueType: res.IssueType})
		}
		httpx.WriteJSON(w, http.StatusOK, out)
	}
}

func writeFailure(w http.ResponseWriter, err error) {
	httpx.WriteError(w, statusFor(err), err)
}

func statusFor(err error) int {
	switch {
	case errors.Is(err, app.ErrNoTracker):
		return http.StatusServiceUnavailable
	case errors.Is(err, app.ErrNoPlan), errors.Is(err, app.ErrNotFound), errors.Is(err, storeerr.ErrNotFound):
		return http.StatusNotFound
	case errors.Is(err, storeerr.ErrAlreadyExists):
		return http.StatusConflict
	case errors.Is(err, okr.ErrFutureSchemaVersion):
		return http.StatusConflict
	case errors.Is(err, app.ErrInvalidRequest):
		return http.StatusBadRequest
	case errors.Is(err, app.ErrTrackerUnavailable):
		return http.StatusBadGateway
	default:
		return httpx.StatusFor(err, http.StatusInternalServerError)
	}
}

func readAllOptional(r *http.Request) ([]byte, error) {
	if r.Body == nil {
		return nil, nil
	}
	defer func() { _ = r.Body.Close() }()
	return readAll(r)
}
