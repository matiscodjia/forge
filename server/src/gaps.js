// Weak spots: a topic Matis is shaky on becomes a study pack (diagnosis, lesson, the best references from his Path
// and brain, related drills) plus spaced Proof questions. The planner keeps bringing it back until two answers from
// memory score 70+; then it is mastered on its own. Sources of a weak spot: he asks, the tutor panel, a note, the planner.
import { ask, parseJSON, today } from "./proof.js";
import { ready } from "./ai.js";
import { related } from "./explain.js";

const bad = (m, status = 400) => Object.assign(new Error(m), { status });
const cut = (s, n) => String(s ?? "").slice(0, n);
const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 20);
const norm = (t) => String(t || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const TRACKS = ["coding", "ml", "math", "sys", "ship"];
const addDays = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);

export const STUDY = `Matis is training to become an ML research engineer. He is shaky on a topic: it is named below, or infer it from the context (an exercise, what he asked the tutor, failing tests, a note). Build a short study pack so he masters it for good, not just for today.
Reply with JSON only:
{"topic": "<2 to 6 words naming the underlying concept, e.g. 'numpy axes and keepdims'>", "track": "<coding|ml|math|sys|ship>",
 "diagnosis": "<one sentence: what exactly he seems to misunderstand, or what mastering it requires>",
 "lesson": "<Markdown: the intuition, the precise rule, a tiny worked example with shapes or numbers, the classic trap. At most 220 words>",
 "resources": [<indexes from the catalog, best first, 0 to 4, only clearly relevant ones>],
 "drills": [<Arena drill ids that exercise it, 0 to 3>],
 "questions": [{"question": "<answerable from memory in 3 to 8 sentences or a few lines of code>", "rubric": ["<key point>", "<3 to 5 points>"]}, {"question": "<a second, harder question>", "rubric": ["..."]}]}`;

export const MORE = `Matis is still working on a weak spot (below), with the questions he already got. Write ONE new exam question on it, from a different angle than those (predict a behaviour, debug a snippet, derive, compare), answerable from memory in 3 to 8 sentences or a few lines of code.
Reply with JSON only: {"question": "...", "rubric": ["<key point>", "<3 to 5 points>"]}`;

async function catalogOf(db) {
  const r = await db.prepare("SELECT v FROM kv WHERE k = 'ctx'").first().catch(() => null);
  const ctx = r ? JSON.parse(r.v) : {};
  return { res: Array.isArray(ctx?.res) ? ctx.res.slice(0, 200) : [], drills: Array.isArray(ctx?.drills) ? ctx.drills : [] };
}

async function insertQuestion(db, gap, q, { day, due, track, now }) {
  const rubric = (Array.isArray(q.rubric) ? q.rubric : [q.rubric]).filter((x) => typeof x === "string" && x.trim()).map((x) => `- ${x.trim()}`).join("\n") || "- A correct, specific explanation.";
  const id = uid();
  await db.prepare(`INSERT INTO questions (id, chunk_id, source_id, kind, project, track, concept, prompt, rubric, source_title, source_text, source_meta, visibility, created, day, due, gap_id)
    VALUES (?1, ?2, NULL, 'gap', NULL, ?3, ?4, ?5, ?6, ?7, ?8, '{}', 'ai', ?9, ?10, ?11, ?12)`)
    .bind(id, `gap:${gap.id}`, track, cut(gap.topic, 80).toLowerCase(), cut(q.question, 2000).trim(), cut(rubric, 3000), `Weak spot · ${gap.topic}`, cut(gap.lesson || gap.topic, 6000), now.toISOString(), day, due, gap.id).run();
  return id;
}

