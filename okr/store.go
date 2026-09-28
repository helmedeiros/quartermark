package okr

import (
	"context"

	"github.com/helmedeiros/quartermark/org"
)

type Store interface {
	GetTeamBlob(ctx context.Context, teamSlug, section string) ([]byte, bool, error)
	PutTeamBlob(ctx context.Context, teamSlug, section string, data []byte) error

	ListTeams(ctx context.Context) ([]org.Team, error)
	GetTeam(ctx context.Context, slug string) (org.Team, error)
	CreateTeam(ctx context.Context, team org.Team) error
}
