// M11 proof loop: one new question a day from a recent chunk, graded answers, FSRS scheduling, mastery from reviews only.
// Every model call goes through resolveRoute → contextGate → callLLM, like any other task.
import { contextGate, LEVELS, allowed } from "./gate.js";
import { resolveRoute } from "./router.js";
import { callLLM, d1Audit } from "./llm.js";
import { aiConfig, ready } from "./ai.js";
import { schedule, ratingOf, retrievability, daysBetween, dayIn } from "./fsrs.js";

export const TRACKS = ["coding", "ml", "math", "sys", "ship", "eng", "reach"];
const MAX_NEW_PER_DAY = 5, MAX_ANSWER = 8000;
const bad = (m, status = 400) => Object.assign(new Error(m), { status });
const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 20);
export const today = (env, now) => dayIn(now, env.TZ || "Europe/Paris");

/** Typing faster than 15 characters per second of active typing is not typing. */
export const looksPasted = (answer, typedMs) => answer.length >= 40 && (answer.length / Math.max(1, typedMs)) * 1000 > 15;

/** Models wrap JSON in prose or fences: take the outermost object. */
export function parseJSON(text) {
  const s = String(text || ""), a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
}

export async function ask(db, env, task, items, instruction, question, { now, fetch: f, maxTokens = 700 }) {
  if (!ready(env, task)) throw bad("No AI provider is available for this task. Deploy with the Workers AI binding or set AI_CONFIG.", 503);
  const cfg = aiConfig(env), { provider, decision } = resolveRoute(task, items, cfg);
  const ctx = contextGate(items, provider, { task, decision, now: () => now.toISOString() });
  if (!ctx.items.length) return { ctx, text: null };
  const out = await callLLM(ctx, { instruction, question, maxTokens }, { fetch: f || fetch, env, providers: cfg.providers, audit: d1Audit(db) });
  return { ctx, text: out.text };
}

const where = (m) => m.path ? `${m.path}${m.lines ? ` lines ${m.lines[0]}-${m.lines[1]}` : ""}` : m.page ? `page ${m.page}` : m.heading || "";

const GEN = `You write ONE exam question that proves Matis really understands the source below (he is training to become an ML/AI research engineer).
Rules:
- Answerable from memory, without seeing the source, in 3 to 8 sentences (or a few lines of code).
- Ask why/how/what-if: explain a design choice, derive a formula, predict a behaviour, compare with an alternative, or write a small piece of code. Never ask for line numbers, file names, variable names or trivia.
- Write in the language of the source.
Reply with JSON only, no prose:
{"concept": "<2-4 word concept, lowercase>", "track": "<one of: coding (algorithms, interview coding), ml (machine/deep learning, LLMs), math, sys (PyTorch, systems, GPU, Rust/C performance), ship (engineering of his own projects), eng (English), reach (visibility)>", "question": "<the question>", "rubric": ["<key point a full answer must contain>", "<3 to 5 points>"]}`;

const GRADE = `You grade Matis's answer to an exam question. The source contains the question, the rubric and the original material; the answer follows the sources.
Score 0-100: 90+ complete and precise; 70-89 correct with minor gaps; 50-69 partly correct; below 50 wrong, vague or mostly missing. Be strict: restating the question or listing buzzwords scores low. Judge content, not style or language.
Reply with JSON only, no prose:
{"score": <integer 0-100>, "fix": "<one line: the most important missing or wrong point, or 'Nothing to fix.'>"}`;

