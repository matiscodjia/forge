// Grading the model cannot make up: quotes are checked against the answer, the score is computed in code,
// verified errors cost points, a contested grade is re-graded by independent examiners (once).
import { test } from "node:test";
import assert from "node:assert/strict";
import { found, scoreFrom, rubricList, gradeAnswer, regrade } from "../src/grade.js";
import { generate, answer, contest } from "../src/proof.js";
import { createSource, appendParts } from "../src/sources.js";
import { fakeD1, gradeReply } from "./helpers/env.js";

const ANS = "Because P shrinks, the gain falls and the prediction is trusted more than the measurement.";
const at = (d, h = 9) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00+01:00`);

test("quotes must really be in the answer", () => {
  assert.ok(found("the prediction is trusted more", ANS));
  assert.ok(found("Prediction is TRUSTED more than measurement", ANS), "case, punctuation, a dropped word");
  assert.ok(!found("K equals P H transpose S inverse", ANS), "invented quote");
  assert.ok(!found("", ANS)); assert.ok(!found("P", ANS));
  assert.deepEqual(rubricList("- a\n- b\n\n3. c"), ["a", "b", "c"]);
});

test("the score is computed from verified verdicts, minus verified errors", () => {
  const pts = ["gain formula", "trust the prediction", "covariance update"];
  const s = scoreFrom(pts, { points: [
    { i: 1, verdict: "full", quote: "K equals P H transpose S inverse" },       // not in the answer → missing
    { i: 2, verdict: "full", quote: "the prediction is trusted more" },
    { i: 3, verdict: "partial", quote: "P shrinks" }
  ], errors: [{ quote: "the gain falls", why: "x" }, { quote: "made-up error text here", why: "y" }] }, ANS);
  assert.deepEqual(s.points.map((p) => p.verdict), ["missing", "full", "partial"]);
  assert.equal(s.points[0].claimed, "full"); assert.equal(s.points[0].verified, false);
  assert.equal(s.errors.length, 1, "an error must be quoted from the answer too"); assert.equal(s.penalty, 10);
  assert.equal(s.score, 40); // round(100·1.5/3) − 10
  assert.equal(scoreFrom(pts, { points: [{ i: 1, verdict: "excellent", quote: "P shrinks" }] }, ANS).score, 0, "unknown verdict → missing");
});

test("temperature 0; an unreadable reply is an error, not a made-up grade", async () => {
  let body;
  const env = { AI: { run: async (m, b) => { body = b; return { response: gradeReply(b.messages[1].content, "fp") }; } } };
  const g = await gradeAnswer(fakeD1(), env, { question: "Why?", rubric: ["a", "b"], answer: ANS });
  assert.equal(body.temperature, 0); assert.equal(g.score, 75); assert.match(body.messages[1].content + body.messages[0].content, /1\. a\n2\. b/);
  const bad = { AI: { run: async () => ({ response: '{"score": 95}' }) } };
  await assert.rejects(gradeAnswer(fakeD1(), bad, { question: "Why?", rubric: ["a"], answer: ANS }), (e) => e.status === 502);
});

const scripted = (specs) => { const sys = []; return { sys, AI: { run: async (m, { messages }) => {
  sys.push(messages[0].content);
  if (messages[0].content.includes("ONE exam question")) return { response: '{"concept": "Kalman Gain", "track": "math", "question": "Why does the gain shrink as P falls?", "rubric": ["gain shrinks", "trust the prediction"]}' };
  return { response: gradeReply(messages[1].content, specs.shift()) };
} } }; };

test("regrade: close → mean of two; far apart → median of three", async () => {
  const args = { question: "Why?", rubric: ["a", "b"], answer: ANS };
  const a = scripted(["fp"]); const r1 = await regrade(fakeD1(), { AI: a.AI }, args, 70);
  assert.equal(r1.rule, "mean of two"); assert.deepEqual(r1.grades, [70, 75]); assert.equal(r1.score, 73);
  assert.match(a.sys[0], /second, independent examiner/);
  const b = scripted(["ff", "fp"]); const r2 = await regrade(fakeD1(), { AI: b.AI }, args, 25);
  assert.equal(r2.rule, "median of three"); assert.deepEqual(r2.grades, [25, 100, 75]); assert.equal(r2.score, 75);
  assert.match(b.sys[1], /third examiner/);
});

test("contest: once, reschedules, never on a pasted answer", async () => {
  const db = fakeD1(), s = scripted(["p-", "ff", "fp", "ff"]), env = { AI: s.AI };
  const { id } = await createSource(db, { kind: "course", title: "Kalman lecture", project: "sentinel", visibility: "ai" });
  await appendParts(db, id, { parts: [1, 2].map((page) => ({ text: `Part ${page}. ${"The filter blends the prediction and the measurement according to their uncertainties. ".repeat(4)}`, meta: { page } })) });
  const q = await generate(db, env, { now: at("2026-11-02", 5) });
  const r = await answer(db, env, q.id, { answer: ANS, typed_ms: 9000 }, { now: at("2026-11-02") });
  assert.equal(r.score, 25); assert.equal(r.contestable, true); assert.equal(r.detail.points.length, 2); assert.equal(r.due, "2026-11-03");
  const c = await contest(db, env, q.id, { now: at("2026-11-02", 10) });
  assert.equal(c.before, 25); assert.equal(c.rule, "median of three"); assert.equal(c.score, 75); assert.equal(c.due, "2026-11-06");
  const row = await db.prepare("SELECT score, contested, detail FROM reviews WHERE question_id = ?").bind(q.id).first();
  assert.equal(row.score, 75); assert.equal(row.contested, 1); assert.deepEqual(JSON.parse(row.detail).contested.grades, [25, 100, 75]);
  assert.equal((await db.prepare("SELECT due FROM questions WHERE id = ?").bind(q.id).first()).due, "2026-11-06");
  await assert.rejects(contest(db, env, q.id), (e) => e.status === 409, "only once");

  const q2 = await generate(db, env, { now: at("2026-11-03", 5) });
  const p = await answer(db, env, q2.id, { answer: ANS, typed_ms: 200, pasted: true }, { now: at("2026-11-03") });
  assert.equal(p.contestable, false);
  await assert.rejects(contest(db, env, q2.id), (e) => e.status === 409);
});
