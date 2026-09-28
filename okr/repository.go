package okr

import (
	"context"
)

type Repository interface {
	Load(ctx context.Context, teamSlug string) (TeamOkrs, bool, error)
	Save(ctx context.Context, teamSlug string, plan TeamOkrs) error
}

type Teams interface {
	List(ctx context.Context) ([]Team, error)
	Get(ctx context.Context, slug string) (Team, error)
	Create(ctx context.Context, team Team) error
}
