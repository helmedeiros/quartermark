package httpx

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// The JSON response plumbing every router in this repo writes, kept here
// rather than in one of them because more than one now needs it and the
// OKR router is meant to be liftable into its own module — it cannot
// reach back into the application's private helpers to answer a request.

func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func WriteError(w http.ResponseWriter, status int, err error) {
	WriteJSON(w, status, map[string]string{"error": err.Error()})
}

// WriteRawOrNotFound writes already-encoded JSON straight through, so a
// stored blob is served without a decode/encode round-trip that would
// reorder its keys. notFound is the error reported when ok is false;
// callers pass their own sentinel rather than this package inventing one.
func WriteRawOrNotFound(w http.ResponseWriter, data []byte, ok bool, err, notFound error) {
	if err != nil {
		WriteError(w, StatusFor(err, http.StatusInternalServerError), err)
		return
	}
	if !ok {
		WriteError(w, http.StatusNotFound, notFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

// DecodeJSON reports whether decoding succeeded, having already written
// the 400 if it did not — so handlers read as `if !DecodeJSON(...) { return }`.
func DecodeJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	defer func() { _ = r.Body.Close() }()
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		WriteError(w, http.StatusBadRequest, fmt.Errorf("invalid JSON body: %w", err))
		return false
	}
	return true
}

func PutRawBlob(w http.ResponseWriter, r *http.Request, put func(json.RawMessage) error) {
	var raw json.RawMessage
	if !DecodeJSON(w, r, &raw) {
		return
	}
	if err := put(raw); err != nil {
		WriteError(w, StatusFor(err, http.StatusInternalServerError), err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