/** POST /api/gaps { topic?, context?, origin? } → the weak spot (existing one when the topic is already open). */
export async function createGap(db, env, b, { now = new Date(), fetch: f } = {}) {
  const topic = cut(b?.topic, 120).trim(), context = cut(b?.context, 6000).trim(), origin = ["ask", "tutor", "note", "planner"].includes(b?.origin) ? b.origin : "ask";
  if (!topic && !context) throw bad("Name a topic, or ask from an exercise.");
  if (!ready(env, "assistant")) throw bad("No AI provider is available to build a study pack.", 503);
  const open = (await db.prepare("SELECT id, norm FROM gaps WHERE status = 'open'").all()).results;
  const same = (t) => { const n = norm(t); return n && open.find((g) => g.norm === n || (n.length > 5 && (g.norm.includes(n) || n.includes(g.norm)))); };
  if (topic && same(topic)) return getGap(db, same(topic).id, { now, env });

  const cat = await catalogOf(db);
  const brain = await related(db, `${topic} ${context}`, { limit: 3 }).catch(() => []);
  const items = [
    { id: "gap:request", kind: "request", visibility: "ai", title: topic ? `Topic: ${topic}` : "Infer the topic from the context", text: `${topic ? `Topic: ${topic}\n` : ""}${context ? `Context:\n${context}` : ""}` },
    { id: "gap:catalog", kind: "catalog", visibility: "ai", title: "Catalog of references (Path reading lists)", text: cat.res.map((r, i) => `${i}. [${r[0]}] ${r[1]}${r[3] ? ` (module ${r[3]})` : ""}`).join("\n") || "(empty)" },
    { id: "gap:drills", kind: "drills", visibility: "ai", title: "Arena drills", text: cat.drills.map((d) => `- ${d.id}: ${d.title}`).join("\n") || "(none)" },
    ...brain.map((r) => ({ id: `gap:brain:${r.source_id}`, kind: r.kind, visibility: "ai", title: r.title, text: cut(r.text, 1200) }))
  ];
  const { text } = await ask(db, env, "assistant", items, STUDY, "", { now, fetch: f, maxTokens: 1400 });
  const x = parseJSON(text);
  if (!x || typeof x.lesson !== "string" || !Array.isArray(x.questions)) throw bad("The assistant did not return a usable study pack. Try again.", 502);
  const name = cut(x.topic || topic, 80).trim() || topic || "weak spot";
  if (!topic && same(name)) return getGap(db, same(name).id, { now, env });
  const track = TRACKS.includes(x.track) ? x.track : "ml";
  const resources = [...new Set((Array.isArray(x.resources) ? x.resources : []).map(Number).filter((i) => Number.isInteger(i) && cat.res[i]))].slice(0, 4).map((i) => { const [k, t, u, mod] = cat.res[i]; return { k, t, u, mod: mod || null }; });
  const drills = [...new Set((Array.isArray(x.drills) ? x.drills : []).filter((d) => cat.drills.some((y) => y.id === d)))].slice(0, 3);
  const pack = { diagnosis: cut(x.diagnosis, 300).trim(), lesson: cut(x.lesson, 4000).trim(), resources, drills, brain: brain.map((r) => ({ source_id: r.source_id, kind: r.kind, title: r.title })) };
  const id = uid(), t = now.toISOString(), day = today(env, now);
  await db.prepare("INSERT INTO gaps (id, topic, norm, track, origin, context, pack, status, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)")
    .bind(id, name, norm(name), track, origin, context || null, JSON.stringify(pack), t, t).run();
  const gap = { id, topic: name, lesson: pack.lesson };
  const qs = x.questions.filter((q) => q && typeof q.question === "string" && q.question.trim()).slice(0, 2);
  for (const [i, q] of qs.entries()) await insertQuestion(db, gap, q, { day, due: addDays(day, i ? 3 : 1), track, now });
  return getGap(db, id, { now, env });
}

const latest = `SELECT q.id, q.prompt, q.due, q.reps, (SELECT r.score FROM reviews r WHERE r.question_id = q.id AND r.pasted = 0 ORDER BY r.at DESC LIMIT 1) AS score
  FROM questions q WHERE q.gap_id = ? AND q.retired = 0 ORDER BY q.created`;
