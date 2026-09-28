package okrdoc

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func requireSameDocument(t *testing.T, want, got []byte) {
	t.Helper()
	var w, g any
	if err := json.Unmarshal(want, &w); err != nil {
		t.Fatalf("input is not JSON: %v", err)
	}
	if err := json.Unmarshal(got, &g); err != nil {
		t.Fatalf("output is not JSON: %v", err)
	}
	if !reflect.DeepEqual(w, g) {
		t.Fatalf("the document changed\n got: %s\nwant: %s", got, want)
	}
}

func roundTrip(t *testing.T, raw []byte) []byte {
	t.Helper()
	doc, err := decodeDocument(raw)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	out, err := encodeDocument(doc)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	return out
}

func TestRoundTripPreservesAModelledDocument(t *testing.T) {
	raw := []byte(`{
      "schemaVersion": 1,
      "team": "Atlas",
      "clusters": ["Growth", "Platform"],
      "quarters": [{
        "quarterId": "2027-q1",
        "label": "Q1 2027",
        "startDate": "2027-01-04",
        "endDate": "2027-03-31",
        "locked": false,
        "teamCapacity": 4,
        "objectives": [{
          "id": "O-1", "type": "objective", "title": "Ship it",
          "status": "on_track", "progress": 40,
          "owner": "Ada", "groups": ["Objective", "Growth"], "allocation": 60,
          "children": [{
            "id": "KR-1", "type": "key_result", "title": "Faster",
            "status": "at_risk", "progress": 25,
            "metricType": "number", "target": 10, "current": 18, "unit": "min",
            "jiraKeys": ["DEMO-1"],
            "children": [{
              "id": "M-1", "type": "milestone", "title": "Import",
              "status": "done", "progress": 100,
              "startDate": "2027-01-04", "dueDate": "2027-01-29", "effortWeeks": 4
            }]
          }]
        }]
      }]
    }`)

	requireSameDocument(t, raw, roundTrip(t, raw))
}

func TestRoundTripPreservesMembersTheDomainDoesNotModel(t *testing.T) {
	raw := []byte(`{
      "schemaVersion": 1,
      "team": "Atlas",
      "somethingNewAtTheTop": {"nested": [1, 2, 3]},
      "quarters": [{
        "quarterId": "2027-q1",
        "objectives": [{
          "id": "O-1", "type": "objective", "title": "Ship it",
          "status": "on_track", "progress": 0,
          "aFieldFromTheFuture": "keep me",
          "children": [{
            "id": "KR-1", "type": "key_result", "title": "Faster",
            "status": "on_track", "progress": 0,
            "deeplyNested": {"and": {"still": "here"}}
          }]
        }],
        "quarterLevelExtra": 42
      }]
    }`)

	requireSameDocument(t, raw, roundTrip(t, raw))
}

func TestRoundTripKeepsAbsentFieldsAbsent(t *testing.T) {
	raw := []byte(`{
      "quarters": [{
        "quarterId": "2027-q1",
        "objectives": [{
          "id": "O-1", "type": "objective", "title": "Unsized",
          "status": "not_started", "progress": 0
        }]
      }]
    }`)

	out := roundTrip(t, raw)
	requireSameDocument(t, raw, out)

	var probe map[string]any
	if err := json.Unmarshal(out, &probe); err != nil {
		t.Fatal(err)
	}
	node := probe["quarters"].([]any)[0].(map[string]any)["objectives"].([]any)[0].(map[string]any)
	for _, absent := range []string{"effortWeeks", "target", "current", "allocation", "startDate", "dueDate"} {
		if _, present := node[absent]; present {
			t.Errorf("%q was absent on the way in and present on the way out", absent)
		}
	}
}

func TestRoundTripKeepsExplicitZeroes(t *testing.T) {
	raw := []byte(`{
      "quarters": [{
        "quarterId": "2027-q1",
        "objectives": [{
          "id": "O-1", "type": "objective", "title": "Zeroed",
          "status": "not_started", "progress": 0,
          "allocation": 0, "effortWeeks": 0, "target": 0
        }]
      }]
    }`)

	requireSameDocument(t, raw, roundTrip(t, raw))
}

func TestRoundTripPreservesTheRealDocuments(t *testing.T) {
	for _, path := range []string{
		filepath.Join("..", "..", "demo", "okrs.json"),
		filepath.Join("..", "..", "cmd", "okrd", "demo-okrs.json"),
	} {
		t.Run(filepath.Base(filepath.Dir(path))+"/"+filepath.Base(path), func(t *testing.T) {
			raw, err := os.ReadFile(path)
			if err != nil {
				t.Skipf("not present: %v", err)
			}
			requireSameDocument(t, raw, roundTrip(t, raw))
		})
	}
}

func TestRoundTripPreservesADocumentGivenByTheOperator(t *testing.T) {
	path := os.Getenv("QUARTERMARK_DOC")
	if path == "" {
		t.Skip("set QUARTERMARK_DOC to check a document of your own")
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("reading %s: %v", path, err)
	}
	requireSameDocument(t, raw, roundTrip(t, raw))
}

func TestDecodeReportsWhereTheDocumentIsMalformed(t *testing.T) {
	_, err := decodeDocument([]byte(`{"quarters":[{"quarterId":"q","objectives":[{"id":1}]}]}`))
	if err == nil {
		t.Fatal("a node with a non-string id should be an error")
	}
}
