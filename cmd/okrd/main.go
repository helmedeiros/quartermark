package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/helmedeiros/quartermark/adapters/inbound/okrapi"
	"github.com/helmedeiros/quartermark/adapters/outbound/connectors"
	"github.com/helmedeiros/quartermark/adapters/outbound/jira"
	"github.com/helmedeiros/quartermark/adapters/outbound/sqlite"
	"github.com/helmedeiros/quartermark/app"
	"github.com/helmedeiros/quartermark/okr/tracker"
)

const (
	defaultAddr = "127.0.0.1:8770"
	defaultDB   = "quartermark.db"
)

func main() {
	addr := flag.String("addr", envOr("QUARTERMARK_ADDR", defaultAddr), "address to listen on")
	dbPath := flag.String("db", envOr("QUARTERMARK_DB", defaultDB), "path to the SQLite database")
	demo := flag.Bool("demo", false, "load a worked example into an empty database, so there is something to look at")
	flag.Parse()

	if err := run(*addr, *dbPath, *demo); err != nil {
		log.Fatal(err)
	}
}

func run(addr, dbPath string, demo bool) error {
	store, err := sqlite.Open(dbPath)
	if err != nil {
		return fmt.Errorf("open %s: %w", dbPath, err)
	}
	defer func() { _ = store.Close() }()

	if demo {
		if err := loadDemo(context.Background(), store); err != nil {
			return err
		}
	}

	mux := http.NewServeMux()
	var tracker app.Tracker = connectors.New(store, newTrackerClient)
	if demo {
		tracker = withDemoTracker(tracker)
	}
	okrapi.Mount(mux, app.New(store, store, store, tracker))

	log.Printf("quartermark listening on http://%s (database: %s)", addr, dbPath)
	root := http.NewServeMux()
	root.Handle("/api/", http.StripPrefix("/api", mux))

	if err := http.ListenAndServe(addr, root); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func newTrackerClient(config connectors.JiraConfig) tracker.Source {
	return jira.IngestAdapter{Client: jira.NewClient(config.BaseURL, config.Email, config.Token)}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
