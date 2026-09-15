// Package timewindow holds the half-open time range that every ingestion
// source is queried over.
//
// It is its own package rather than a type in one of the sources because
// both the GitHub and the Jira port take it, and neither should have to
// import the other to say so.
package timewindow

import "time"

type Window struct {
	Since time.Time
	Until time.Time
}

func (w Window) UTC() Window {
	return Window{Since: w.Since.UTC(), Until: w.Until.UTC()}
}
