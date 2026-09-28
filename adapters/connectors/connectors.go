package connectors

import (
	"context"
	"encoding/json"
	"fmt"

	jiraadapter "github.com/helmedeiros/quartermark/adapters/jira"
	"github.com/helmedeiros/quartermark/jirasource"
	"github.com/helmedeiros/quartermark/okr"
	"github.com/helmedeiros/quartermark/org"
)

const connectorsSection = "connectors"

type Resolver struct{ store okr.Store }

func New(store okr.Store) *Resolver { return &Resolver{store: store} }

func (r *Resolver) Jira(ctx context.Context, teamSlug string) (jirasource.Source, error) {
	raw, ok, err := r.store.GetTeamBlob(ctx, teamSlug, connectorsSection)
	if err != nil || !ok {
		return nil, err
	}
	var cfg org.Connectors
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, fmt.Errorf("parse connector config for %s: %w", teamSlug, err)
	}
	if cfg.Jira == nil || cfg.Jira.BaseURL == "" || cfg.Jira.Token == "" {
		return nil, nil
	}
	return jiraadapter.IngestAdapter{Client: jiraadapter.NewClient(cfg.Jira.BaseURL, cfg.Jira.Email, cfg.Jira.Token)}, nil
}
