-- Forge second brain (Part 2). Cloudflare D1 / SQLite.
-- visibility: 'private' (never sent to an LLM, never embedded) < 'trusted' < 'ai'. CHECKs fail closed on typos.

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('note','journal','course','repo','file','commit','wiki','decision')),
  title TEXT, project TEXT,
  visibility TEXT NOT NULL DEFAULT 'ai' CHECK (visibility IN ('private','trusted','ai')),
  origin TEXT, body TEXT,
  created TEXT NOT NULL, updated TEXT NOT NULL
);
CREATE INDEX sources_project ON sources(project);
CREATE INDEX sources_kind ON sources(kind, updated);

CREATE TABLE chunks (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  ord INTEGER NOT NULL,
  text TEXT NOT NULL,
  meta TEXT,                      -- JSON: {path, lines:[a,b], heading, commit}
  visibility TEXT NOT NULL CHECK (visibility IN ('private','trusted','ai')),
  hash TEXT NOT NULL              -- sha-256 of text: re-sync skips unchanged chunks
);
CREATE INDEX chunks_source ON chunks(source_id, ord);
CREATE UNIQUE INDEX chunks_source_hash ON chunks(source_id, hash);

-- Local full-text search, the only search allowed over private chunks. Kept in sync by triggers.
CREATE VIRTUAL TABLE chunks_fts USING fts5(text, content='chunks', content_rowid='rowid');
CREATE TRIGGER chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts(rowid, text) VALUES (new.rowid, new.text);
END;
CREATE TRIGGER chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
END;
CREATE TRIGGER chunks_au AFTER UPDATE OF text ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
  INSERT INTO chunks_fts(rowid, text) VALUES (new.rowid, new.text);
END;
-- A source's visibility is inherited by its chunks.
CREATE TRIGGER sources_vis AFTER UPDATE OF visibility ON sources BEGIN
  UPDATE chunks SET visibility = new.visibility WHERE source_id = new.id;
END;

CREATE TABLE wiki_pages (
  slug TEXT PRIMARY KEY, title TEXT NOT NULL, body_md TEXT NOT NULL,
  sources TEXT NOT NULL,          -- JSON array of chunk ids cited
  visibility TEXT NOT NULL DEFAULT 'ai' CHECK (visibility IN ('private','trusted','ai')),
  updated TEXT NOT NULL
);
CREATE TABLE wiki_proposals (
  id TEXT PRIMARY KEY, slug TEXT NOT NULL, diff TEXT NOT NULL, reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created TEXT NOT NULL
);

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  chunk_id TEXT NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  concept TEXT, prompt TEXT NOT NULL, rubric TEXT NOT NULL, created TEXT NOT NULL
);
CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  at TEXT NOT NULL, answer TEXT, score INTEGER, feedback TEXT,
  typed_ms INTEGER, pasted INTEGER NOT NULL DEFAULT 0,
  due TEXT NOT NULL, stability REAL, difficulty REAL
);
CREATE INDEX reviews_due ON reviews(due);
CREATE INDEX reviews_question ON reviews(question_id, at);

CREATE TABLE ai_audit (
  id TEXT PRIMARY KEY, at TEXT NOT NULL, task TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL,
  item_ids TEXT NOT NULL,         -- JSON array: exactly the items that left
  decision TEXT,                  -- JSON routing decision: route | switched | excluded
  tokens_in INTEGER, tokens_out INTEGER
);
CREATE INDEX ai_audit_at ON ai_audit(at);
