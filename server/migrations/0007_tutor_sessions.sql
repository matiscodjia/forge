-- Tutor conversations during coding, one row per exercise per day. The planner, the assistant and the tutor itself
-- read them (where Matis gets stuck); they are never turned into Proof questions.
CREATE TABLE tutor_sessions (
  id TEXT PRIMARY KEY,            -- "<exercise>:<day>"
  exercise TEXT NOT NULL,
  kind TEXT,                      -- drill | problem
  title TEXT,
  day TEXT NOT NULL,
  messages TEXT NOT NULL,         -- JSON [{role: "me"|"tutor", text}]
  code TEXT,                      -- his code at the last question
  run TEXT,                       -- the last test run at the last question
  asks INTEGER NOT NULL DEFAULT 0,
  updated TEXT NOT NULL
);
CREATE INDEX tutor_sessions_day ON tutor_sessions(day);
CREATE INDEX tutor_sessions_ex ON tutor_sessions(exercise, day);
