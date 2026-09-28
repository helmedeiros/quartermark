package sqlite

import "context"

func (s *Store) GetSection(ctx context.Context, teamSlug, section string) ([]byte, bool, error) {
	return s.GetTeamBlob(ctx, teamSlug, section)
}

func (s *Store) PutSection(ctx context.Context, teamSlug, section string, data []byte) error {
	return s.PutTeamBlob(ctx, teamSlug, section, data)
}
