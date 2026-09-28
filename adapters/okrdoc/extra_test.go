package okrdoc

import (
	"encoding/json"
	"reflect"
	"testing"
)

type sample struct {
	Name string `json:"name"`
	Size int    `json:"size,omitempty"`
}

var sampleKnown = []string{"name", "size"}

func TestSplitExtrasKeepsWhatTheStructDidNotClaim(t *testing.T) {
	raw := []byte(`{"name":"a","size":2,"futureField":{"x":1},"anotherOne":"kept"}`)

	var v sample
	e, err := splitExtras(raw, &v, sampleKnown)
	if err != nil {
		t.Fatal(err)
	}

	if v.Name != "a" || v.Size != 2 {
		t.Fatalf("known fields decoded wrong: %+v", v)
	}
	if len(e) != 2 {
		t.Fatalf("want 2 unclaimed members, got %v", e)
	}
	if _, ok := e["futureField"]; !ok {
		t.Error("futureField was dropped — the exact failure this prevents")
	}
}

func TestSplitExtrasIsNilWhenNothingIsUnclaimed(t *testing.T) {
	e, err := splitExtras([]byte(`{"name":"a"}`), &sample{}, sampleKnown)
	if err != nil {
		t.Fatal(err)
	}
	if e != nil {
		t.Errorf("want nil extras, got %v", e)
	}
}

func TestRoundTripRestoresUnknownMembers(t *testing.T) {
	raw := []byte(`{"anotherOne":"kept","futureField":{"x":1},"name":"a","size":2}`)

	var v sample
	e, err := splitExtras(raw, &v, sampleKnown)
	if err != nil {
		t.Fatal(err)
	}
	out, err := mergeExtras(v, e)
	if err != nil {
		t.Fatal(err)
	}

	var want, got map[string]any
	if err := json.Unmarshal(raw, &want); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(out, &got); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(want, got) {
		t.Fatalf("round trip changed the document\n got: %s\nwant: %s", out, raw)
	}
}

func TestAKnownFieldWinsOverACarriedOne(t *testing.T) {
	out, err := mergeExtras(
		sample{Name: "current"},
		extras{"name": json.RawMessage(`"stale"`)},
	)
	if err != nil {
		t.Fatal(err)
	}

	var got sample
	if err := json.Unmarshal(out, &got); err != nil {
		t.Fatal(err)
	}
	if got.Name != "current" {
		t.Errorf("name = %q, want the struct's value to win", got.Name)
	}
}

func TestSplitExtrasReportsMalformedInput(t *testing.T) {
	if _, err := splitExtras([]byte(`{oops`), &sample{}, sampleKnown); err == nil {
		t.Error("malformed JSON should be an error, not empty extras")
	}
}
