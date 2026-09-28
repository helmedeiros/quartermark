package connectors

import (
	"context"

	"github.com/helmedeiros/quartermark/jirasource"
)

func (r *Resolver) For(ctx context.Context, teamSlug string) (jirasource.Source, error) {
	return r.Jira(ctx, teamSlug)
}
