package okr

import (
	"context"

	"github.com/helmedeiros/quartermark/org"
)

// Store is everything the OKR module needs from persistence: the team
// registry it scopes work to, and the blob its tree lives in.
//
// Deliberately small. A host application embedding this module almost
// certainly has a much larger repository of its own; it should not have
// to hand that whole interface over, and this module should not be able
// to reach anything it has no business reading.
//
// Narrowness is also what lets one implementation back both a standalone
// server and a large host application: a two-table schema and a
// twenty-table one satisfy it equally, and neither knows about the other.
type Store interface {
	GetTeamBlob(ctx context.Context, teamSlug, section string) ([]byte, bool, error)
	PutTeamBlob(ctx context.Context, teamSlug, section string, data []byte) error

	ListTeams(ctx context.Context) ([]org.Team, error)
	GetTeam(ctx context.Context, slug string) (org.Team, error)
	CreateTeam(ctx context.Context, team org.Team) error
}
