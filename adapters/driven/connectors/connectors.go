package connectors

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/helmedeiros/quartermark/okr/tracker"
)

const connectorsSection = "connectors"

type BuildTracker func(config JiraConfig) tracker.Source

type Resolver struct {
	sections Sections
	build    BuildTracker
}

type Sections interface {
	GetSection(ctx context.Context, teamSlug, section string) ([]byte, bool, error)
}

func New(sections Sections, build BuildTracker) *Resolver {
	return &Resolver{sections: sections, build: build}
}

func (r *Resolver) For(ctx context.Context, teamSlug string) (tracker.Source, error) {
	raw, ok, err := r.sections.GetSection(ctx, teamSlug, connectorsSection)
	if err != nil || !ok {
		return nil, err
	}

	var config Connectors
	if err := json.Unmarshal(raw, &config); err != nil {
		return nil, fmt.Errorf("parse connector config for %s: %w", teamSlug, err)
	}
	if !configuredForTracking(config.Jira) {
		return nil, nil
	}
	return r.build(*config.Jira), nil
}

func configuredForTracking(config *JiraConfig) bool {
	return config != nil && config.BaseURL != "" && config.Token != ""
}
