// FSRS-4.5 scheduler (default weights), at day granularity, with desired retention 0.9.
// Ratings: 1 Again · 2 Hard · 3 Good · 4 Easy. A review is graded 0–100 by the model, then mapped to a rating.

export const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5, FACTOR = 19 / 81, RETENTION = 0.9, MAX_IVL = 365;
const clampD = (d) => Math.min(10, Math.max(1, d));

/** Score 0–100 → rating. A pasted answer proves nothing: it is always "Again". */
export const ratingOf = (score, pasted = false) => pasted ? 1 : score < 50 ? 1 : score < 70 ? 2 : score < 90 ? 3 : 4;

/** Probability of recall after `t` days with stability `s`. */
export const retrievability = (t, s) => Math.pow(1 + FACTOR * Math.max(0, t) / s, DECAY);
const intervalFor = (s) => Math.min(MAX_IVL, Math.max(1, Math.round((s / FACTOR) * (Math.pow(RETENTION, 1 / DECAY) - 1))));
const d0 = (g) => clampD(W[4] - (g - 3) * W[5]); // FSRS-4.5 initial difficulty

/**
 * Next state after a review on `today` (YYYY-MM-DD).
 * state = { stability, difficulty, last_review, reps, lapses } or null for a new question.
 * Returns { stability, difficulty, interval, due, reps, lapses, last_review }.
 */
export function schedule(state, rating, today) {
  const g = Math.min(4, Math.max(1, rating | 0));
  let s, d, lapses = state?.lapses || 0;
  if (!state || !state.stability) {
    s = W[g - 1]; d = d0(g);
  } else {
    const t = daysBetween(state.last_review, today), r = retrievability(t, state.stability);
    d = clampD(W[7] * d0(4) + (1 - W[7]) * (state.difficulty - W[6] * (g - 3)));
    if (g === 1) {
      s = Math.min(state.stability, W[11] * Math.pow(state.difficulty, -W[12]) * (Math.pow(state.stability + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)));
      lapses++;
    } else {
      s = state.stability * (Math.exp(W[8]) * (11 - state.difficulty) * Math.pow(state.stability, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * (g === 2 ? W[15] : 1) * (g === 4 ? W[16] : 1) + 1);
    }
  }
  const interval = g === 1 ? 1 : intervalFor(s); // low scores come back tomorrow
  return { stability: s, difficulty: d, interval, due: addDays(today, interval), reps: (state?.reps || 0) + 1, lapses, last_review: today };
}

export function daysBetween(a, b) { return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5); }
export function addDays(day, n) { const d = new Date(day + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
/** Calendar day in a time zone (Forge's day starts at midnight Paris time by default). */
export const dayIn = (date, tz = "Europe/Paris") => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
