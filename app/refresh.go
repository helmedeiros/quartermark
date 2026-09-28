package app

import (
	"context"
	"fmt"
	"time"

	"github.com/helmedeiros/quartermark/okr"
)

type RefreshRequest struct {
	QuarterID string

	Force bool
}

type RefreshResult struct {
	Refreshed    []string
	SkippedFresh []string

	Closed []string
}

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
