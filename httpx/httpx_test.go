package httpx_test

import (
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/helmedeiros/quartermark/httpx"
)

type closeTrackingBody struct {
	io.Reader
	closed bool
}

func (b *closeTrackingBody) Close() error {
	b.closed = true
	return nil
}

func TestDecodeAndClose_OK_DecodesBodyAndClosesIt(t *testing.T) {
	body := &closeTrackingBody{Reader: strings.NewReader(`{"name":"ada"}`)}
	resp := &http.Response{StatusCode: http.StatusOK, Body: body}

	var v struct {
		Name string `json:"name"`
	}
	if err := httpx.DecodeAndClose(resp, &v, "jira"); err != nil {
		t.Fatalf("DecodeAndClose: %v", err)
	}
	if v.Name != "ada" {
		t.Fatalf("expected decoded name %q, got %q", "ada", v.Name)
	}
	if !body.closed {
		t.Fatal("expected response body to be closed")
	}
}

func TestDecodeAndClose_NonOKStatus_ReturnsErrorWithSourceAndCode(t *testing.T) {
	body := &closeTrackingBody{Reader: strings.NewReader("")}
	resp := &http.Response{StatusCode: http.StatusTooManyRequests, Body: body}

	var v any
	err := httpx.DecodeAndClose(resp, &v, "github")
	if err == nil {
		t.Fatal("expected an error for a non-200 status")
	}
	if got, want := err.Error(), "github API returned status 429"; got != want {
		t.Fatalf("error = %q, want %q", got, want)
	}
	if !body.closed {
		t.Fatal("expected response body to be closed even on error")
	}
}

func TestDecodeAndClose_MalformedJSON_ReturnsDecodeError(t *testing.T) {
	body := &closeTrackingBody{Reader: strings.NewReader("not json")}
	resp := &http.Response{StatusCode: http.StatusOK, Body: body}

	var v any
	if err := httpx.DecodeAndClose(resp, &v, "jira"); err == nil {
		t.Fatal("expected a JSON decode error")
	}
}
