// Package app holds the use cases: the orchestration that was
// previously written inside HTTP handlers.
//
// A handler should decode a request, call one of these, and encode the
// result. What it should not do is decide what a refresh means — that
// decision belongs somewhere a command-line tool or a scheduled job
// could reach it too, and a handler is not that place.
package app

import (
	"context"
	"errors"
	"fmt"

	"github.com/helmedeiros/quartermark/jirasource"
	"github.com/helmedeiros/quartermark/okr"
	"github.com/helmedeiros/quartermark/org"
)

// Documents is raw access to a team's stored sections.
//
// The OKR plan itself goes through okr.Repository in domain terms. This
// is for the sections the module stores but does not model — connector
// configuration, and whatever else a host keeps per team — and for
// handing the plan document to a client that wants all of it, including
// the parts the model does not describe.
type Documents interface {
	GetSection(ctx context.Context, teamSlug, section string) ([]byte, bool, error)
	PutSection(ctx context.Context, teamSlug, section string, data []byte) error
}

// Tracker resolves the issue tracker configured for one team. Nil, nil
// means the team has not configured one, which is a normal state.
type Tracker interface {
	For(ctx context.Context, teamSlug string) (jirasource.Source, error)
}

// ErrNoTracker is returned when an operation needs the issue tracker
// and the team has not configured one. A caller reports it as "not
// configured" rather than as a failure — a team can plan without it.
var ErrNoTracker = errors.New("app: no issue tracker configured for this team")

// ErrNoPlan is returned when a team has no OKR document yet.
var ErrNoPlan = errors.New("app: this team has no plan yet")

// Service is the module's use cases.
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

// CreateTeam registers a team. Slug and name are both required: a team
// with no slug has no URL, and one with no name is unreadable in a
// switcher.
func (s *Service) CreateTeam(ctx context.Context, team org.Team) (org.Team, error) {
	if team.Slug == "" || team.Name == "" {
		return org.Team{}, fmt.Errorf("%w: a team needs both a slug and a name", ErrInvalidRequest)
	}
	if err := s.teams.Create(ctx, team); err != nil {
		return org.Team{}, err
	}
	return team, nil
}

// ReadSection hands back a stored section as it is.
func (s *Service) ReadSection(ctx context.Context, teamSlug, section string) ([]byte, bool, error) {
	return s.documents.GetSection(ctx, teamSlug, section)
}

// Settings is the non-secret part of a team's connector configuration.
type Settings struct {
	TrackerBaseURL string
}

// ReadSettings exists so a browser can build a ticket link without
// being handed the connector record, which holds the API token.
func (s *Service) ReadSettings(ctx context.Context, teamSlug string) (Settings, error) {
	raw, ok, err := s.documents.GetSection(ctx, teamSlug, "connectors")
	if err != nil || !ok {
		return Settings{}, err
	}
	return parseSettings(raw)
}

// SearchTracker looks for issues to link to a node.
func (s *Service) SearchTracker(ctx context.Context, teamSlug, query string) ([]jirasource.IssueSummary, error) {
	tracker, err := s.tracker.For(ctx, teamSlug)
	if err != nil {
		return nil, err
	}
	if tracker == nil {
		return nil, ErrNoTracker
	}
	return tracker.SearchIssuesByText(ctx, query, searchResultLimit)
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
