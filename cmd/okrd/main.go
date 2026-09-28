// Command okrd serves the Quartermark API and, in a standalone install,
// nothing else — the frontend is served separately in development and
// as static files in production.
//
// It binds loopback by default. Quarter plans name people and unshipped
// work, so the safe default is "reachable from this machine only"; an
// operator who wants otherwise has to say so explicitly.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/helmedeiros/quartermark/adapters/connectors"
	"github.com/helmedeiros/quartermark/adapters/okrapi"
	"github.com/helmedeiros/quartermark/adapters/sqlite"
	"github.com/helmedeiros/quartermark/app"
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
	resolver := connectors.New(store)
	okrapi.Mount(mux, app.New(store, store, store, resolver))

	log.Printf("quartermark listening on http://%s (database: %s)", addr, dbPath)
	// The API is mounted at /api to match how the frontend proxies it.
	root := http.NewServeMux()
	root.Handle("/api/", http.StripPrefix("/api", mux))

	if err := http.ListenAndServe(addr, root); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
