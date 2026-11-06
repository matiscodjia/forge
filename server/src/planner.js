// Planner agent: every night it reads the evidence (synced state, Proof mastery, Git activity) and writes
// tomorrow's plan: one drill, one module, the exit checks to test, the weak concepts to revisit, and why.
// Then it acts: it creates the Proof questions for those checks. Its choices are validated against what exists;
// an unusable reply falls back to a deterministic plan, so the app never waits on the model.
import { ask, mastery, generateCheck, today, parseJSON } from "./proof.js";
import { ready } from "./ai.js";

const bad = (m, status = 400) => Object.assign(new Error(m), { status });
const KEYS = ["drills", "practice", "path", "log", "ctx"];

export const PLAN = `You are the planning agent of Forge, Matis's training system (goal: ML research engineer interviews by March 2027).
From the evidence in the source, plan TOMORROW. Choose:
- "drill": one Arena drill id from the list. Prefer a drill he tried and failed recently; otherwise the next unsolved one in order. Never a solved one unless all are solved.
- "module": one Path module id from the candidates. Keep the active module unless all its exit checks are proven.
- "checks": 1 or 2 indexes of that module's exit checks to test tomorrow, unproven first.
- "concepts": up to 3 weak concepts (from the mastery list) to revisit.
- "why": one short sentence addressed to Matis ("you…") explaining the plan from the evidence.
Reply with JSON only: {"drill": "<id>", "module": "<id>", "checks": [0], "concepts": ["..."], "why": "..."}`;

async function evidence(db, env, now) {
  const kv = Object.fromEntries((await db.prepare(`SELECT k, v FROM kv WHERE k IN (${KEYS.map(() => "?").join(",")})`).bind(...KEYS).all()).results.map((r) => [r.k, JSON.parse(r.v)]));
  const S = Object.fromEntries(KEYS.map((k) => [k, kv[k] || (k === "log" ? [] : {})]));
  const m = await mastery(db, env, { now });
  const since = new Date(now.getTime() - 7 * 864e5).toISOString();
  const commits = (await db.prepare("SELECT count(*) AS n FROM sources WHERE kind = 'commit' AND created >= ?").bind(since).first("n")) || 0;
  return { S, m, commits };
}

export function summarize({ S, m, commits }, day) {
  const drills = S.ctx?.drills || [], mods = S.ctx?.modules || [];
  const dline = (d) => { const st = S.drills?.[d.id] || {}; return `- ${d.id} (L${d.lvl}, ${d.title}): ${st.solved ? `solved${st.hints ? ` with ${st.hints} hints` : ""}` : st.attempts ? `tried ${st.attempts}×, best ${st.best || 0}/${st.total || "?"} tests${st.last ? `, last ${st.last}` : ""}` : "not started"}`; };
  const week = new Date(Date.parse(day) - 7 * 864e5).toISOString().slice(0, 10), by = {};
  (S.log || []).forEach((e) => { if (e.date >= week) by[e.area] = (by[e.area] || 0) + e.min; });
  const mline = (x) => `- ${x.id} (${x.t}, ${x.status}): ${(x.checks || []).map((c, i) => { const p = m.checks?.[`${x.id}#${i}`]; return `[${i}] ${p ? (p.proven ? `proven ${p.score}` : `not proven, last ${p.score ?? "unanswered"}`) : "untested"}: ${String(c).replace(/<[^>]+>/g, "").slice(0, 140)}`; }).join(" | ")}`;
  const weak = (m.concepts || []).filter((c) => c.mastery != null).sort((a, b) => a.mastery - b.mastery).slice(0, 6).map((c) => `${c.key} ${c.mastery}%`);
  const solvedPat = Object.values(S.practice || {}).filter((p) => p.solved).length;
  return [`Today is ${day}.`, "Arena drills (in order):", ...drills.map(dline),
    `Interview patterns solved: ${solvedPat}.`, "Path module candidates:", ...mods.map(mline),
    `Active minutes last 7 days by area: ${Object.entries(by).map(([a, n]) => `${a} ${Math.round(n)}`).join(", ") || "none"}.`,
    `Weakest concepts (Proof mastery): ${weak.join(", ") || "none yet"}.`, `Commits last 7 days: ${commits}.`].join("\n");
}

