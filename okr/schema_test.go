package okr_test

import (
	"encoding/json"
	"reflect"
	"testing"

	"github.com/helmedeiros/quartermark/okr"
)

func TestBlobVersionMissingIsZero(t *testing.T) {
	for name, raw := range map[string]string{
		"no field":      `{"team":"Demo","quarters":[]}`,
		"null":          `{"schemaVersion":null,"quarters":[]}`,
		"wrong type":    `{"schemaVersion":"1","quarters":[]}`,
		"unparsable":    `not json at all`,
		"not an object": `[1,2,3]`,
	} {
		t.Run(name, func(t *testing.T) {
			if got := okr.BlobVersion([]byte(raw)); got != 0 {
				t.Fatalf("BlobVersion = %d, want 0", got)
			}
		})
	}
}

func TestBlobVersionReadsStampedVersion(t *testing.T) {
	if got := okr.BlobVersion([]byte(`{"schemaVersion":1,"quarters":[]}`)); got != 1 {
		t.Fatalf("BlobVersion = %d, want 1", got)
	}
	if got := okr.BlobVersion([]byte(`{"schemaVersion":7,"quarters":[]}`)); got != 7 {
		t.Fatalf("BlobVersion = %d, want 7", got)
	}
}

func TestUpgradeBlobStampsUnversionedBlobAndPreservesContent(t *testing.T) {
	before := `{"team":"Demo","quarters":[{"quarterId":"2026-q1","objectives":[{"id":"O-1","title":"Ship it","effortWeeks":3}]}]}`

	out, changed, err := okr.UpgradeBlob([]byte(before))
	if err != nil {
		t.Fatalf("UpgradeBlob: %v", err)
	}
	if !changed {
		t.Fatal("changed = false, want true for an unversioned blob")
	}
	if got := okr.BlobVersion(out); got != okr.SchemaVersion {
		t.Fatalf("version after upgrade = %d, want %d", got, okr.SchemaVersion)
	}

	var wantDoc, gotDoc map[string]any
	if err := json.Unmarshal([]byte(before), &wantDoc); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(out, &gotDoc); err != nil {
		t.Fatal(err)
	}
	wantDoc["schemaVersion"] = float64(okr.SchemaVersion)
	if !reflect.DeepEqual(wantDoc, gotDoc) {
		t.Fatalf("upgrade altered content\n got: %#v\nwant: %#v", gotDoc, wantDoc)
	}
}

func TestUpgradeBlobLeavesCurrentBlobUntouched(t *testing.T) {
	before := []byte(`{"schemaVersion":1,"team":"Demo","quarters":[]}`)

	out, changed, err := okr.UpgradeBlob(before)
	if err != nil {
		t.Fatalf("UpgradeBlob: %v", err)
	}
	if changed {
		t.Fatal("changed = true, want false for an already-current blob")
	}
	if string(out) != string(before) {
		t.Fatalf("bytes rewritten:\n got: %s\nwant: %s", out, before)
	}
}

func TestUpgradeBlobRefusesFutureVersion(t *testing.T) {
	_, _, err := okr.UpgradeBlob([]byte(`{"schemaVersion":99,"quarters":[]}`))
	if err == nil {
		t.Fatal("UpgradeBlob accepted a future schema version, want error")
	}
}

func TestUpgradeBlobRejectsUnparsableBlob(t *testing.T) {
	if _, _, err := okr.UpgradeBlob([]byte(`{oops`)); err == nil {
		t.Fatal("UpgradeBlob accepted unparsable JSON, want error")
	}
}
