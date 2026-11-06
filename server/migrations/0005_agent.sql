-- Autonomy: questions that prove a Path exit check, and the nightly plan written by the planner agent.
ALTER TABLE questions ADD COLUMN check_key TEXT;  -- "<module id>#<check index>", null for questions from sources
CREATE INDEX questions_check ON questions(check_key);
CREATE TABLE plans (day TEXT PRIMARY KEY, plan TEXT NOT NULL, at TEXT NOT NULL);
