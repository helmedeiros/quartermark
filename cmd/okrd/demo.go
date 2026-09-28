package main

import (
	"context"
	_ "embed"
	"fmt"
	"log"

	"github.com/helmedeiros/quartermark/okr"
	"github.com/helmedeiros/quartermark/org"
)

//go:embed demo-okrs.json
var demoOkrs []byte

const (
	demoTeamSlug = "atlas"
	demoTeamName = "Atlas"
)

func loadDemo(ctx context.Context, store okr.Store) error {
	teams, err := store.ListTeams(ctx)
	if err != nil {
		return fmt.Errorf("check for existing teams: %w", err)
	}
	if len(teams) > 0 {
		log.Printf("-demo ignored: this database already has %d team(s), and demo data is only loaded into an empty one", len(teams))
		return nil
	}

	if err := store.CreateTeam(ctx, org.Team{Slug: demoTeamSlug, Name: demoTeamName}); err != nil {
		return fmt.Errorf("create the demo team: %w", err)
	}
	blob, _, err := okr.UpgradeBlob(demoOkrs)
	if err != nil {
		return fmt.Errorf("demo data is not a valid okrs blob: %w", err)
	}
	if err := store.PutTeamBlob(ctx, demoTeamSlug, "okrs", blob); err != nil {
		return fmt.Errorf("store the demo quarters: %w", err)
	}

	connectors := []byte(`{"jira":{"baseUrl":"https://example.atlassian.net","email":"demo@example.com","token":"demo"}}`)
	if err := store.PutTeamBlob(ctx, demoTeamSlug, "connectors", connectors); err != nil {
		return fmt.Errorf("configure the demo tracker: %w", err)
	}

	log.Printf("loaded demo data: team %q with three quarters — open /t/%s/okrs", demoTeamName, demoTeamSlug)
	return nil
}