function shape(g, qs) {
  const proven = qs.filter((q) => q.score != null && q.score >= 70).length;
  return { id: g.id, topic: g.topic, track: g.track, origin: g.origin, status: g.status, created: g.created, closed: g.closed, ...(g.pack ? JSON.parse(g.pack) : {}),
    questions: qs.map((q) => ({ id: q.id, prompt: q.prompt, due: q.due, answered: q.reps > 0, score: q.score })), proven, total: qs.length };
}

export async function getGap(db, id, { now = new Date(), env = {} } = {}) {
  const g = await db.prepare("SELECT * FROM gaps WHERE id = ?").bind(id).first(); if (!g) throw bad("Weak spot not found", 404);
  return shape(g, (await db.prepare(latest).bind(id).all()).results);
}

/** GET /api/gaps → { open, mastered } ; an open weak spot with two answers ≥ 70 becomes mastered here. */
export async function listGaps(db, { now = new Date() } = {}) {
  const gs = (await db.prepare("SELECT * FROM gaps WHERE status != 'dropped' ORDER BY created DESC LIMIT 60").all()).results;
  const out = [];
  for (const g of gs) {
    const s = shape(g, (await db.prepare(latest).bind(g.id).all()).results);
    if (s.status === "open" && s.proven >= 2) { await db.prepare("UPDATE gaps SET status = 'mastered', closed = ?, updated = ? WHERE id = ?").bind(now.toISOString(), now.toISOString(), g.id).run(); s.status = "mastered"; s.closed = now.toISOString(); }
    out.push(s);
  }
  return { open: out.filter((g) => g.status === "open"), mastered: out.filter((g) => g.status === "mastered") };
}

/** POST /api/gaps/:id/drop → no longer practised; its unanswered questions are retired. */
export async function dropGap(db, id, { now = new Date() } = {}) {
  const g = await db.prepare("SELECT id FROM gaps WHERE id = ?").bind(id).first(); if (!g) throw bad("Weak spot not found", 404);
  await db.batch([db.prepare("UPDATE gaps SET status = 'dropped', closed = ?, updated = ? WHERE id = ?").bind(now.toISOString(), now.toISOString(), id),
    db.prepare("UPDATE questions SET retired = 1 WHERE gap_id = ? AND reps = 0").bind(id)]);
  return { ok: true };
}

/** One more question on an open weak spot, when every existing one has been answered (the planner calls this). */
export async function morePractice(db, env, id, { now = new Date(), fetch: f } = {}) {
  const g = await getGap(db, id, { now, env });
  if (g.status !== "open" || g.questions.some((q) => !q.answered)) return null;
  const items = [{ id: `gap:${id}`, kind: "gap", visibility: "ai", title: `Weak spot: ${g.topic}`, text: `${g.diagnosis || ""}\n\n${g.lesson || ""}\n\nQuestions he already got:\n${g.questions.map((q) => `- ${q.prompt}${q.score != null ? ` (scored ${q.score})` : ""}`).join("\n")}` }];
  const { text } = await ask(db, env, "question_gen", items, MORE, "", { now, fetch: f, maxTokens: 500 });
  const q = parseJSON(text); if (!q || typeof q.question !== "string" || !q.question.trim()) return null;
  const day = today(env, now);
  return insertQuestion(db, { id, topic: g.topic, lesson: g.lesson }, q, { day, due: addDays(day, 1), track: g.track || "ml", now });
}

/** For the planner: open weak spots, one line each. */
export async function openGapsSummary(db, now = new Date()) {
  const { open } = await listGaps(db, { now });
  return open.map((g) => ({ id: g.id, topic: g.topic, line: `- ${g.id}: ${g.topic} (${g.origin}, since ${g.created.slice(0, 10)}): ${g.proven}/${g.total} questions proven${g.diagnosis ? `; ${cut(g.diagnosis, 140)}` : ""}` }));
}
