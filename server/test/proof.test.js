// M11 acceptance: a week of simulated reviews gives correct due dates; a pasted answer never raises mastery;
// private material never reaches the model.
import { test } from "node:test";
import assert from "node:assert/strict";
import { schedule, ratingOf, retrievability } from "../src/fsrs.js";
import { generate, answer, session, mastery, looksPasted, parseJSON } from "../src/proof.js";
import { createSource, appendParts } from "../src/sources.js";
import { fakeD1, setup } from "./helpers/env.js";

/** Workers AI stand-in: question_gen returns a question in a fenced block, grading pops scripted scores. */
function mockAI(scores = []) {
  const calls = [];
  return { calls, run: async (model, { messages }) => {
    calls.push({ model, system: messages[0].content, user: messages[1].content });
    if (messages[0].content.includes("ONE exam question")) return { response: 'Here you go:\n```json\n{"concept": "Kalman Gain", "track": "math", "question": "Why does the Kalman gain shrink as P falls?", "rubric": ["K = P Hᵀ S⁻¹", "less uncertainty, trust the prediction"]}\n```' };
    return { response: JSON.stringify({ score: scores.shift(), fix: "Mention the innovation covariance." }), usage: { prompt_tokens: 300, completion_tokens: 20 } };
  } };
}
const at = (day, h = 9) => new Date(`${day}T${String(h).padStart(2, "0")}:00:00+01:00`); // Paris winter time
const filler = (s) => `${s} ${"The filter blends the prediction and the measurement according to their uncertainties. ".repeat(4)}`;

async function seed(db, vis = "ai") {
  const { id } = await createSource(db, { kind: "course", title: "Kalman lecture", project: "sentinel", visibility: vis });
  await appendParts(db, id, { parts: [{ text: filler("Kalman gain."), meta: { page: 1 } }, { text: filler("Covariance update."), meta: { page: 2 } }] });
  return id;
}

test("FSRS-4.5: first intervals and a second Good review (hand-computed)", () => {
  assert.deepEqual([1, 2, 3, 4].map((g) => schedule(null, g, "2026-11-02").interval), [1, 1, 4, 14]);
  const a = schedule(null, 3, "2026-11-02"); assert.equal(a.due, "2026-11-06");
  const b = schedule(a, 3, a.due); // R = 0.8935, S' = 14.81
  assert.ok(Math.abs(b.stability - 14.81) < 0.01); assert.equal(b.due, "2026-11-21");
  assert.ok(Math.abs(b.difficulty - 5.1237) < 0.001);
  const c = schedule(b, 1, "2026-11-25"); assert.equal(c.due, "2026-11-26", "a lapse comes back tomorrow"); assert.equal(c.lapses, 1); assert.ok(c.stability < b.stability);
  assert.deepEqual([0, 49, 50, 69, 70, 89, 90, 100].map((s) => ratingOf(s)), [1, 1, 2, 2, 3, 3, 4, 4]);
  assert.equal(ratingOf(100, true), 1, "pasted is always Again");
});

