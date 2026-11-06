// Weak spots: a study pack from a topic or from an exercise context, references picked only from the catalog,
// two spaced Proof questions, mastered on its own after two answers ≥ 70; the planner practises and detects them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGap, listGaps, dropGap, morePractice } from "../src/gaps.js";
import { plan } from "../src/planner.js";
import { answer, session, generate } from "../src/proof.js";
import { fileThought } from "../src/capture.js";
import { fakeD1, setup, gradeReply } from "./helpers/env.js";

const ctx = { drills: [{ id: "softmax", title: "Stable softmax", lvl: 1, track: "ml" }, { id: "attention", title: "Causal self-attention", lvl: 3, track: "ml" }], modules: [{ id: "numpy", t: "NumPy", status: "active", track: "ml", checks: ["Broadcasting rules"] }],
  res: [["video", "3Blue1Brown — Essence of linear algebra", "https://youtube.com/x", "linalg"], ["blog", "NumPy — Broadcasting", "https://numpy.org/doc/stable/user/basics.broadcasting.html", "numpy"], ["paper", "Attention Is All You Need", "https://arxiv.org/abs/1706.03762", "gpt"]] };
const PACK = { topic: "numpy axes and keepdims", track: "ml", diagnosis: "You reduce over the wrong axis and lose the dimension needed to broadcast back.", lesson: "**Intuition.** `axis=k` collapses dimension $k$…", resources: [1, 7, 1], drills: ["softmax", "nope"],
  questions: [{ question: "x has shape (B, T, V). What does x.max(axis=-1, keepdims=True) return, and why keepdims?", rubric: ["shape (B, T, 1)", "broadcasts back against x"] }, { question: "Find the bug: e / e.sum(axis=0)", rubric: ["wrong axis"] }] };
const AI = (over = {}) => { const calls = []; return { calls, run: async (m, { messages }) => {
  const sys = messages[0].content; calls.push({ sys, user: messages[1].content });
  if (sys.includes("study pack")) return { response: JSON.stringify({ ...PACK, ...over }) };
  if (sys.includes("ONE new exam question")) return { response: '{"question": "Predict the shape of x.sum(axis=(0, 2)) for x of shape (2, 3, 4).", "rubric": ["(3,)"]}' };
  if (sys.includes("planning agent")) return { response: '{"drill": "softmax", "gap": null, "new_gap": "matrix calculus shapes", "why": "x"}' };
  if (sys.includes("Forge's assistant")) return { response: '{"note": "new", "title": "Axes", "gap": "numpy axes", "nudge": "n"}' };
  return { response: gradeReply(messages[1].content, "ff") };
} }; };
async function seedCtx(db) { await db.prepare("INSERT INTO kv (k, v, rev, updated) VALUES ('ctx', ?, 1, 'x')").bind(JSON.stringify(ctx)).run(); }
const at = (d) => new Date(`${d}T10:00:00+01:00`);

test("a study pack: diagnosis, lesson, catalog references only, real drills, two spaced questions; deduplicated", async () => {
  const db = fakeD1(), ai = AI(); await seedCtx(db);
  const g = await createGap(db, { AI: ai }, { topic: "", context: "Arena · Stable softmax. Matis: why does my e / e.sum() give wrong rows? failing: rows sum to 1", origin: "tutor" }, { now: at("2026-11-06") });
  assert.equal(g.topic, "numpy axes and keepdims"); assert.equal(g.origin, "tutor"); assert.equal(g.status, "open");
  assert.deepEqual(g.resources.map((r) => r.t), ["NumPy — Broadcasting"], "index 7 does not exist, duplicates dropped");
  assert.deepEqual(g.drills, ["softmax"]);
  assert.deepEqual(g.questions.map((q) => q.due), ["2026-11-07", "2026-11-09"]);
  assert.match(ai.calls[0].user, /1\. \[blog\] NumPy — Broadcasting \(module numpy\)/); assert.match(ai.calls[0].user, /e \/ e\.sum\(\)/);
  const again = await createGap(db, { AI: ai }, { topic: "NumPy axes" }, { now: at("2026-11-06") });
  assert.equal(again.id, g.id, "same open topic → same weak spot"); assert.equal(ai.calls.length, 1);
  assert.equal((await generate(db, { AI: ai }, { now: at("2026-11-06") }).catch((e) => e)).status, 409, "weak-spot questions don't use up the daily question (no sources here → 409, not 'already one today')");
});

test("answers from memory prove it: two ≥ 70 → mastered; more practice only when all are answered; drop retires", async () => {
  const db = fakeD1(), ai = AI(); await seedCtx(db);
  const g = await createGap(db, { AI: ai }, { topic: "numpy axes and keepdims" }, { now: at("2026-11-06") });
  assert.equal(await morePractice(db, { AI: ai }, g.id, { now: at("2026-11-06") }), null, "questions still unanswered");
  const due = (await session(db, { AI: ai }, { now: at("2026-11-09") })).due.map((q) => q.id);
  assert.deepEqual(due.sort(), g.questions.map((q) => q.id).sort());
  for (const q of g.questions) await answer(db, { AI: ai }, q.id, { answer: "keepdims keeps a size-1 axis so the result broadcasts back over x.", typed_ms: 9000 }, { now: at("2026-11-09") });
  const { open, mastered } = await listGaps(db, { now: at("2026-11-09") });
  assert.equal(open.length, 0); assert.equal(mastered[0].id, g.id); assert.equal(mastered[0].proven, 2);

  const h = await createGap(db, { AI: ai }, { topic: "einsum" }, { now: at("2026-11-09") });
  await dropGap(db, h.id);
  assert.equal((await listGaps(db)).open.length, 0);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM questions WHERE gap_id = ? AND retired = 0").bind(h.id).first()).n, 0);
});

test("the planner sees open weak spots, practises one and can detect a new one; capture can flag one", async () => {
  const db = fakeD1(), ai = AI({ topic: "matrix calculus shapes" }); await seedCtx(db);
  const r = await plan(db, { AI: ai }, { now: at("2026-11-06"), force: true });
  assert.equal(r.plan.new_gap, "matrix calculus shapes"); assert.ok(r.plan.newGapId); assert.equal(r.plan.gap, r.plan.newGapId);
  const r2 = await plan(db, { AI: ai }, { now: at("2026-11-07"), force: true });
  assert.match(ai.calls.filter((c) => c.sys.includes("planning agent")).at(-1).user, /Open weak spots[\s\S]*matrix calculus shapes \(planner/);
  assert.equal(r2.plan.gap, r.plan.newGapId, "falls back to the open weak spot"); assert.equal(r2.plan.new_gap, null, "already known");
  const f = await fileThought(db, { AI: ai }, { text: "je ne comprends pas les axes", notes: [], modules: [] }, { now: at("2026-11-07") });
  assert.equal(f.gap, "numpy axes");
});

test("routes", async () => {
  const { call, env } = setup({ AI: AI() }); await seedCtx(env.DB);
  const g = await call("POST", "/api/gaps", { topic: "numpy axes" });
  assert.equal((await call("GET", "/api/gaps")).open[0].id, g.id);
  assert.equal((await call("GET", `/api/gaps/${g.id}`)).topic, "numpy axes and keepdims");
  await call("POST", `/api/gaps/${g.id}/drop`, {});
  await assert.rejects(call("POST", "/api/gaps", {}), (e) => e.status === 400);
});
