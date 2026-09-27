package okrdoc

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/helmedeiros/quartermark/okr"
)

func parse(t *testing.T, raw []byte) *Document {
	t.Helper()
	d, err := Parse(raw)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	return d
}

func TestDomainReadsTheDocumentAsTypedObjects(t *testing.T) {
	raw := []byte(`{
      "team": "Atlas", "clusters": ["Growth"],
      "quarters": [{
        "quarterId": "2027-q1", "label": "Q1 2027",
        "startDate": "2027-01-04", "endDate": "2027-03-31", "locked": true,
        "objectives": [{
          "id": "O-1", "type": "objective", "title": "Ship it",
          "status": "on_track", "progress": 40,
          "children": [{
            "id": "KR-1", "type": "key_result", "title": "Faster",
            "status": "at_risk", "progress": 25,
            "metricType": "number", "target": 10, "current": 18, "unit": "min"
          }]
        }]
      }]
    }`)

	team, err := parse(t, raw).Domain()
	if err != nil {
		t.Fatalf("Domain: %v", err)
	}
	if err := team.Validate(); err != nil {
		t.Fatalf("the decoded document should be valid: %v", err)
	}

	q := team.Quarters[0]
	if q.ID != "2027-q1" || !q.Locked || q.Start.String() != "2027-01-04" {
		t.Fatalf("quarter decoded wrong: %+v", q)
	}
	kr := q.Objectives[0].Children[0]
	if kr.Status != okr.AtRisk || kr.Progress.Int() != 25 {
		t.Fatalf("key result decoded wrong: %+v", kr)
	}
	if kr.Metric == nil || kr.Metric.Type != okr.Number || *kr.Metric.Target != 10 {
		t.Fatalf("metric decoded wrong: %+v", kr.Metric)
	}
}

