package okr_test

import (
	"strings"
	"testing"

	"github.com/helmedeiros/quartermark/okr"
)

func TestParsingRejectsWhatIsNotInTheVocabulary(t *testing.T) {
	for _, tc := range []struct {
		name  string
		parse func(string) error
		bad   []string
		good  []string
	}{
		{
			name:  "node type",
			parse: func(s string) error { _, err := okr.ParseNodeType(s); return err },
			bad:   []string{"", "Objective", "task", "objectives"},
			good:  []string{"objective", "key_result", "milestone"},
		},
		{
			name:  "status",
			parse: func(s string) error { _, err := okr.ParseStatus(s); return err },
			bad:   []string{"", "in_progress", "delivered", "On Track"},
			good:  []string{"not_started", "on_track", "at_risk", "off_track", "done"},
		},
		{
			name:  "commitment",
			parse: func(s string) error { _, err := okr.ParseCommitment(s); return err },
			bad:   []string{"", "maybe", "Committed"},
			good:  []string{"proposed", "committed", "if_possible", "rejected", "extra"},
		},
		{
			name:  "metric type",
			parse: func(s string) error { _, err := okr.ParseMetricType(s); return err },
			bad:   []string{"", "duration", "count", "percentage"},
			good:  []string{"percent", "number", "currency", "boolean"},
		},
		{
			name:  "mode",
			parse: func(s string) error { _, err := okr.ParseMode(s); return err },
			bad:   []string{"", "automatic", "Auto"},
			good:  []string{"auto", "manual"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			for _, s := range tc.good {
				if err := tc.parse(s); err != nil {
					t.Errorf("%q should parse: %v", s, err)
				}
			}
			for _, s := range tc.bad {
				if err := tc.parse(s); err == nil {
					t.Errorf("%q should not parse", s)
				}
			}
		})
	}
}

func TestParseErrorNamesTheValue(t *testing.T) {
	_, err := okr.ParseStatus("in_progress")
	if err == nil {
		t.Fatal("want an error")
	}
	if got := err.Error(); !strings.Contains(got, "in_progress") {
		t.Fatalf("error %q does not name the offending value", got)
	}
}

func TestProgressIsBoundedToAPercentage(t *testing.T) {
	for _, v := range []int{0, 1, 50, 99, 100} {
		if _, err := okr.NewProgress(v); err != nil {
			t.Errorf("%d should be valid progress: %v", v, err)
		}
	}
	for _, v := range []int{-1, 101, 140, -100} {
		if _, err := okr.NewProgress(v); err == nil {
			t.Errorf("%d should be rejected", v)
		}
	}
}

func TestTheTreeShapeMatchesWhatPlansActuallyDo(t *testing.T) {
	allowed := map[okr.NodeType][]okr.NodeType{
		okr.Objective: {okr.Objective, okr.KeyResult, okr.Milestone},
		okr.KeyResult: {okr.Milestone},
		okr.Milestone: nil,
	}
	all := []okr.NodeType{okr.Objective, okr.KeyResult, okr.Milestone}

	for _, parent := range all {
		for _, child := range all {
			want := false
			for _, c := range allowed[parent] {
				if c == child {
					want = true
				}
			}
			if got := parent.CanContain(child); got != want {
				t.Errorf("%s.CanContain(%s) = %v, want %v", parent, child, got, want)
			}
		}
	}
}
