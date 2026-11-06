// "I don't know": instead of memorising an answer, Matis gets it explained (intuition, precise statement, a tiny
// example, a self-check question) with references from his brain to read next. Works for review cards (from notes)
// and for Proof questions; a Proof question explained this way counts as a failed review and comes back soon.
import { ask, today } from "./proof.js";
import { schedule, ratingOf } from "./fsrs.js";
import { ready } from "./ai.js";

const bad = (m, status = 400) => Object.assign(new Error(m), { status });
const cut = (s, n) => String(s ?? "").slice(0, n);
const STOP = new Set("about after again also because before being between both could does doing each from have having here into itself just more most only other over same should some such than that their them then there these they this those through under very what when where which while with would your explain state write show give does what why how the and for are".split(" "));

export const EXPLAIN = `Matis is training to become an ML research engineer. He just admitted he does not know the answer below at all. Do not hand him an answer to memorise: make him understand it.
Write, in this order, each part starting with its bold label:
**Intuition.** The idea in 2 or 3 plain sentences.
**Precisely.** The exact statement, mechanism or derivation, with the key formula(s).
**Example.** A tiny concrete example or sanity check (small numbers, shapes, a 2×2 case).
**Check yourself.** One question he should now be able to answer from memory.
At most 250 words, plain Markdown paragraphs, no headings. Rely on the sources and standard textbook knowledge; if they are thin, say which reference to open.`;

/** Study material only: code and commits are not something to read to understand a concept (a pyproject.toml that
    lists numpy is not a reference on numpy axes). */
export const READABLE = ["note", "course", "wiki", "decision", "file"];
/** Brain passages related to the text (OR of its rarer words, best bm25 first), one per source, and only when the
    passage shares at least two of those words (or the only one, for a one-word topic). */
export async function related(db, text, { exclude = [], limit = 3, kinds = READABLE } = {}) {
  const toks = [...new Set((String(text).toLowerCase().match(/[\p{L}\p{N}_]{4,}/gu) || []).filter((t) => !STOP.has(t)))].slice(0, 10);
  if (!toks.length) return [];
  const r = await db.prepare(
    `SELECT c.source_id, s.kind, s.title, s.origin, c.text, snippet(chunks_fts, 0, '', '', '…', 16) AS snip, bm25(chunks_fts) AS score
     FROM chunks_fts JOIN chunks c ON c.rowid = chunks_fts.rowid JOIN sources s ON s.id = c.source_id
     WHERE chunks_fts MATCH ?1 AND s.deleted = 0 AND s.kind IN (SELECT value FROM json_each(?2)) ORDER BY score LIMIT 25`).bind(toks.map((t) => `"${t}"`).join(" OR "), JSON.stringify(kinds)).all();
  const seen = new Set(exclude), out = [], need = Math.min(2, toks.length);
  for (const x of r.results) {
    if (seen.has(x.source_id)) continue;
    const words = new Set(String(x.text).toLowerCase().match(/[\p{L}\p{N}_]{4,}/gu) || []);
    if (toks.filter((t) => words.has(t)).length < need) continue; seen.add(x.source_id); out.push(x); if (out.length >= limit) break; }
  return out;
}

async function teach(db, env, { front, back, context, title }, { now, fetch: f, exclude = [] }) {
  if (!ready(env, "assistant")) throw bad("No AI provider is available to explain.", 503);
  const refs = await related(db, `${front} ${back || ""}`, { exclude }).catch(() => []);
  const items = [
    { id: "explain:item", kind: "card", visibility: "ai", title: cut(title, 160) || "What he could not answer", text: `Question:\n${cut(front, 2000)}${back ? `\n\nExpected answer (his own card or rubric):\n${cut(back, 3000)}` : ""}` },
    ...(context ? [{ id: "explain:context", kind: "context", visibility: "ai", title: "Where it comes from", text: cut(context, 4000) }] : []),
    ...refs.map((r) => ({ id: `explain:ref:${r.source_id}`, kind: r.kind, visibility: "ai", title: r.title, text: cut(r.text, 1500) }))
  ];
  const { text } = await ask(db, env, "assistant", items, EXPLAIN, "", { now, fetch: f, maxTokens: 700 });
  if (!text || !text.trim()) throw bad("The model returned an empty explanation. Try again.", 502);
  return { text: text.replace(/\s*\[src:[^\]]+\]/g, "").trim(), refs: refs.map((r) => ({ source_id: r.source_id, kind: r.kind, title: r.title, origin: r.origin, snip: r.snip })) };
}

/** POST /api/explain { front, back, note: {id, title, body}, } → { text, refs } (a review card from a note) */
export async function explainCard(db, env, b, { now = new Date(), fetch: f } = {}) {
  const front = cut(b?.front, 2000).trim(); if (!front) throw bad("Nothing to explain.");
  const note = b.note || {};
  const context = note.body ? `${note.title || "Note"}:\n${cut(note.body, 4000)}` : "";
  return teach(db, env, { front, back: cut(b.back, 3000), context, title: note.title }, { now, fetch: f, exclude: note.id ? [note.id] : [] });
}

export { teach };

/** POST /api/proof/:id/giveup → like an answer scored 0 (comes back soon), plus the explanation and references. */
export async function giveUp(db, env, id, { now = new Date(), fetch: f } = {}) {
  const q = await db.prepare("SELECT * FROM questions WHERE id = ? AND retired = 0").bind(id).first();
  if (!q) throw bad("Question not found", 404);
  const day = today(env, now);
  if (q.last_review === day) throw bad("Already answered today. It comes back on its due date.", 409);
  const ex = await teach(db, env, { front: q.prompt, back: q.rubric, context: `${q.source_title || "Source"}:\n${q.source_text || ""}`, title: q.source_title }, { now, fetch: f, exclude: q.source_id ? [q.source_id] : [] });
  const rating = ratingOf(0), next = schedule(q.stability ? { stability: q.stability, difficulty: q.difficulty, last_review: q.last_review, reps: q.reps, lapses: q.lapses } : null, rating, day);
  await db.batch([
    db.prepare(`INSERT INTO reviews (id, question_id, at, day, answer, score, rating, feedback, typed_ms, elapsed_ms, pasted, due, stability, difficulty)
                VALUES (?, ?, ?, ?, ?, 0, ?, ?, 0, 0, 0, ?, ?, ?)`).bind(crypto.randomUUID().replace(/-/g, "").slice(0, 20), id, now.toISOString(), day, "(didn't know: explained)", rating, "Explained: answer it from memory next time.", next.due, next.stability, next.difficulty),
    db.prepare("UPDATE questions SET due = ?, stability = ?, difficulty = ?, reps = ?, lapses = ?, last_review = ? WHERE id = ?").bind(next.due, next.stability, next.difficulty, next.reps, next.lapses, day, id)
  ]);
  return { score: 0, gaveUp: true, fix: "", pasted: false, rating, due: next.due, interval: next.interval, rubric: q.rubric, check_key: q.check_key || null, explain: ex,
    source: { title: q.source_title, text: q.source_text, meta: q.source_meta ? JSON.parse(q.source_meta) : {}, source_id: q.source_id, kind: q.kind } };
}