// Strict on the way in, so a value outside the vocabulary is an error
// here rather than an undefined lookup in a chart three layers up.
func TestDomainRejectsValuesOutsideTheVocabulary(t *testing.T) {
	for _, tc := range []struct{ name, doc string }{
		{"status", `{"quarters":[{"quarterId":"q","objectives":[
			{"id":"O-1","type":"objective","title":"t","status":"in_progress","progress":0}]}]}`},
		{"node type", `{"quarters":[{"quarterId":"q","objectives":[
			{"id":"O-1","type":"epic","title":"t","status":"on_track","progress":0}]}]}`},
		{"metric type", `{"quarters":[{"quarterId":"q","objectives":[
			{"id":"O-1","type":"objective","title":"t","status":"on_track","progress":0,"metricType":"duration"}]}]}`},
		{"progress", `{"quarters":[{"quarterId":"q","objectives":[
			{"id":"O-1","type":"objective","title":"t","status":"on_track","progress":140}]}]}`},
		{"date", `{"quarters":[{"quarterId":"q","objectives":[
			{"id":"O-1","type":"objective","title":"t","status":"on_track","progress":0,"dueDate":"31/03/2027"}]}]}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := parse(t, []byte(tc.doc)).Domain(); err == nil {
				t.Errorf("an invalid %s should be rejected", tc.name)
			}
		})
	}
}

// The whole point of Apply: reading and writing back without changing
// anything must leave the document exactly as it was, including the
// parts the domain has never heard of.
func TestApplyingAnUnchangedDomainLeavesTheDocumentAlone(t *testing.T) {
	raw := []byte(`{
      "schemaVersion": 1, "team": "Atlas",
      "unmodelledTopLevel": {"keep": true},
      "quarters": [{
        "quarterId": "2027-q1", "objectives": [{
          "id": "O-1", "type": "objective", "title": "Ship it",
          "status": "on_track", "progress": 40,
          "unmodelledOnANode": ["a", "b"],
          "labels": [],
          "children": [{
            "id": "KR-1", "type": "key_result", "title": "Faster",
            "status": "on_track", "progress": 0
          }]
        }]
      }]
    }`)

	d := parse(t, raw)
	team, err := d.Domain()
	if err != nil {
		t.Fatal(err)
	}
	if err := d.Apply(team); err != nil {
		t.Fatalf("Apply: %v", err)
	}
	out, err := d.Bytes()
	if err != nil {
		t.Fatal(err)
	}

	requireSameDocument(t, raw, out)
}

func TestApplyWritesDomainChangesAndNothingElse(t *testing.T) {
	raw := []byte(`{
      "quarters": [{
        "quarterId": "2027-q1", "objectives": [{
          "id": "O-1", "type": "objective", "title": "Ship it",
          "status": "on_track", "progress": 40,
          "unmodelled": "untouched",
          "children": [{
            "id": "KR-1", "type": "key_result", "title": "Faster",
            "status": "on_track", "progress": 10
          }]
        }]
      }]
    }`)

	d := parse(t, raw)
	team, err := d.Domain()
	if err != nil {
		t.Fatal(err)
	}
	// Change one leaf, deep in the tree.
	team.Quarters[0].Objectives[0].Children[0].Status = okr.Done
	team.Quarters[0].Objectives[0].Children[0].Progress, _ = okr.NewProgress(100)

	if err := d.Apply(team); err != nil {
		t.Fatalf("Apply: %v", err)
	}
	out, err := d.Bytes()
	if err != nil {
		t.Fatal(err)
	}

	var got map[string]any
	if err := json.Unmarshal(out, &got); err != nil {
		t.Fatal(err)
	}
	objective := got["quarters"].([]any)[0].(map[string]any)["objectives"].([]any)[0].(map[string]any)
	kr := objective["children"].([]any)[0].(map[string]any)

	if kr["status"] != "done" || kr["progress"].(float64) != 100 {
		t.Fatalf("the change did not land: %v", kr)
	}
	if objective["unmodelled"] != "untouched" {
		t.Errorf("an unmodelled member was disturbed: %v", objective["unmodelled"])
	}
	if objective["progress"].(float64) != 40 {
		t.Errorf("an untouched node changed: progress %v", objective["progress"])
	}
}

// Apply exists to save edits to a plan that exists. Inventing a node
// the document does not have would hide a bug in whatever produced the
// domain object.
func TestApplyRefusesANodeTheDocumentDoesNotHave(t *testing.T) {
	d := parse(t, []byte(`{"quarters":[{"quarterId":"2027-q1","objectives":[]}]}`))

	team := okr.TeamOkrs{Quarters: []okr.Quarter{{
		ID:         "2027-q1",
		Objectives: []okr.Node{{ID: "ghost", Type: okr.Objective, Title: "t", Status: okr.OnTrack}},
	}}}

	if err := d.Apply(team); err == nil {
		t.Fatal("applying an unknown node should be an error")
	}
}

func TestApplyRefusesAQuarterTheDocumentDoesNotHave(t *testing.T) {
	d := parse(t, []byte(`{"quarters":[]}`))
	team := okr.TeamOkrs{Quarters: []okr.Quarter{{ID: "2030-q4"}}}

	if err := d.Apply(team); err == nil {
		t.Fatal("applying an unknown quarter should be an error")
	}
}

// The documents that exist, read all the way into the domain and
// written back.
func TestTheRealDocumentsSurviveAFullDomainRoundTrip(t *testing.T) {
	paths := []string{filepath.Join("..", "..", "demo", "okrs.json")}
	if p := os.Getenv("QUARTERMARK_DOC"); p != "" {
		paths = append(paths, p)
	}

	for _, path := range paths {
		t.Run(filepath.Base(path), func(t *testing.T) {
			raw, err := os.ReadFile(path)
			if err != nil {
				t.Skipf("not present: %v", err)
			}
			d := parse(t, raw)
			team, err := d.Domain()
			if err != nil {
				t.Fatalf("Domain: %v", err)
			}
			if err := team.Validate(); err != nil {
				t.Fatalf("a real document should be valid: %v", err)
			}
			if err := d.Apply(team); err != nil {
				t.Fatalf("Apply: %v", err)
			}
			out, err := d.Bytes()
			if err != nil {
				t.Fatal(err)
			}
			requireSameDocument(t, raw, out)
		})
	}
}
