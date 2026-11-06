// Autonomy: the planner reads the evidence and writes a validated plan, then creates the Proof questions for the
// exit checks it picked; an answer ≥ 70 proves a check. Diagnostics are graded by the model. DeepSeek routing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { plan, getPlan, validate, summarize, activity } from "../src/planner.js";
import { answer, mastery, gradeDiagnostic } from "../src/proof.js";
import { aiConfig, routing } from "../src/ai.js";
import { tutor } from "../src/tutor.js";
import { fakeD1, setup, gradeReply } from "./helpers/env.js";

const ctx = {
  drills: [{ id: "softmax", title: "Stable softmax", lvl: 1, track: "ml" }, { id: "attention", title: "Causal self-attention", lvl: 3, track: "ml" }, { id: "mha", title: "Multi-head attention", lvl: 3, track: "ml" }],
  modules: [{ id: "linalg", t: "Linear algebra", status: "active", track: "math", checks: ["Explain <b>SVD</b> geometrically", "Derive the normal equations", "Say why PCA uses the covariance's eigenvectors"] }, { id: "calc", t: "Calculus", status: "todo", track: "math", checks: ["Chain rule on a graph"] }]
};
async function seedState(db, extra = {}) {
  const kv = { ctx, drills: { softmax: { attempts: 1, solved: true }, attention: { attempts: 3, solved: false, best: 3, total: 6, last: "2026-11-05" } }, log: [{ date: "2026-11-05", area: "math", min: 40 }], ...extra };
  for (const [k, v] of Object.entries(kv)) await db.prepare("INSERT INTO kv (k, v, rev, updated) VALUES (?, ?, 1, ?)").bind(k, JSON.stringify(v), "2026-11-05T00:00:00Z").run();
}
function mockAI(planReply, scores = []) {
  const calls = [];
  return { calls, run: async (model, { messages }) => {
    const sys = messages[0].content; calls.push({ sys, user: messages[1].content });
    if (sys.includes("planning agent")) return { response: planReply };
    if (sys.includes("ONE exam question")) return { response: JSON.stringify({ concept: "svd", track: "math", question: `Q about: ${messages[1].content.match(/<source[^>]*>\n([^\n]*)/)[1]}`, rubric: ["point"] }) };
    return { response: gradeReply(messages[1].content, scores.shift()) };
  } };
}
const now = new Date("2026-11-06T04:00:00+01:00");

test("planner: validated plan, check questions created, idempotent per day, answer ≥ 70 proves a check", async () => {
  const db = fakeD1(); await seedState(db);
  const AI = mockAI('Sure:\n{"drill": "nope", "module": "linalg", "checks": [5, 1, 1], "concepts": ["SVD"], "why": "You failed attention twice; finish it."}', ["f", "p"]);
  const r = await plan(db, { AI }, { now });
  assert.equal(r.created, true);
  assert.equal(r.plan.drill, "attention", "unknown id → first unsolved drill");
  assert.deepEqual(r.plan.checks, [1], "out-of-range and duplicate indexes dropped");
  assert.equal(r.plan.why, "You failed attention twice; finish it.");
  assert.equal(r.plan.questions.length, 1);
  const planCall = AI.calls.find((c) => c.sys.includes("planning agent"));
  assert.match(planCall.user, /attention \(L3, Causal self-attention\): tried 3×, best 3\/6/); assert.match(planCall.user, /\[1\] untested: Derive the normal equations/);
  assert.match(AI.calls.find((c) => c.sys.includes("exit check")).user, /Derive the normal equations/);
  assert.equal((await plan(db, { AI }, { now })).created, false, "the cron writes one plan a day");
  assert.equal((await getPlan(db, { AI }, { now })).plan.drill, "attention");

  const qid = r.plan.questions[0];
  await answer(db, { AI }, qid, { answer: "Set the gradient of the squared error to zero: XᵀX w = Xᵀy.", typed_ms: 9000 }, { now });
  const m = await mastery(db, { AI }, { now });
  assert.equal(m.checks["linalg#1"].proven, true); assert.equal(m.checks["linalg#1"].score, 100);

  // Next day: check 1 is proven, so the plan moves to the others even if the model insists.
  const r2 = await plan(db, { AI: mockAI('{"drill": "attention", "module": "linalg", "checks": [1], "why": "again"}') }, { now: new Date("2026-11-07T04:00:00+01:00") });
  assert.deepEqual(r2.plan.checks, [0, 2]);
});