test("a week of simulated reviews: daily question, due dates, pasted answers flagged and never raise mastery", async () => {
  const db = fakeD1(), AI = mockAI([75, 20, 75, 95, 80]), env = { AI };
  await seed(db);

  // Mon 2 Nov: the cron creates today's question once; a second run does nothing.
  const g1 = await generate(db, env, { now: at("2026-11-02", 5) });
  assert.equal(g1.created, true);
  assert.equal((await generate(db, env, { now: at("2026-11-02", 6) })).created, false);
  let s = await session(db, env, { now: at("2026-11-02") });
  assert.equal(s.due.length, 1); assert.equal(s.due[0].concept, "kalman gain"); assert.equal(s.due[0].track, "math");
  assert.ok(!("rubric" in s.due[0]) && !("source_text" in s.due[0]), "no source or rubric on the answer screen");
  const r1 = await answer(db, env, g1.id, { answer: "Because P shrinks, so the prediction is trusted more than the measurement.", typed_ms: 9000 }, { now: at("2026-11-02") });
  assert.equal(r1.score, 75); assert.equal(r1.due, "2026-11-06"); assert.equal(r1.pasted, false);
  assert.ok(r1.source.text.includes("filter blends"), "source shown after grading");
  await assert.rejects(answer(db, env, g1.id, { answer: "again", typed_ms: 2000 }, { now: at("2026-11-02", 20) }), (e) => e.status === 409);

  // Tue 3 Nov: second question, low score → tomorrow.
  const g2 = await generate(db, env, { now: at("2026-11-03", 5) });
  const r2 = await answer(db, env, g2.id, { answer: "Not sure, something with the covariance matrix maybe.", typed_ms: 7000 }, { now: at("2026-11-03") });
  assert.equal(r2.due, "2026-11-04");

  // Wed 4 Nov: only q2 is due. S=0.4872, D=7.7214, t=1 → S'=2.365 → 2 days.
  s = await session(db, env, { now: at("2026-11-04") });
  assert.deepEqual(s.due.map((q) => q.id), [g2.id]);
  const r3 = await answer(db, env, g2.id, { answer: "The covariance update shrinks P by (I - K H), so after each measurement we are more certain.", typed_ms: 15000 }, { now: at("2026-11-04") });
  assert.equal(r3.due, "2026-11-06");

  // Fri 6 Nov: both due. q1 is pasted (flagged, graded 95 but scheduled as Again, mastery unchanged).
  s = await session(db, env, { now: at("2026-11-06") });
  assert.deepEqual(s.due.map((q) => q.id).sort(), [g1.id, g2.id].sort());
  const before = (await mastery(db, env, { now: at("2026-11-06") })).questions.find((q) => q.id === g1.id).mastery;
  const pasted = "K = P Hᵀ (H P Hᵀ + R)⁻¹. As P falls the gain falls, so the update trusts the prediction more and the measurement less.";
  const r4 = await answer(db, env, g1.id, { answer: pasted, typed_ms: 300 }, { now: at("2026-11-06") });
  assert.equal(r4.pasted, true, "120 characters in 0.3 s of typing is a paste"); assert.equal(r4.score, 95); assert.equal(r4.due, "2026-11-07");
  const after = (await mastery(db, env, { now: at("2026-11-06") })).questions.find((q) => q.id === g1.id).mastery;
  assert.equal(after, before, "pasting does not raise mastery");
  assert.equal(before, Math.round(75 * retrievability(4, 3.7145)));
  const r5 = await answer(db, env, g2.id, { answer: "P is multiplied by (I - KH): uncertainty only goes down after an update, by an amount set by the gain.", typed_ms: 20000, pasted: false }, { now: at("2026-11-06") });
  assert.equal(r5.score, 80);

  // Sun 8 Nov: mastery per track/concept/project comes from reviews only; the paste is counted, not credited.
  const m = await mastery(db, env, { now: at("2026-11-08") });
  const math = m.tracks.find((t) => t.key === "math");
  assert.equal(math.proven, 2); assert.equal(math.pasted, 1);
  assert.ok(math.mastery > 0 && math.mastery < 80);
  assert.equal(m.projects[0].key, "sentinel");
  s = await session(db, env, { now: at("2026-11-08") });
  assert.ok(s.due.some((q) => q.id === g1.id), "the pasted question is due again");
  assert.equal(s.totals.pasted, 1);

  // Every model call was gated and audited with the chunk it read.
  const audit = (await db.prepare("SELECT task, item_ids FROM ai_audit ORDER BY at").all()).results;
  assert.equal(audit.length, 7); assert.deepEqual([...new Set(audit.map((a) => a.task))].sort(), ["grading", "question_gen"]);
  assert.ok(AI.calls.filter((c) => c.system.includes("You grade")).every((c) => c.user.includes("Answer:")));
});

test("journal entries are never exam material; a legacy private source still never reaches the model", async () => {
  const db = fakeD1(), AI = mockAI([80]), env = { AI };
  const legacy = await seed(db); await db.prepare("UPDATE sources SET visibility = 'private' WHERE id = ?").bind(legacy).run(); await db.prepare("UPDATE chunks SET visibility = 'private' WHERE source_id = ?").bind(legacy).run();
  await db.prepare("INSERT INTO sources (id, kind, title, visibility, created, updated, rev) VALUES ('j1', 'journal', 'Journal', 'ai', 'x', 'x', 0)").run();
  await assert.rejects(generate(db, env, { now: at("2026-11-02"), force: true }), (e) => e.status === 409);
  assert.equal(AI.calls.length, 0);

  const sid = await seed(db, "ai");
  const g = await generate(db, env, { now: at("2026-11-02"), force: true });
  assert.ok(!AI.calls[0].user.includes("SECRET"));
  await db.prepare("UPDATE sources SET visibility = 'private' WHERE id = ?").bind(sid).run(); // legacy data only: the API can't set it
  await assert.rejects(answer(db, env, g.id, { answer: "Something long enough to be a real answer here.", typed_ms: 9000 }, { now: at("2026-11-02") }), (e) => e.status === 409);
  assert.equal(AI.calls.length, 1, "grading never called");
  assert.equal((await session(db, env, { now: at("2026-11-02") })).due.length, 0, "retired");
});

test("helpers and API routes", async () => {
  assert.equal(looksPasted("short", 0), false);
  assert.equal(looksPasted("x".repeat(100), 20000), false);
  assert.equal(looksPasted("x".repeat(100), 1000), true);
  assert.deepEqual(parseJSON('noise {"score": 70} trailing'), { score: 70 });
  assert.equal(parseJSON("no json"), null);

  const { call, env } = setup({ AI: mockAI([88]) });
  assert.equal((await call("GET", "/api/health")).ai, true);
  await seed(env.DB);
  const { id } = await call("POST", "/api/proof/generate", {});
  const s = await call("GET", "/api/proof");
  assert.equal(s.due[0].id, id); assert.equal(s.ready, true);
  const r = await call("POST", `/api/proof/${id}/answer`, { answer: "The gain falls with P, so the prediction dominates the update.", typed_ms: 8000 });
  assert.equal(r.score, 88);
  assert.equal((await call("GET", "/api/proof/mastery")).concepts[0].key, "kalman gain");
  await call("POST", `/api/proof/${id}/retire`, {});
  assert.equal((await call("GET", "/api/proof")).due.length, 0);
  const none = setup({});
  assert.equal((await none.call("GET", "/api/health")).ai, false);
  await assert.rejects(none.call("POST", "/api/proof/generate", {}), (e) => e.status === 503);
});
