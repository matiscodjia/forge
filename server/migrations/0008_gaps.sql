-- Weak spots: topics Matis is shaky on (asked by him, inferred from a tutor session or a note, or detected by the
-- planner). Each has a study pack and Proof questions; it is mastered once two of them score 70+ from memory.
CREATE TABLE gaps (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  norm TEXT NOT NULL,             -- lowercase topic, for de-duplication
  track TEXT,
  origin TEXT,                    -- ask | tutor | note | planner
  context TEXT,
  pack TEXT,                      -- JSON {diagnosis, lesson, resources:[{k,t,u,mod}], drills:[id]}
  status TEXT NOT NULL DEFAULT 'open',   -- open | mastered | dropped
  created TEXT NOT NULL,
  updated TEXT NOT NULL,
  closed TEXT
);
CREATE INDEX gaps_status ON gaps(status, created);
ALTER TABLE questions ADD COLUMN gap_id TEXT;
CREATE INDEX questions_gap ON questions(gap_id);
