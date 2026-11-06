-- No more confidentiality levels: the assistant reads everything in Forge to structure the learning.
-- (Truly private material stays on Matis's computer, outside Forge.) The gate still audits and redacts.
UPDATE sources SET visibility = 'ai' WHERE visibility != 'ai';
UPDATE chunks SET visibility = 'ai' WHERE visibility != 'ai';
UPDATE repos SET visibility = 'ai' WHERE visibility != 'ai';
UPDATE questions SET visibility = 'ai' WHERE visibility != 'ai';
