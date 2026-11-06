-- M8 ingestion: GitHub repositories and their files as sources.

CREATE TABLE repos (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL UNIQUE,        -- owner/name
  branch TEXT NOT NULL DEFAULT 'main',
  project TEXT,
  visibility TEXT NOT NULL DEFAULT 'ai' CHECK (visibility IN ('private','trusted','ai')),
  head_sha TEXT,                         -- last fully synced commit
  synced_at TEXT,
  created TEXT NOT NULL
);

ALTER TABLE sources ADD COLUMN repo_id TEXT;   -- set for kind repo|commit
CREATE INDEX sources_repo ON sources(repo_id, kind);
