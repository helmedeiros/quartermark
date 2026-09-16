package main

import (
	"context"
	_ "embed"
	"fmt"
	"log"

	"github.com/helmedeiros/quartermark/okr"
	"github.com/helmedeiros/quartermark/org"
)

// The demo quarter, embedded so `okrd -demo` works from a bare binary
// with no data directory to find.
//
//go:embed demo-okrs.json
var demoOkrs []byte

const (
	demoTeamSlug = "atlas"
	demoTeamName = "Atlas"
)

// loadDemo installs a worked example so the application has something to
// show before anyone has typed anything into it.
//
// It refuses to run against a database that already has teams. Demo data
// is only ever additive to an empty install: quietly overwriting somebody
// real quarter because they passed the wrong flag would be unforgivable,
// and "the flag did nothing" is a much better failure.
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
	// Through UpgradeBlob rather than straight in, so the fixture is
	// held to the same schema rule as anything a user writes.
	blob, _, err := okr.UpgradeBlob(demoOkrs)
	if err != nil {
		return fmt.Errorf("demo data is not a valid okrs blob: %w", err)
	}
	if err := store.PutTeamBlob(ctx, demoTeamSlug, "okrs", blob); err != nil {
		return fmt.Errorf("store the demo quarters: %w", err)
	}

	log.Printf("loaded demo data: team %q with three quarters — open /t/%s/okrs", demoTeamName, demoTeamSlug)
	return nil
}
