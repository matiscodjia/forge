-- Point-by-point grading: the verdict per rubric point with the quoted evidence, verified errors, and whether the
-- grade was contested (re-graded by independent examiners).
ALTER TABLE reviews ADD COLUMN detail TEXT;
ALTER TABLE reviews ADD COLUMN contested INTEGER NOT NULL DEFAULT 0;
