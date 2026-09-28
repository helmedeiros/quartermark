package main

import (
	"context"
	"encoding/json"
	"path/filepath"
	"testing"

	"github.com/helmedeiros/quartermark/adapters/sqlite"
	"github.com/helmedeiros/quartermark/okr"
	"github.com/helmedeiros/quartermark/org"
)

func store(t *testing.T) *sqlite.Store {
	t.Helper()
	s, err := sqlite.Open(filepath.Join(t.TempDir(), "demo.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = s.Close() })
	return s
}

func TestLoadDemoPopulatesAnEmptyDatabase(t *testing.T) {
	s, ctx := store(t), context.Background()

	if err := loadDemo(ctx, s); err != nil {
		t.Fatalf("loadDemo: %v", err)
	}

	teams, err := s.ListTeams(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(teams) != 1 || teams[0].Slug != demoTeamSlug {
		t.Fatalf("teams = %+v", teams)
	}

	raw, ok, err := s.GetTeamBlob(ctx, demoTeamSlug, "okrs")
	if err != nil || !ok {
		t.Fatalf("no okrs blob: ok=%v err=%v", ok, err)
	}
	if v := okr.BlobVersion(raw); v != okr.SchemaVersion {
		t.Fatalf("demo blob version = %d, want %d", v, okr.SchemaVersion)
	}
}

func TestDemoDataIsSubstantialEnoughToDemonstrateTheApp(t *testing.T) {
	var doc struct {
		Quarters []struct {
			Label      string `json:"label"`
			Locked     bool   `json:"locked"`
			Objectives []struct {
				Children []struct {
					Children []json.RawMessage `json:"children"`
				} `json:"children"`
			} `json:"objectives"`
		} `json:"quarters"`
	}
	if err := json.Unmarshal(demoOkrs, &doc); err != nil {
		t.Fatalf("demo data does not parse: %v", err)
	}

	if len(doc.Quarters) < 3 {
		t.Fatalf("want at least 3 quarters, got %d", len(doc.Quarters))
	}
	var locked, objectives, keyResults, milestones int
	for _, q := range doc.Quarters {
		if q.Locked {
			locked++
		}
		objectives += len(q.Objectives)
		for _, o := range q.Objectives {
			keyResults += len(o.Children)
			for _, kr := range o.Children {
				milestones += len(kr.Children)
			}
		}
	}
	if locked == 0 {
		t.Fatal("no locked quarter: the closed-quarter view is never demonstrated")
	}
	if objectives < 4 || keyResults < 5 || milestones < 5 {
		t.Fatalf("too thin to demonstrate anything: %d objectives, %d key results, %d milestones",
			objectives, keyResults, milestones)
	}
}

func TestLoadDemoRefusesADatabaseThatAlreadyHasTeams(t *testing.T) {
	s, ctx := store(t), context.Background()
	if err := s.CreateTeam(ctx, org.Team{Slug: "real", Name: "Real"}); err != nil {
		t.Fatal(err)
	}
	if err := s.PutTeamBlob(ctx, "real", "okrs", []byte(`{"schemaVersion":1,"quarters":[]}`)); err != nil {
		t.Fatal(err)
	}

	if err := loadDemo(ctx, s); err != nil {
		t.Fatalf("loadDemo should decline quietly, not fail: %v", err)
	}

	teams, err := s.ListTeams(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(teams) != 1 || teams[0].Slug != "real" {
		t.Fatalf("demo data was written into a non-empty database: %+v", teams)
	}
}