test("planner: unusable reply → deterministic fallback; no context → 409; no provider → 503", async () => {
  const db = fakeD1(); await seedState(db);
  const r = await plan(db, { AI: mockAI("I think you should rest.") }, { now });
  assert.equal(r.plan.fallback, true); assert.equal(r.plan.drill, "attention"); assert.equal(r.plan.module, "linalg"); assert.deepEqual(r.plan.checks, [0, 1]);
  await assert.rejects(plan(fakeD1(), { AI: mockAI("{}") }, { now }), (e) => e.status === 409);
  await assert.rejects(plan(db, {}, { now, force: true }), (e) => e.status === 503);
  assert.equal(validate(null, { S: { ctx: { drills: [], modules: [] } }, m: {} }).drill, null);
  assert.match(summarize({ S: { ctx }, m: { checks: {} }, commits: 4 }, "2026-11-06"), /Commits last 7 days: 4/);
});

test("diagnostic parts are graded by the model; empty answers score 0", async () => {
  const db = fakeD1(), AI = mockAI("", ["f", "p"]);
  const r = await gradeDiagnostic(db, { AI }, { part: "ml", questions: [{ q: "Why <i>scale</i>?", keys: ["variance"], answer: "To keep the softmax away from saturation." }, { q: "Q2", keys: ["k"], answer: "" }, { q: "Q3", keys: ["k"], answer: "partly" }] }, { now });
  assert.deepEqual(r.scores.map((x) => x.score), [100, 0, 50]); assert.equal(r.score, 50);
  assert.ok(!AI.calls[0].user.includes("<i>"), "HTML stripped");
});

test("routes, activity, and DeepSeek routing with the secret set", async () => {
  const AI = mockAI('{"drill": "mha"}');
  const { call, env } = setup({ AI });
  await seedState(env.DB);
  assert.equal((await call("GET", "/api/health")).planner, true);
  assert.equal((await call("GET", "/api/plan")).plan, null);
  assert.equal((await call("POST", "/api/plan", {})).plan.drill, "mha");
  await env.DB.prepare("INSERT INTO sources (id, kind, title, visibility, created, updated, rev) VALUES ('c1', 'commit', 'x', 'ai', '2026-11-05T10:00:00Z', 'x', 0), ('c2', 'commit', 'y', 'ai', '2026-11-05T18:00:00Z', 'x', 0)").run();
  assert.equal((await activity(env.DB, { now })).commits["2026-11-05"], 2);
  const q = await call("POST", "/api/proof/check", { key: "linalg#0", title: "Linear algebra", check: "Explain SVD" });
  assert.equal((await call("POST", "/api/proof/check", { key: "linalg#0", title: "Linear algebra", check: "Explain SVD" })).id, q.id, "one open question per check");
  await assert.rejects(call("POST", "/api/proof/check", { key: "bad key", check: "x" }), (e) => e.status === 400);

  const ds = { DEEPSEEK_API_KEY: "k", AI };
  assert.equal(aiConfig(ds).providers.deepseek.baseUrl, "https://api.deepseek.com");
  assert.deepEqual(Object.values(routing(ds)), ["deepseek", "deepseek", "deepseek", "deepseek", "deepseek"]);
  let hit = null;
  const fetch = async (url, init) => { hit = { url, auth: init.headers.authorization, body: JSON.parse(init.body) }; return new Response(JSON.stringify({ choices: [{ message: { content: "Which axis holds T?" } }] })); };
  const r = await tutor(fakeD1(), ds, { kind: "drill", id: "attention", title: "t", desc: "d", tests: [], code: "", run: "", messages: [{ role: "me", text: "help" }] }, { fetch });
  assert.equal(r.reply, "Which axis holds T?");
  assert.equal(hit.url, "https://api.deepseek.com/chat/completions"); assert.equal(hit.auth, "Bearer k"); assert.equal(hit.body.model, "deepseek-chat");
});
