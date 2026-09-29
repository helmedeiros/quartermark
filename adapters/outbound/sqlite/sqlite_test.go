package sqlite_test

import (
	"context"
	"errors"
	"path/filepath"
	"testing"

	"github.com/helmedeiros/quartermark/adapters/outbound/sqlite"
	"github.com/helmedeiros/quartermark/okr"
)

func open(t *testing.T) *sqlite.Store {
	t.Helper()
	store, err := sqlite.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })
	return store
}

func TestOpenIsIdempotentOnAnExistingDatabase(t *testing.T) {
	path := filepath.Join(t.TempDir(), "test.db")
	first, err := sqlite.Open(path)
	if err != nil {
		t.Fatalf("first open: %v", err)
	}
	if err := first.CreateTeam(context.Background(), okr.Team{Slug: "acme", Name: "Acme"}); err != nil {
		t.Fatal(err)
	}
	_ = first.Close()

	second, err := sqlite.Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	defer func() { _ = second.Close() }()
	if _, err := second.GetTeam(context.Background(), "acme"); err != nil {
		t.Fatalf("team did not survive reopen: %v", err)
	}
}

func TestTeamRegistryRoundTrip(t *testing.T) {
	store, ctx := open(t), context.Background()

	if err := store.CreateTeam(ctx, okr.Team{Slug: "b-team", Name: "B"}); err != nil {
		t.Fatal(err)
	}
	if err := store.CreateTeam(ctx, okr.Team{Slug: "a-team", Name: "A"}); err != nil {
		t.Fatal(err)
	}

	teams, err := store.ListTeams(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(teams) != 2 || teams[0].Slug != "a-team" {
		t.Fatalf("expected a stable slug ordering, got %+v", teams)
	}
	if teams[0].CreatedAt == "" {
		t.Fatal("CreateTeam did not stamp createdAt")
	}
}

func TestListTeamsIsEmptyNotNil(t *testing.T) {
	teams, err := open(t).ListTeams(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if teams == nil {
		t.Fatal("ListTeams returned nil; want an empty slice")
	}
	if len(teams) != 0 {
		t.Fatalf("want no teams, got %+v", teams)
	}
}

func TestCreateTeamTwiceReportsAlreadyExists(t *testing.T) {
	store, ctx := open(t), context.Background()
	team := okr.Team{Slug: "acme", Name: "Acme"}
	if err := store.CreateTeam(ctx, team); err != nil {
		t.Fatal(err)
	}

	err := store.CreateTeam(ctx, team)
	if !errors.Is(err, okr.ErrAlreadyExists) {
		t.Fatalf("second CreateTeam = %v, want okr.ErrAlreadyExists", err)
	}
}

func TestGetUnknownTeamReportsNotFound(t *testing.T) {
	_, err := open(t).GetTeam(context.Background(), "nope")
	if !errors.Is(err, okr.ErrNotFound) {
		t.Fatalf("GetTeam = %v, want okr.ErrNotFound", err)
	}
}

func TestBlobRoundTripAndOverwrite(t *testing.T) {
	store, ctx := open(t), context.Background()

	if _, ok, err := store.GetTeamBlob(ctx, "acme", "okrs"); err != nil || ok {
		t.Fatalf("absent blob: ok=%v err=%v, want false/nil", ok, err)
	}
	if err := store.PutTeamBlob(ctx, "acme", "okrs", []byte(`{"v":1}`)); err != nil {
		t.Fatal(err)
	}
	if err := store.PutTeamBlob(ctx, "acme", "okrs", []byte(`{"v":2}`)); err != nil {
		t.Fatalf("overwrite: %v", err)
	}

	got, ok, err := store.GetTeamBlob(ctx, "acme", "okrs")
	if err != nil || !ok {
		t.Fatalf("ok=%v err=%v", ok, err)
	}
	if string(got) != `{"v":2}` {
		t.Fatalf("blob = %s, want the second write", got)
	}
}

func TestBlobsAreScopedByTeamAndSection(t *testing.T) {
	store, ctx := open(t), context.Background()

	if err := store.PutTeamBlob(ctx, "acme", "okrs", []byte(`"acme-okrs"`)); err != nil {
		t.Fatal(err)
	}
	if err := store.PutTeamBlob(ctx, "other", "okrs", []byte(`"other-okrs"`)); err != nil {
		t.Fatal(err)
	}
	if err := store.PutTeamBlob(ctx, "acme", "connectors", []byte(`"acme-connectors"`)); err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct{ team, section, want string }{
		{"acme", "okrs", `"acme-okrs"`},
		{"other", "okrs", `"other-okrs"`},
		{"acme", "connectors", `"acme-connectors"`},
	} {
		got, ok, err := store.GetTeamBlob(ctx, tc.team, tc.section)
		if err != nil || !ok {
			t.Fatalf("%s/%s: ok=%v err=%v", tc.team, tc.section, ok, err)
		}
		if string(got) != tc.want {
			t.Fatalf("%s/%s = %s, want %s", tc.team, tc.section, got, tc.want)
		}
	}
}
