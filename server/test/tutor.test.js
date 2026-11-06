// Arena tutor: hints only. The guard blocks code and anything close to the reference solution,
// retries once with a stricter prompt, then replaces the reply. Every call is gated and audited.
import { test } from "node:test";
import assert from "node:assert/strict";
import { leak, tutor } from "../src/tutor.js";
import { SOLUTIONS } from "../src/drills.js";
import { fakeD1, setup } from "./helpers/env.js";

const body = (text, extra = {}) => ({ kind: "drill", id: "attention", title: "Causal self-attention", desc: "Implement <code>attention(q, k, v)</code>.", tests: ["shape (B, T, d)", "the future never changes the past"], code: "import numpy as np\ndef attention(q, k, v):\n    pass\n", run: "✗ the future never changes the past", messages: [{ role: "me", text }], ...extra });
function mockAI(replies) {
  const calls = [];
  return { calls, run: async (model, { messages }) => { calls.push({ system: messages[0].content, user: messages[1].content }); return { response: replies.shift() }; } };
}

test("leak(): code blocks, long inline code and solution lines are caught; a Socratic hint passes", () => {
  assert.equal(leak("Look at line 8. In `np.where(mask, a, b)`, which value lands on future positions?", "attention"), null);
  assert.equal(leak("Try this:\n```python\nmask = np.tril(np.ones((T, T)))\natt = np.where(mask, att, -np.inf)\nw = np.exp(att)\n```", "attention"), "code");
  assert.equal(leak("Use `att = np.where(np.tril(np.ones((T, T), dtype=bool)), att, -np.inf)` here.", "attention"), "code");
  const line = SOLUTIONS.softmax.split("\n").find((l) => l.includes("np.max"));
  assert.equal(leak(`Just write ${line.trim()} and you're done.`, "softmax"), "solution", "a reference line in prose");
  assert.equal(leak(`Write ${line.trim().replace(/ /g, "  ")}`, "softmax"), "solution", "whitespace changes don't hide it");
  assert.equal(leak("Subtract the max of each row before exp. Which axis is a row?", "softmax"), null);
});

test("a leaking reply is retried once with a stricter prompt, then replaced", async () => {
  const db = fakeD1();
  const fixed = "```python\natt = np.where(mask, -np.inf, att)\nw = np.exp(att - att.max(-1, keepdims=True))\nreturn w @ v\n```";
  let AI = mockAI([fixed, "Which positions does `mask` mark as True: the past or the future?"]);
  let r = await tutor(db, { AI }, body("just give me the fixed line"));
  assert.equal(r.guarded, "retried"); assert.match(r.reply, /past or the future/);
  assert.match(AI.calls[1].system, /no code at all/);
  assert.match(AI.calls[0].user, /<source id="code:attention"/); assert.match(AI.calls[0].user, /Matis: just give me the fixed line/);
  assert.ok(!AI.calls[0].system.includes(SOLUTIONS.attention.slice(30, 80)), "the solution never goes to the model");

  AI = mockAI([fixed, fixed]);
  r = await tutor(db, { AI }, body("please"));
  assert.equal(r.guarded, "replaced"); assert.doesNotMatch(r.reply, /np\./);
  const audit = (await db.prepare("SELECT task, item_ids FROM ai_audit").all()).results;
  assert.equal(audit.length, 4); assert.ok(audit.every((a) => a.task === "tutor" && a.item_ids.includes("exercise:attention")));
});

test("route: validation, no provider, happy path", async () => {
  const AI = mockAI(["Print `q.shape`: what is T here? [src:code:attention]"]);
  const { call } = setup({ AI });
  assert.equal((await call("GET", "/api/health")).tutor, true);
  const r = await call("POST", "/api/tutor", body("why is my output wrong?"));
  assert.equal(r.reply, "Print `q.shape`: what is T here?", "citations are stripped"); assert.equal(r.guarded, null);
  await assert.rejects(call("POST", "/api/tutor", body("x", { id: "../etc" })), (e) => e.status === 400);
  await assert.rejects(call("POST", "/api/tutor", body("", {})), (e) => e.status === 400);
  await assert.rejects(setup({}).call("POST", "/api/tutor", body("hi")), (e) => e.status === 503);
});
