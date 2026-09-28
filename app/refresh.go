package app

import (
	"context"
	"fmt"
	"time"

	"github.com/helmedeiros/quartermark/okr"
)

// RefreshRequest asks for a team's progress to be read back from the
// issue tracker.
type RefreshRequest struct {
	// QuarterID narrows the refresh to one quarter. Empty means all of
	// them.
	QuarterID string

	// Force ignores how recently a quarter was refreshed. Without it a
	// quarter refreshed within the window is left alone, because the
	// tracker is rate limited and a planning page can be opened
	// repeatedly in a minute.
	Force bool
}

// RefreshResult says what happened, per quarter, so a caller can tell
// "nothing needed doing" from "nothing happened".
type RefreshResult struct {
	Refreshed    []string
	SkippedFresh []string

	// Closed lists quarters whose progress was read as of their end
	// date rather than now — a finished quarter should keep reporting
	// what was true then.
	Closed []string
}

// RefreshFromTracker reads progress back from the issue tracker and
// saves it.
//
// This was the body of an HTTP handler. It is here because none of it
// is about HTTP: a scheduled job or a command-line tool wants exactly
// this, and would otherwise have to reimplement the freshness rule and
// the as-of rule to get the same answer.
func (s *Service) RefreshFromTracker(ctx context.Context, teamSlug string, req RefreshRequest) (RefreshResult, error) {
	result := RefreshResult{Refreshed: []string{}, SkippedFresh: []string{}}

	tracker, err := s.tracker.For(ctx, teamSlug)
	if err != nil {
		return result, err
	}
	if tracker == nil {
		return result, ErrNoTracker
	}

	plan, ok, err := s.plans.Load(ctx, teamSlug)
	if err != nil {
		return result, err
	}
	if !ok {
		return result, ErrNoPlan
	}

	now := time.Now().UTC()
	changed := false

	for i := range plan.Quarters {
		quarter := &plan.Quarters[i]
		if req.QuarterID != "" && quarter.ID != req.QuarterID {
			continue
		}
		if !req.Force && okr.IsRefreshFresh(quarter.TrackerRefreshedAt, now) {
			result.SkippedFresh = append(result.SkippedFresh, quarter.ID)
			continue
		}

		asOf, err := okr.RefreshQuarter(ctx, tracker, quarter, now)
		if err != nil {
			return result, fmt.Errorf("refreshing %s: %w", quarter.ID, err)
		}

		quarter.TrackerRefreshedAt = now
		quarter.TrackerAsOf = asOf
		result.Refreshed = append(result.Refreshed, quarter.ID)
		if asOf.Before(now) {
			result.Closed = append(result.Closed, quarter.ID)
		}
		changed = true
	}

	if !changed {
		return result, nil
	}
	if err := s.plans.Save(ctx, teamSlug, plan); err != nil {
		return result, err
	}
	return result, nil
}

// RefreshNodeFromTracker refreshes the issues linked to a single node,
// for someone who has just linked one and wants to see it now rather
// than waiting for the whole quarter.
func (s *Service) RefreshNodeFromTracker(ctx context.Context, teamSlug, quarterID, nodeID string) (bool, error) {
	tracker, err := s.tracker.For(ctx, teamSlug)
	if err != nil {
		return false, err
	}
	if tracker == nil {
		return false, ErrNoTracker
	}

	plan, ok, err := s.plans.Load(ctx, teamSlug)
	if err != nil {
		return false, err
	}
	if !ok {
		return false, ErrNoPlan
	}

	quarter := plan.Quarter(quarterID)
	if quarter == nil {
		return false, fmt.Errorf("app: no quarter %q", quarterID)
	}

	refreshed, err := okr.RefreshNode(ctx, tracker, quarter, nodeID, time.Now().UTC())
	if err != nil {
		return false, err
	}
	if !refreshed {
		return false, nil
	}
	if err := s.plans.Save(ctx, teamSlug, plan); err != nil {
		return false, err
	}
	return true, nil
}
