// Tutor sessions: each exchange is kept per exercise and day; the next day the tutor sees the earlier session, and
// the planner and the assistant see where he asked for help. Sessions are never Proof material.
import { test } from "node:test";
import assert from "node:assert/strict";
import { tutor } from "../src/tutor.js";
import { plan } from "../src/planner.js";
import { fileThought } from "../src/capture.js";
import { generate } from "../src/proof.js";
import { fakeD1 } from "./helpers/env.js";

const AI = () => { const calls = []; return { calls, run: async (m, { messages }) => {
  calls.push({ sys: messages[0].content, user: messages[1].content });
  if (messages[0].content.includes("planning agent")) return { response: '{"drill": "attention", "why": "x"}' };
  if (messages[0].content.includes("Forge's assistant")) return { response: '{"note": "new", "title": "t", "nudge": "n"}' };
  return { response: "Which value lands on the future positions after your mask?" };
} }; };
const ask = (text, extra = {}) => ({ kind: "drill", id: "attention", title: "Causal self-attention", desc: "Write attention.", tests: ["causal"], code: "def attention(q,k,v): ...", run: "test_causal: FAILED (future leaks)\ntest_shape: ok", messages: [{ role: "me", text }], ...extra });
const day = (d) => new Date(`${d}T10:00:00+01:00`);

test("a tutor exchange is saved; the next day the tutor builds on it; planner and assistant see it", async () => {
  const db = fakeD1(), ai = AI(), env = { AI: ai };
  await tutor(db, env, ask("my mask test fails"), { now: day("2026-11-05") });
  await tutor(db, env, ask("still failing", { messages: [{ role: "me", text: "my mask test fails" }, { role: "tutor", text: "Which value…" }, { role: "me", text: "still failing" }] }), { now: day("2026-11-05") });
  const rows = (await db.prepare("SELECT * FROM tutor_sessions").all()).results;
  assert.equal(rows.length, 1, "one row per exercise per day"); assert.equal(rows[0].asks, 2); assert.equal(rows[0].id, "attention:2026-11-05");
  assert.equal(JSON.parse(rows[0].messages).length, 4); assert.match(rows[0].run, /test_causal: FAILED/);

  await tutor(db, env, ask("ok I flipped np.where, now?"), { now: day("2026-11-06") });
  assert.match(ai.calls.at(-1).user, /earlier tutor sessions on this exercise[\s\S]*2026-11-05:[\s\S]*Matis: still failing/);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM tutor_sessions").first()).n, 2);

  await db.prepare("INSERT INTO kv (k, v, rev, updated) VALUES ('ctx', ?, 1, 'x')").bind(JSON.stringify({ drills: [{ id: "attention", title: "Causal self-attention", lvl: 3, track: "ml" }], modules: [] })).run();
  await plan(db, env, { now: day("2026-11-06"), force: true });
  const p = ai.calls.find((c) => c.sys.includes("planning agent")).user;
  assert.match(p, /Where he asked the tutor for help[\s\S]*Causal self-attention \(2026-11-06\): asked the tutor 1×; last: "ok I flipped np.where, now\?"; failing: test_causal: FAILED/);

  await fileThought(db, env, { text: "the mask goes before softmax", notes: [], modules: [] }, { now: day("2026-11-06") });
  assert.match(ai.calls.find((c) => c.sys.includes("Forge's assistant")).user, /What he recently asked the tutor/);

  await assert.rejects(generate(db, env, { now: day("2026-11-06"), force: true }), (e) => e.status === 409, "sessions are not exam material");
});
