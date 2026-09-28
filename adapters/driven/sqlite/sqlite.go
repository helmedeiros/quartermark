package sqlite

import (
	"context"
	"database/sql"
	_ "embed"
	"errors"
	"fmt"
	"time"

	"github.com/helmedeiros/quartermark/okr"
	"github.com/helmedeiros/quartermark/org"
	modernsqlite "modernc.org/sqlite"
)

//go:embed schema.sql
var schemaSQL string

const (
	sqliteConstraintUnique     = 2067
	sqliteConstraintPrimaryKey = 1555
)

type Store struct{ db *sql.DB }

func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	db.SetMaxOpenConns(1)
	if _, err := db.ExecContext(context.Background(), schemaSQL); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("apply schema: %w", err)
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error { return s.db.Close() }

func isDuplicateKey(err error) bool {
	var e *modernsqlite.Error
	if !errors.As(err, &e) {
		return false
	}
	return e.Code() == sqliteConstraintUnique || e.Code() == sqliteConstraintPrimaryKey
}

func nowRFC3339() string { return time.Now().UTC().Format(time.RFC3339) }

func (s *Store) CreateTeam(ctx context.Context, t org.Team) error {
	if t.CreatedAt == "" {
		t.CreatedAt = nowRFC3339()
	}
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO teams (slug, name, created_at) VALUES (?, ?, ?)`,
		t.Slug, t.Name, t.CreatedAt)
	if isDuplicateKey(err) {
		return fmt.Errorf("team %s: %w", t.Slug, okr.ErrAlreadyExists)
	}
	return err
}

func (s *Store) GetTeam(ctx context.Context, slug string) (org.Team, error) {
	var t org.Team
	err := s.db.QueryRowContext(ctx,
		`SELECT slug, name, created_at FROM teams WHERE slug = ?`, slug).
		Scan(&t.Slug, &t.Name, &t.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return org.Team{}, okr.ErrNotFound
	}
	return t, err
}

func (s *Store) ListTeams(ctx context.Context) ([]org.Team, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT slug, name, created_at FROM teams ORDER BY slug`)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	teams := []org.Team{}
	for rows.Next() {
		var t org.Team
		if err := rows.Scan(&t.Slug, &t.Name, &t.CreatedAt); err != nil {
			return nil, err
		}
		teams = append(teams, t)
	}
	return teams, rows.Err()
}

func (s *Store) GetTeamBlob(ctx context.Context, teamSlug, section string) ([]byte, bool, error) {
	var data string
	err := s.db.QueryRowContext(ctx,
		`SELECT data_json FROM team_blobs WHERE team_slug = ? AND section = ?`,
		teamSlug, section).Scan(&data)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	return []byte(data), true, nil
}

func (s *Store) PutTeamBlob(ctx context.Context, teamSlug, section string, data []byte) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO team_blobs (team_slug, section, data_json, updated_at)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(team_slug, section)
		DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at
	`, teamSlug, section, string(data), nowRFC3339())
	return err
}
