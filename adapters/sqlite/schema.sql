-- Two tables. A team registry, and a JSON blob per (team, section).
--
-- The OKR tree is stored as a blob rather than normalised into rows
-- because it is a tree the client edits as a whole: every save rewrites
-- it, nothing queries across objectives, and a schema migration for
-- every new field on a milestone would be all cost and no benefit. The
-- shape is versioned instead — see okr.SchemaVersion.

CREATE TABLE IF NOT EXISTS teams (
    slug       TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS team_blobs (
    team_slug  TEXT NOT NULL,
    section    TEXT NOT NULL,
    data_json  TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (team_slug, section)
);
