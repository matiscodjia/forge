-- App state sync. Notes live in `sources` (they feed retrieval later); everything else is one JSON value per key.
-- `rev` is a global, monotonically increasing counter: a client asks for "everything since rev N".

CREATE TABLE meta (k TEXT PRIMARY KEY, v INTEGER NOT NULL);
INSERT INTO meta (k, v) VALUES ('rev', 0);

CREATE TABLE kv (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL,                -- JSON
  rev INTEGER NOT NULL,
  updated TEXT NOT NULL
);
CREATE INDEX kv_rev ON kv(rev);

ALTER TABLE sources ADD COLUMN meta TEXT;                          -- JSON: {tags, mod}
ALTER TABLE sources ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;  -- tombstone, so deletions sync
ALTER TABLE sources ADD COLUMN rev INTEGER NOT NULL DEFAULT 0;
CREATE INDEX sources_rev ON sources(rev);
