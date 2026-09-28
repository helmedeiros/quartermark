package okr

import (
	"context"

	"github.com/helmedeiros/quartermark/org"
)

type Repository interface {
	Load(ctx context.Context, teamSlug string) (TeamOkrs, bool, error)
	Save(ctx context.Context, teamSlug string, plan TeamOkrs) error
}

type Teams interface {
	List(ctx context.Context) ([]org.Team, error)
	Get(ctx context.Context, slug string) (org.Team, error)
	Create(ctx context.Context, team org.Team) error
}