/** Create one question from a random recent chunk. Without `force` (the daily cron), only when none exists today. */
export async function generate(db, env, { now = new Date(), fetch: f, force = false } = {}) {
  const day = today(env, now);
  const made = await db.prepare("SELECT count(*) AS n FROM questions WHERE day = ? AND check_key IS NULL").bind(day).first("n");
  if (!force && made > 0) return { created: false, reason: "already one today" };
  if (made >= MAX_NEW_PER_DAY) throw bad(`At most ${MAX_NEW_PER_DAY} new questions a day: review instead.`, 429);
  if (!ready(env, "question_gen")) throw bad("No AI provider is available for question generation.", 503);

  // Only chunks the question_gen provider may read; recent sources first (last 30 days), never a chunk already asked.
  const cfg = aiConfig(env), r = cfg.routes.question_gen, prov = cfg.providers[typeof r === "string" ? r : r.provider];
  const levels = LEVELS.filter((v) => allowed(v, prov.clearance));
  const recent = new Date(now.getTime() - 30 * 864e5).toISOString();
  const c = await db.prepare(
    `SELECT c.id, c.text, c.meta, c.visibility, s.id AS source_id, s.kind, s.title, s.project
     FROM chunks c JOIN sources s ON s.id = c.source_id
     WHERE s.deleted = 0 AND s.kind != 'journal' AND c.visibility IN (SELECT value FROM json_each(?1)) AND length(c.text) >= 200
       AND coalesce(json_extract(c.meta, '$.symbol'), '') != '(header)'
       AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.chunk_id = c.id)
     ORDER BY (s.updated >= ?2) DESC, random() LIMIT 1`).bind(JSON.stringify(levels), recent).first();
  if (!c) throw bad("Nothing to ask about yet: upload a course, sync a repository or write notes (≥ 200 characters).", 409);
  const meta = c.meta ? JSON.parse(c.meta) : {};
  const item = { id: c.id, kind: c.kind, title: `${c.title}${where(meta) ? ` (${where(meta)})` : ""}`, text: c.text, visibility: c.visibility };
  const { text } = await ask(db, env, "question_gen", [item], GEN, "", { now, fetch: f });
  const q = parseJSON(text);
  if (!q || typeof q.question !== "string" || !q.question.trim()) throw bad("The model did not return a usable question. Try again.", 502);
  const rubric = (Array.isArray(q.rubric) ? q.rubric : [q.rubric]).filter((x) => typeof x === "string" && x.trim()).map((x) => `- ${x.trim()}`).join("\n") || "- A correct, specific explanation.";
  const track = TRACKS.includes(q.track) ? q.track : c.kind === "repo" || c.kind === "commit" ? "ship" : "ml";
  const id = uid();
  await db.prepare(
    `INSERT INTO questions (id, chunk_id, source_id, kind, project, track, concept, prompt, rubric, source_title, source_text, source_meta, visibility, created, day, due)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?15)`)
    .bind(id, c.id, c.source_id, c.kind, c.project, track, String(q.concept || "").trim().toLowerCase().slice(0, 80) || null, q.question.trim().slice(0, 2000), rubric.slice(0, 3000),
      item.title, c.text, c.meta, c.visibility, now.toISOString(), day).run();
  return { created: true, id };
}

