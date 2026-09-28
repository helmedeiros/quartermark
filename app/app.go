package app

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/helmedeiros/quartermark/okr"
	"github.com/helmedeiros/quartermark/okr/tracker"
	"github.com/helmedeiros/quartermark/org"
)

type Documents interface {
	GetSection(ctx context.Context, teamSlug, section string) ([]byte, bool, error)
	PutSection(ctx context.Context, teamSlug, section string, data []byte) error
}

type Tracker interface {
	For(ctx context.Context, teamSlug string) (tracker.Source, error)
}

var ErrNoTracker = errors.New("app: no issue tracker configured for this team")

var ErrNoPlan = errors.New("app: this team has no plan yet")

type Service struct {
	plans     okr.Repository
	teams     okr.Teams
	documents Documents
	tracker   Tracker
}

func New(plans okr.Repository, teams okr.Teams, documents Documents, tracker Tracker) *Service {
	return &Service{plans: plans, teams: teams, documents: documents, tracker: tracker}
}

func (s *Service) ListTeams(ctx context.Context) ([]org.Team, error) {
	return s.teams.List(ctx)
}

func (s *Service) CreateTeam(ctx context.Context, team org.Team) (org.Team, error) {
	if team.Slug == "" || team.Name == "" {
		return org.Team{}, fmt.Errorf("%w: a team needs both a slug and a name", ErrInvalidRequest)
	}
	if team.CreatedAt == "" {
		team.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	}
	if err := s.teams.Create(ctx, team); err != nil {
		return org.Team{}, err
	}
	return team, nil
}

func (s *Service) ReadSection(ctx context.Context, teamSlug, section string) ([]byte, bool, error) {
	return s.documents.GetSection(ctx, teamSlug, section)
}

type Settings struct {
	TrackerBaseURL string
}

func (s *Service) ReadSettings(ctx context.Context, teamSlug string) (Settings, error) {
	raw, ok, err := s.documents.GetSection(ctx, teamSlug, "connectors")
	if err != nil || !ok {
		return Settings{}, err
	}
	return parseSettings(raw)
}

func (s *Service) SearchTracker(ctx context.Context, teamSlug, query string) ([]tracker.IssueSummary, error) {
	tracker, err := s.tracker.For(ctx, teamSlug)
	if err != nil {
		return nil, err
	}
	if tracker == nil {
		return nil, ErrNoTracker
	}
	results, err := tracker.SearchIssuesByText(ctx, query, searchResultLimit)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrTrackerUnavailable, err)
	}
	return results, nil
}

const searchResultLimit = 20

var (
	ErrInvalidRequest     = errors.New("app: the request cannot be carried out as asked")
	ErrTrackerUnavailable = errors.New("app: the issue tracker could not be reached")
)

func (s *Service) WriteSection(ctx context.Context, teamSlug, section string, raw []byte) error {
	if section == okrsSection {
		return s.writePlanDocument(ctx, teamSlug, raw)
	}
	return s.documents.PutSection(ctx, teamSlug, section, raw)
}

var ErrNotFound = errors.New("app: not found")
