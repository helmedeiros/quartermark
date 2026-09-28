package app

import (
	"context"
	"fmt"

	"github.com/helmedeiros/quartermark/adapters/driven/okrdoc"
	"github.com/helmedeiros/quartermark/okr"
)

const okrsSection = "okrs"

func (s *Service) writePlanDocument(ctx context.Context, teamSlug string, raw []byte) error {
	stamped, _, err := okr.UpgradeBlob(raw)
	if err != nil {
		return err
	}
	if err := validatePlanDocument(stamped); err != nil {
		return fmt.Errorf("%w: %s", ErrInvalidRequest, err)
	}
	return s.documents.PutSection(ctx, teamSlug, okrsSection, stamped)
}

func validatePlanDocument(raw []byte) error {
	doc, err := okrdoc.Parse(raw)
	if err != nil {
		return err
	}
	plan, err := doc.Domain()
	if err != nil {
		return err
	}
	return plan.Validate()
}
