package sqlite

import (
	"context"
	"fmt"

	"github.com/helmedeiros/quartermark/adapters/okrdoc"
	"github.com/helmedeiros/quartermark/okr"
	"github.com/helmedeiros/quartermark/org"
)

// The OKR plan is stored as one JSON document per team. Translating
// between that and the domain is this adapter's job — which is the
// point of the port speaking domain objects: the core never learns
// that a document was involved.

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

// Save reads the stored document first and writes the plan over it,
// rather than serializing the plan from nothing.
//
// That read is not waste. The document holds things this model does
// not — members added by a newer frontend, and the difference between
// an empty list and no list — and writing from scratch would discard
// them on every save, silently, for whoever was ahead of the backend.
func (s *Store) Save(ctx context.Context, teamSlug string, plan okr.TeamOkrs) error {
	if err := plan.Validate(); err != nil {
		return fmt.Errorf("team %s: %w", teamSlug, err)
	}

	raw, ok, err := s.GetTeamBlob(ctx, teamSlug, okrsSection)
	if err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("team %s has no plan to save over", teamSlug)
	}

	doc, err := okrdoc.Parse(raw)
	if err != nil {
		return fmt.Errorf("team %s: %w", teamSlug, err)
	}
	if err := doc.Apply(plan); err != nil {
		return fmt.Errorf("team %s: %w", teamSlug, err)
	}
	updated, err := doc.Bytes()
	if err != nil {
		return fmt.Errorf("team %s: %w", teamSlug, err)
	}
	return s.PutTeamBlob(ctx, teamSlug, okrsSection, updated)
}

// The Teams port's names, satisfied by the registry methods already
// here. Kept as thin forwards so no existing caller has to move in the
// same change that introduces the port.

func (s *Store) List(ctx context.Context) ([]org.Team, error) { return s.ListTeams(ctx) }

func (s *Store) Get(ctx context.Context, slug string) (org.Team, error) {
	return s.GetTeam(ctx, slug)
}

func (s *Store) Create(ctx context.Context, team org.Team) error {
	return s.CreateTeam(ctx, team)
}
