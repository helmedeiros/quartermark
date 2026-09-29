package sqlite

import (
	"context"
	"errors"
	"fmt"

	"github.com/helmedeiros/quartermark/adapters/outbound/okrdoc"
	"github.com/helmedeiros/quartermark/okr"
)

const okrsSection = "okrs"

var _ okr.Repository = (*Store)(nil)
var _ okr.Teams = (*Store)(nil)

func (s *Store) Load(ctx context.Context, teamSlug string) (okr.TeamOkrs, bool, error) {
	raw, ok, err := s.GetTeamBlob(ctx, teamSlug, okrsSection)
	if err != nil || !ok {
		return okr.TeamOkrs{}, ok, err
	}
	doc, err := okrdoc.Parse(raw)
	if err != nil {
		return okr.TeamOkrs{}, true, fmt.Errorf("team %s: %w", teamSlug, err)
	}
	plan, err := doc.Domain()
	if err != nil {
		return okr.TeamOkrs{}, true, fmt.Errorf("team %s: %w", teamSlug, err)
	}
	return plan, true, nil
}

func (s *Store) Save(ctx context.Context, teamSlug string, plan okr.TeamOkrs) error {
	if err := plan.Validate(); err != nil {
		return fmt.Errorf("team %s: %w", teamSlug, err)
	}

	updated, err := s.planWrittenOverStoredDocument(ctx, teamSlug, plan)
	if err != nil {
		return fmt.Errorf("team %s: %w", teamSlug, err)
	}
	return s.PutTeamBlob(ctx, teamSlug, okrsSection, updated)
}

func (s *Store) planWrittenOverStoredDocument(ctx context.Context, teamSlug string, plan okr.TeamOkrs) ([]byte, error) {
	stored, ok, err := s.GetTeamBlob(ctx, teamSlug, okrsSection)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, errNoStoredPlan
	}

	doc, err := okrdoc.Parse(stored)
	if err != nil {
		return nil, err
	}
	if err := doc.Apply(plan); err != nil {
		return nil, err
	}
	return doc.Bytes()
}

var errNoStoredPlan = errors.New("no plan to save over")

func (s *Store) List(ctx context.Context) ([]okr.Team, error) { return s.ListTeams(ctx) }

func (s *Store) Get(ctx context.Context, slug string) (okr.Team, error) {
	return s.GetTeam(ctx, slug)
}

func (s *Store) Create(ctx context.Context, team okr.Team) error {
	return s.CreateTeam(ctx, team)
}
