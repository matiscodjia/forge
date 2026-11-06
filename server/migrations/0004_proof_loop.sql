-- M11 proof loop. questions/reviews from 0001 were never written: rebuild them with the scheduling state.
-- A question keeps a snapshot of its source chunk: editing the code later must not erase the review history.
PRAGMA defer_foreign_keys = true;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS questions;

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  chunk_id TEXT NOT NULL,
  source_id TEXT,
  kind TEXT, project TEXT,
  track TEXT,                     -- Skills track (coding, ml, math, sys, ship, eng, reach)
  concept TEXT,
  prompt TEXT NOT NULL, rubric TEXT NOT NULL,
  source_title TEXT, source_text TEXT NOT NULL, source_meta TEXT,
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'trusted', 'ai')),
  created TEXT NOT NULL, day TEXT NOT NULL,
  due TEXT NOT NULL,              -- YYYY-MM-DD, Paris time
  stability REAL, difficulty REAL, reps INTEGER NOT NULL DEFAULT 0, lapses INTEGER NOT NULL DEFAULT 0,
  last_review TEXT, retired INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX questions_due ON questions(retired, due);
CREATE INDEX questions_chunk ON questions(chunk_id);
CREATE INDEX questions_day ON questions(day);

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  at TEXT NOT NULL, day TEXT NOT NULL,
  answer TEXT, score INTEGER, rating INTEGER, feedback TEXT,
  typed_ms INTEGER, elapsed_ms INTEGER, pasted INTEGER NOT NULL DEFAULT 0,
  due TEXT NOT NULL, stability REAL, difficulty REAL
);
CREATE INDEX reviews_question ON reviews(question_id, at);
CREATE INDEX reviews_day ON reviews(day);

-- A question inherits its source's visibility, like chunks do.
CREATE TRIGGER sources_vis_questions AFTER UPDATE OF visibility ON sources BEGIN
  UPDATE questions SET visibility = new.visibility WHERE source_id = new.id;
END;
