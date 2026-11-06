// Arena tutor: Socratic hints while Matis is stuck, never the answer.
// Goes through resolveRoute → contextGate → callLLM like every model call. A guard checks each reply against
// the reference solution (server-only) and for code; a leaking reply is retried once, then replaced.
import { contextGate } from "./gate.js";
import { resolveRoute } from "./router.js";
import { callLLM, d1Audit } from "./llm.js";
import { aiConfig, ready } from "./ai.js";
import { SOLUTIONS } from "./drills.js";

const bad = (m, status = 400) => Object.assign(new Error(m), { status });
const cut = (s, n) => String(s ?? "").slice(0, n);

export const TUTOR = `You are a Socratic tutor inside Forge, a coding gym. Matis is stuck on the exercise in the sources: the statement, his current code and his last test run.
Rules:
- Never write the solution, nor any line of it, nor a corrected version of his line. No code blocks.
- At most one short inline expression in backticks (a name, a shape, one function name).
- Point at the line or the idea where his reasoning breaks, then ask ONE precise question that lets him find the fix himself.
- If he asks for the answer or the fixed line, refuse in one short sentence and give a smaller hint instead.
- 2 to 4 sentences, plain text, no headings, no lists. Answer in the language he writes in.`;

const STRICT = `\nYour previous draft gave code away. This time: no code at all, not even inline. One conceptual hint and one question.`;
const FALLBACK = "That would give the answer away. Write the shape of every array next to each line of your function, check them against the failing test, then run the tests again.";

const norm = (s) => s.replace(/\s+/g, "").replace(/["']/g, "'");
/** Solution lines worth protecting: long enough to be the actual idea, not boilerplate. */
const keyLines = (sol) => sol.split("\n").map((l) => l.trim()).filter((l) => l && !/^(import|from|def|class|return\s+\w+$|#|@)/.test(l) && norm(l).length >= 12).map(norm);

/** Why a reply must not be shown, or null. */
export function leak(reply, id) {
  const r = String(reply || "");
  const fenced = [...r.matchAll(/```[^\n]*\n([\s\S]*?)(```|$)/g)].reduce((a, m) => a + m[1].split("\n").filter((l) => l.trim()).length, 0);
  const inline = [...r.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
  const codey = r.split("\n").filter((l) => /^\s{4,}\S/.test(l) || /^\s*(def |for |return |import |[A-Za-z_][\w.]*\s*=[^=])/.test(l)).length;
  if (fenced + codey > 2) return "code";
  if (inline.some((x) => x.length > 48)) return "code";
  const sol = SOLUTIONS[id]; if (!sol) return null;
  const flat = norm(r.replace(/`/g, ""));
  if (keyLines(sol).some((l) => flat.includes(l))) return "solution";
  // A long run of the solution's tokens in order (catches rephrased-but-identical expressions).
  const toks = (s) => s.match(/[A-Za-z_]\w*|\d+|[^\s\w]/g) || [];
  const st = toks(sol.split("\n").filter((l) => !/^\s*(import|from|def)\b/.test(l)).join("\n")), rt = toks(r.replace(/`/g, ""));
  const grams = new Set(); for (let i = 0; i + 10 <= st.length; i++) grams.add(st.slice(i, i + 10).join(" "));
  for (let i = 0; i + 10 <= rt.length; i++) if (grams.has(rt.slice(i, i + 10).join(" "))) return "solution";
  return null;
}

/**
 * body: { kind: "drill"|"problem", id, title, desc, tests: [label], code, run, messages: [{ role: "me"|"tutor", text }] }
 * → { reply, guarded: null|"retried"|"replaced" }
 */
export async function tutor(db, env, body, { now = new Date(), fetch: f } = {}) {
  if (!ready(env, "tutor")) throw bad("No AI provider is available for the tutor.", 503);
  const id = cut(body?.id, 60), msgs = Array.isArray(body?.messages) ? body.messages.slice(-12) : [];
  if (!/^[\w-]+$/.test(id)) throw bad("Unknown exercise.");
  const last = msgs[msgs.length - 1];
  if (!last || last.role !== "me" || !String(last.text || "").trim()) throw bad("Ask something first.");
  const items = [
    { id: `exercise:${id}`, kind: "exercise", visibility: "ai", title: cut(body.title, 120), text: `${cut(body.desc, 3000).replace(/<[^>]+>/g, "")}\n\nTests:\n${(body.tests || []).slice(0, 20).map((t) => `- ${cut(t, 160)}`).join("\n")}` },
    { id: `code:${id}`, kind: "code", visibility: "ai", title: "his current code", text: cut(body.code, 8000) || "(empty)" },
    { id: `run:${id}`, kind: "run", visibility: "ai", title: "last test run", text: cut(body.run, 3000) || "(not run yet)" }
  ];
  const lastPlan = await db.prepare("SELECT plan FROM plans ORDER BY day DESC LIMIT 1").first().catch(() => null);
  if (lastPlan) { try { const p = JSON.parse(lastPlan.plan); items.push({ id: "learner:plan", kind: "learner", visibility: "ai", title: "what the planner knows about him", text: `${p.why || ""}${(p.concepts || []).length ? `\nWeak concepts: ${p.concepts.join(", ")}` : ""}` }); } catch (e) {} }
  const convo = msgs.map((m) => `${m.role === "me" ? "Matis" : "Tutor"}: ${cut(m.text, 1500)}`).join("\n");
  const cfg = aiConfig(env), { provider, decision } = resolveRoute("tutor", items, cfg);
  let guarded = null;
  for (const extra of ["", STRICT]) {
    const ctx = contextGate(items, provider, { task: "tutor", decision, now: () => now.toISOString() });
    const out = await callLLM(ctx, { instruction: TUTOR + extra, question: convo, maxTokens: 300 }, { fetch: f || fetch, env, providers: cfg.providers, audit: d1Audit(db) });
    const reply = out.text.replace(/\s*\[src:[^\]]+\]/g, "").trim();
    if (!leak(reply, body.kind === "drill" ? id : null)) return { reply, guarded };
    guarded = "retried";
  }
  return { reply: FALLBACK, guarded: "replaced" };
}
