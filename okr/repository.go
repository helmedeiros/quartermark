package okr

import (
	"context"

	"github.com/helmedeiros/quartermark/org"
)

// Repository is how the OKR module reads and writes a team's plan.
//
// In domain terms, not bytes: what is stored is a serialization
// decision, and a core that asks for []byte has already agreed to one.
// An implementation is free to keep this as a document, as rows, or as
// anything else.
//
// Save takes the whole plan rather than a patch because that is how it
// is edited — a quarter is dragged around as a tree and saved as one.
// An implementation is expected to preserve anything it stores that
// this model does not describe.
type Repository interface {
	Load(ctx context.Context, teamSlug string) (TeamOkrs, bool, error)
	Save(ctx context.Context, teamSlug string, plan TeamOkrs) error
}

// Teams is the registry of teams this instance knows about.
//
// Separate from Repository because they answer different questions and
// a host application will often already have the first: an application
// with its own idea of a team can satisfy this without letting the OKR
// module near its plans.
type Teams interface {
	List(ctx context.Context) ([]org.Team, error)
	Get(ctx context.Context, slug string) (org.Team, error)
	Create(ctx context.Context, team org.Team) error
}
