package httpx_test

import (
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/helmedeiros/quartermark/httpx"
)

var errUnderlying = errors.New("underlying")

func TestStatusForReturnsFallbackWhenUntagged(t *testing.T) {
	if got := httpx.StatusFor(errUnderlying, http.StatusInternalServerError); got != http.StatusInternalServerError {
		t.Fatalf("StatusFor = %d, want the fallback 500", got)
	}
}

func TestStatusForReadsTheTaggedStatus(t *testing.T) {
	tagged := httpx.WithStatus(errUnderlying, http.StatusConflict)
	if got := httpx.StatusFor(tagged, http.StatusInternalServerError); got != http.StatusConflict {
		t.Fatalf("StatusFor = %d, want 409", got)
	}
}

func TestWithStatusKeepsTheErrorIdentityAndMessage(t *testing.T) {
	tagged := httpx.WithStatus(fmt.Errorf("context: %w", errUnderlying), http.StatusConflict)
	if !errors.Is(tagged, errUnderlying) {
		t.Fatal("errors.Is no longer sees the wrapped error")
	}
	if tagged.Error() != "context: underlying" {
		t.Fatalf("message = %q, want it unchanged", tagged.Error())
	}
}

func TestStatusForFindsATagBeneathFurtherWrapping(t *testing.T) {
	tagged := fmt.Errorf("while saving: %w", httpx.WithStatus(errUnderlying, http.StatusConflict))
	if got := httpx.StatusFor(tagged, http.StatusInternalServerError); got != http.StatusConflict {
		t.Fatalf("StatusFor = %d, want 409 through the outer wrap", got)
	}
}

func TestWithStatusOnNilIsNil(t *testing.T) {
	if err := httpx.WithStatus(nil, http.StatusConflict); err != nil {
		t.Fatalf("WithStatus(nil) = %v, want nil", err)
	}
}