/** Grade an answer, schedule the next review. body = { answer, typed_ms, elapsed_ms, pasted } */
export async function answer(db, env, id, body, { now = new Date(), fetch: f } = {}) {
  const ans = String(body?.answer || "").trim();
  if (!ans) throw bad("Write an answer first.");
  if (ans.length > MAX_ANSWER) throw bad("Answer is too long.");
  const typed = Math.max(0, Math.round(Number(body.typed_ms) || 0)), elapsed = Math.max(0, Math.round(Number(body.elapsed_ms) || 0));
  const pasted = !!body.pasted || looksPasted(ans, typed);
  const q = await db.prepare("SELECT q.*, s.visibility AS cur_vis FROM questions q LEFT JOIN sources s ON s.id = q.source_id WHERE q.id = ? AND q.retired = 0").bind(id).first();
  if (!q) throw bad("Question not found", 404);
  const day = today(env, now);
  if (q.last_review === day) throw bad("Already answered today. It comes back on its due date.", 409);
  const visibility = q.cur_vis || q.visibility;
  if (visibility === "private") {
    await db.prepare("UPDATE questions SET retired = 1 WHERE id = ?").bind(id).run();
    throw bad("Its source is private now, so it can't be graded by an AI. The question was retired.", 409);
  }
  const item = { id: q.chunk_id, kind: q.kind, title: q.source_title, visibility, text: `Question:\n${q.prompt}\n\nRubric:\n${q.rubric}\n\nSource material:\n${q.source_text}` };
  const { text } = await ask(db, env, "grading", [item], GRADE, `Answer:\n${ans}`, { now, fetch: f, maxTokens: 300 });
  if (text === null) throw bad("The grading provider may not read this question's source (visibility). Change the route or the source.", 409);
  const g = parseJSON(text), score = Math.round(Number(g?.score));
  if (!g || !Number.isFinite(score)) throw bad("The grader returned something unreadable. Try again.", 502);
  const s = Math.min(100, Math.max(0, score)), rating = ratingOf(s, pasted);
  const next = schedule(q.stability ? { stability: q.stability, difficulty: q.difficulty, last_review: q.last_review, reps: q.reps, lapses: q.lapses } : null, rating, day);
  const fix = String(g.fix || "").slice(0, 600);
  await db.batch([
    db.prepare(`INSERT INTO reviews (id, question_id, at, day, answer, score, rating, feedback, typed_ms, elapsed_ms, pasted, due, stability, difficulty)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(uid(), id, now.toISOString(), day, ans, s, rating, fix, typed, elapsed, pasted ? 1 : 0, next.due, next.stability, next.difficulty),
    db.prepare("UPDATE questions SET due = ?, stability = ?, difficulty = ?, reps = ?, lapses = ?, last_review = ? WHERE id = ?")
      .bind(next.due, next.stability, next.difficulty, next.reps, next.lapses, day, id)
  ]);
  return { score: s, fix, pasted, rating, due: next.due, interval: next.interval, rubric: q.rubric, check_key: q.check_key || null,
    source: { title: q.source_title, text: q.source_text, meta: q.source_meta ? JSON.parse(q.source_meta) : {}, source_id: q.source_id, kind: q.kind } };
}

export async function retire(db, id) {
  const r = await db.prepare("UPDATE questions SET retired = 1 WHERE id = ?").bind(id).run();
  if (!r.meta.changes) throw bad("Question not found", 404);
  return { ok: true };
}

/** Today's session: due questions (without sources or rubric), what was answered today, what comes next. */
export async function session(db, env, { now = new Date() } = {}) {
  const day = today(env, now);
  const [due, done, made, upcoming, totals] = await db.batch([
    db.prepare("SELECT id, prompt, concept, project, kind, track, reps, lapses, due, day FROM questions WHERE retired = 0 AND due <= ? ORDER BY reps = 0, due LIMIT 50").bind(day),
    db.prepare("SELECT r.question_id, r.score, r.pasted, r.due, q.concept, q.prompt FROM reviews r JOIN questions q ON q.id = r.question_id WHERE r.day = ? ORDER BY r.at").bind(day),
    db.prepare("SELECT count(*) AS n FROM questions WHERE day = ? AND check_key IS NULL").bind(day),
    db.prepare("SELECT due, count(*) AS n FROM questions WHERE retired = 0 AND due > ? GROUP BY due ORDER BY due LIMIT 10").bind(day),
    db.prepare("SELECT (SELECT count(*) FROM questions WHERE retired = 0) AS questions, (SELECT count(*) FROM reviews) AS reviews, (SELECT count(*) FROM reviews WHERE pasted = 1) AS pasted")
  ]);
  return { day, ready: ready(env, "question_gen") && ready(env, "grading"), due: due.results, done: done.results, createdToday: made.results[0].n,
    canCreate: made.results[0].n < MAX_NEW_PER_DAY, upcoming: upcoming.results, totals: totals.results[0] };
}

/**
 * Mastery, from reviews only (no manual input). A question's mastery is its last NON-pasted score × the
 * probability of recall today (FSRS). Pasted reviews are ignored entirely, so pasting can never raise it.
 */
export async function mastery(db, env, { now = new Date() } = {}) {
  const day = today(env, now);
  const rows = (await db.prepare(
    `SELECT q.id, q.prompt, q.concept, q.project, q.track, q.kind, q.due, q.reps, q.check_key, r.score, r.day, r.stability,
            (SELECT count(*) FROM reviews p WHERE p.question_id = q.id AND p.pasted = 1) AS pasted
     FROM questions q LEFT JOIN reviews r ON r.id = (SELECT id FROM reviews r2 WHERE r2.question_id = q.id AND r2.pasted = 0 ORDER BY r2.at DESC LIMIT 1)
     WHERE q.retired = 0 ORDER BY q.created DESC LIMIT 1000`).all()).results;
  const qs = rows.map((r) => ({ ...r, mastery: r.score == null ? null : Math.round(r.score * retrievability(daysBetween(r.day, day), r.stability || 1)) }));
  const group = (key) => {
    const m = new Map();
    for (const q of qs) { const k = q[key]; if (!k) continue; const g = m.get(k) || { key: k, sum: 0, n: 0, questions: 0, pasted: 0 }; g.questions++; g.pasted += q.pasted; if (q.mastery != null) { g.sum += q.mastery; g.n++; } m.set(k, g); }
    return [...m.values()].map((g) => ({ key: g.key, mastery: g.n ? Math.round(g.sum / g.n) : null, proven: g.n, questions: g.questions, pasted: g.pasted })).sort((a, b) => (b.proven - a.proven) || String(a.key).localeCompare(b.key));
  };
  // A Path exit check is proven by its latest honest answer: 70 or more.
  const checks = {};
  for (const q of qs) if (q.check_key && !(q.check_key in checks)) checks[q.check_key] = { score: q.score, mastery: q.mastery, proven: q.score != null && q.score >= 70, id: q.id };
  return { day, tracks: group("track"), concepts: group("concept"), projects: group("project"), checks, questions: qs.slice(0, 200) };
}

const CHECK = `\nThe source is one exit check of a curriculum module (what Matis must be able to do without notes). Ask the question that proves he can do exactly that.`;
/** A question that proves one Path exit check ("<module>#<index>"). One open question per check. */
export async function generateCheck(db, env, body, { now = new Date(), fetch: f } = {}) {
  const key = String(body?.key || ""), check = String(body?.check || "").replace(/<[^>]+>/g, "").trim().slice(0, 1500);
  if (!/^[\w-]{1,60}#\d{1,2}$/.test(key) || !check) throw bad("key must look like <module>#<n>, with the check text.");
  const open = await db.prepare("SELECT id FROM questions WHERE check_key = ? AND retired = 0 ORDER BY created DESC LIMIT 1").bind(key).first();
  if (open) return { created: false, id: open.id };
  const title = `${String(body.title || key.split("#")[0]).slice(0, 120)} · exit check ${Number(key.split("#")[1]) + 1}`;
  const item = { id: `check:${key}`, kind: "check", title, text: check, visibility: "ai" };
  const { text } = await ask(db, env, "question_gen", [item], GEN + CHECK, "", { now, fetch: f });
  const q = parseJSON(text);
  if (!q || typeof q.question !== "string" || !q.question.trim()) throw bad("The model did not return a usable question. Try again.", 502);
  const rubric = (Array.isArray(q.rubric) ? q.rubric : [q.rubric]).filter((x) => typeof x === "string" && x.trim()).map((x) => `- ${x.trim()}`).join("\n") || `- ${check}`;
  const track = TRACKS.includes(body.track) ? body.track : TRACKS.includes(q.track) ? q.track : "ml";
  const id = uid(), day = today(env, now);
  await db.prepare(
    `INSERT INTO questions (id, chunk_id, source_id, kind, project, track, concept, prompt, rubric, source_title, source_text, source_meta, visibility, created, day, due, check_key)
     VALUES (?1, ?2, NULL, 'check', NULL, ?3, ?4, ?5, ?6, ?7, ?8, NULL, 'ai', ?9, ?10, ?10, ?11)`)
    .bind(id, item.id, track, String(q.concept || "").trim().toLowerCase().slice(0, 80) || null, q.question.trim().slice(0, 2000), rubric.slice(0, 3000), title, check, now.toISOString(), day, key).run();
  return { created: true, id };
}

/** Diagnostic Parts 2–4 graded by the model against the key points, instead of self-ticking. */
export async function gradeDiagnostic(db, env, body, { now = new Date(), fetch: f } = {}) {
  if (!ready(env, "grading")) throw bad("No AI provider is available for grading.", 503);
  const part = String(body?.part || "").replace(/[^\w-]/g, "").slice(0, 20), qs = Array.isArray(body?.questions) ? body.questions.slice(0, 12) : [];
  if (!part || !qs.length) throw bad("part and questions are required.");
  const out = [];
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i], answer = String(q.answer || "").slice(0, MAX_ANSWER).trim();
    if (answer.length < 3) { out.push({ score: 0, fix: "No answer." }); continue; }
    const strip = (x) => String(x || "").replace(/<[^>]+>/g, "");
    const item = { id: `diag:${part}:${i}`, kind: "diagnostic", visibility: "ai", title: strip(q.q).slice(0, 200), text: `Question: ${strip(q.q)}\nRubric:\n${(q.keys || []).map((k) => `- ${strip(k)}`).join("\n")}` };
    const { text } = await ask(db, env, "grading", [item], GRADE, `Answer:\n${answer}`, { now, fetch: f, maxTokens: 200 });
    const g = parseJSON(text), score = Math.max(0, Math.min(100, Math.round(Number(g?.score))));
    out.push(Number.isFinite(score) ? { score, fix: String(g.fix || "").slice(0, 300) } : { score: 0, fix: "The grader's reply was unusable: graded 0." });
  }
  return { scores: out, score: Math.round(out.reduce((a, x) => a + x.score, 0) / out.length) };
}
