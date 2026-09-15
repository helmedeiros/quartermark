// Command okrd serves the Quartermark API and, in a standalone install,
// nothing else — the frontend is served separately in development and
// as static files in production.
//
// It binds loopback by default. Quarter plans name people and unshipped
// work, so the safe default is "reachable from this machine only"; an
// operator who wants otherwise has to say so explicitly.
package main

import (
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/helmedeiros/quartermark/adapters/connectors"
	"github.com/helmedeiros/quartermark/adapters/okrapi"
	"github.com/helmedeiros/quartermark/adapters/sqlite"
)

const (
	defaultAddr = "127.0.0.1:8770"
	defaultDB   = "quartermark.db"
)

func main() {
	addr := flag.String("addr", envOr("QUARTERMARK_ADDR", defaultAddr), "address to listen on")
	dbPath := flag.String("db", envOr("QUARTERMARK_DB", defaultDB), "path to the SQLite database")
	flag.Parse()

	if err := run(*addr, *dbPath); err != nil {
		log.Fatal(err)
	}
}

func run(addr, dbPath string) error {
	store, err := sqlite.Open(dbPath)
	if err != nil {
		return fmt.Errorf("open %s: %w", dbPath, err)
	}
	defer func() { _ = store.Close() }()

	mux := http.NewServeMux()
	okrapi.Mount(mux, store, connectors.New(store))

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