/** Keep only what exists; fill the gaps deterministically. */
export function validate(raw, { S, m }) {
  const drills = S.ctx?.drills || [], mods = S.ctx?.modules || [];
  const solved = (id) => !!S.drills?.[id]?.solved;
  const p = raw && typeof raw === "object" ? raw : {};
  const drill = drills.some((d) => d.id === p.drill) ? p.drill : (drills.find((d) => !solved(d.id)) || drills[0] || {}).id || null;
  const mod = mods.find((x) => x.id === p.module) || mods.find((x) => x.status === "active") || mods[0] || null;
  const proven = (i) => !!m.checks?.[`${mod.id}#${i}`]?.proven;
  let checks = mod ? (Array.isArray(p.checks) ? p.checks : []).map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < (mod.checks || []).length && !proven(i)) : [];
  if (mod && !checks.length) checks = (mod.checks || []).map((_, i) => i).filter((i) => !proven(i));
  checks = [...new Set(checks)].slice(0, 2);
  const concepts = (Array.isArray(p.concepts) ? p.concepts : []).filter((c) => typeof c === "string").map((c) => c.trim().toLowerCase().slice(0, 80)).filter(Boolean).slice(0, 3);
  const why = typeof p.why === "string" && p.why.trim() ? p.why.trim().slice(0, 300) : "Default plan: the next unsolved drill and the active module's unproven checks.";
  return { drill, module: mod ? mod.id : null, checks, concepts, why, fallback: !raw };
}

export async function getPlan(db, env, { now = new Date() } = {}) {
  const r = await db.prepare("SELECT plan, at FROM plans WHERE day = ?").bind(today(env, now)).first();
  return { plan: r ? JSON.parse(r.plan) : null, ready: ready(env, "planner") };
}

/** Write today's plan (cron: once; button: force) and create the check questions it asks for. */
export async function plan(db, env, { now = new Date(), fetch: f, force = false } = {}) {
  const day = today(env, now);
  if (!force) { const have = await db.prepare("SELECT plan FROM plans WHERE day = ?").bind(day).first(); if (have) return { created: false, plan: JSON.parse(have.plan) }; }
  if (!ready(env, "planner")) throw bad("No AI provider is available for the planner.", 503);
  const ev = await evidence(db, env, now);
  if (!(ev.S.ctx?.drills || []).length) throw bad("Open Forge once so the planner knows the drills and modules.", 409);
  const item = { id: `evidence:${day}`, kind: "summary", visibility: "trusted", title: "Matis's evidence", text: summarize(ev, day) };
  const { text } = await ask(db, env, "planner", [item], PLAN, "", { now, fetch: f, maxTokens: 400 });
  const p = validate(parseJSON(text), ev);
  const mod = (ev.S.ctx.modules || []).find((x) => x.id === p.module);
  p.questions = [];
  for (const i of mod ? p.checks : []) {
    try { const r = await generateCheck(db, env, { key: `${mod.id}#${i}`, title: mod.t, check: mod.checks[i], track: mod.track }, { now, fetch: f }); p.questions.push(r.id); }
    catch (e) { p.error = e.message; }
  }
  await db.prepare("INSERT INTO plans (day, plan, at) VALUES (?, ?, ?) ON CONFLICT(day) DO UPDATE SET plan = excluded.plan, at = excluded.at").bind(day, JSON.stringify(p), now.toISOString()).run();
  return { created: true, plan: p };
}

/** Commits per day (author date), for the "ship" block. */
export async function activity(db, { now = new Date() } = {}) {
  const since = new Date(now.getTime() - 200 * 864e5).toISOString();
  const rows = (await db.prepare("SELECT substr(created, 1, 10) AS d, count(*) AS n FROM sources WHERE kind = 'commit' AND created >= ? GROUP BY d").bind(since).all()).results;
  return { commits: Object.fromEntries(rows.map((r) => [r.d, r.n])) };
}
