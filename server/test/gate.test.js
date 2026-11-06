// M7 acceptance: a private item can never reach a provider fetch; the audit row lists exactly what left.
import { test } from "node:test";
import assert from "node:assert/strict";
import { contextGate, allowed, redact, isGated } from "../src/gate.js";
import { resolveRoute } from "../src/router.js";
import { callLLM } from "../src/llm.js";

const config = {
  providers: {
    cheap: { clearance: "ai", baseUrl: "https://cheap.test/v1", model: "cheap-1", keyEnv: "CHEAP_KEY" },
    trusted: { clearance: "trusted", baseUrl: "https://trusted.test/v1", model: "trusted-1", keyEnv: "TRUSTED_KEY" }
  },
  routes: { grading: "cheap", agent: "trusted", wiki: { provider: "cheap", fallback: "trusted" } }
};
const items = [
  { id: "code-1", kind: "repo", visibility: "ai", text: "fn infer<const N: usize>() {} // 1024 768 50257" },
  { id: "note-1", kind: "note", visibility: "trusted", text: "My take on Kalman gains, ping me at matis@example.com" },
  { id: "jrnl-1", kind: "journal", visibility: "private", text: "SECRET-JOURNAL: anxious about the interview" },
  { id: "cv-1", kind: "file", visibility: "private", title: "CV", text: "SECRET-CV +33 6 12 34 56 78" },
  { id: "typo-1", kind: "note", visibility: "publik", text: "SECRET-TYPO" }
];
const mockFetch = () => {
  const calls = [];
  const f = async (url, init) => { calls.push({ url, body: init.body, headers: init.headers }); return new Response(JSON.stringify({ choices: [{ message: { content: "Uses const generics [src:code-1]" } }], usage: { prompt_tokens: 42, completion_tokens: 7 } }), { status: 200 }); };
  f.calls = calls; return f;
};
const memAudit = () => { const rows = []; return { rows, write: async (r) => { rows.push(r); } }; };

test("clearance matrix: private never leaves", () => {
  for (const c of ["ai", "trusted"]) assert.equal(allowed("private", c), false);
  assert.equal(allowed("ai", "ai"), true);
  assert.equal(allowed("trusted", "ai"), false);
  assert.equal(allowed("trusted", "trusted"), true);
  assert.equal(allowed("ai", "trusted"), true);
  assert.throws(() => allowed("publik", "ai"));
});

for (const [task, prov] of [["grading", "cheap"], ["agent", "trusted"]]) {
  test(`mixed items → ${prov}: only allowed items reach fetch, audit lists exactly them`, async () => {
    const f = mockFetch(), audit = memAudit();
    const { provider, decision } = resolveRoute(task, items, config);
    const ctx = contextGate(items, provider, { task, decision });
    const out = await callLLM(ctx, { instruction: "Answer." }, { fetch: f, env: { CHEAP_KEY: "k1", TRUSTED_KEY: "k2" }, providers: config.providers, audit });
    assert.equal(f.calls.length, 1);
    const payload = f.calls[0].body;
    for (const secret of ["SECRET-JOURNAL", "SECRET-CV", "SECRET-TYPO", "jrnl-1", "cv-1", "typo-1"]) assert.ok(!payload.includes(secret), `${secret} leaked to ${prov}`);
    const expected = prov === "cheap" ? ["code-1"] : ["code-1", "note-1"];
    assert.deepEqual(JSON.parse(audit.rows[0].item_ids), expected);
    assert.equal(audit.rows[0].provider, prov);
    assert.equal(audit.rows[0].tokens_in, 42);
    if (prov === "cheap") assert.ok(!payload.includes("Kalman"), "trusted note leaked to cheap provider");
    assert.deepEqual(out.cited, ["code-1"]);
  });
}

test("redaction: emails and phones removed, code numbers kept", () => {
  const ctx = contextGate(items, { name: "trusted", clearance: "trusted" }, { task: "agent" });
  const note = ctx.items.find((i) => i.id === "note-1");
  assert.ok(note.text.includes("[email]") && !note.text.includes("@example.com"));
  assert.equal(redact("call 06.12.34.56.78 or +1 415 555 0100"), "call [phone] or [phone]");
  assert.equal(redact("vocab 50257, d=768, 1024 tokens, 2024-05-01"), "vocab 50257, d=768, 1024 tokens, 2024-05-01");
});

test("callLLM refuses anything that did not pass the gate (no forged context)", async () => {
  const f = mockFetch();
  const forged = { task: "agent", provider: "trusted", model: "", items: [items[2]], audit: {} };
  await assert.rejects(callLLM(forged, { instruction: "x" }, { fetch: f, providers: config.providers }), /contextGate/);
  assert.equal(f.calls.length, 0);
  const ctx = contextGate(items, { name: "cheap", clearance: "ai" }, { task: "grading" });
  assert.ok(isGated(ctx) && Object.isFrozen(ctx) && Object.isFrozen(ctx.items));
  assert.throws(() => { ctx.items.push(items[2]); });
});

test("routing never upgrades silently", () => {
  const sw = resolveRoute("wiki", items, config);
  assert.equal(sw.provider.name, "trusted");
  assert.deepEqual(sw.decision, { task: "wiki", action: "switched", from: "cheap", provider: "trusted", because: ["note-1"] });
  const ex = resolveRoute("grading", items, config);
  assert.equal(ex.provider.name, "cheap");
  assert.deepEqual(ex.decision.excluded, ["note-1"]);
  const ok = resolveRoute("grading", [items[0]], config);
  assert.equal(ok.decision.action, "route");
  assert.throws(() => resolveRoute("unknown", items, config));
  assert.throws(() => resolveRoute("x", [], { providers: { p: { clearance: "private" } }, routes: { x: "p" } }));
});

test("audit row is written even when the provider fails", async () => {
  const audit = memAudit();
  const f = async () => new Response("down", { status: 503 });
  const ctx = contextGate([items[0]], { name: "cheap", clearance: "ai" }, { task: "grading" });
  await assert.rejects(callLLM(ctx, { instruction: "x" }, { fetch: f, providers: config.providers, audit }), /503/);
  assert.deepEqual(JSON.parse(audit.rows[0].item_ids), ["code-1"]);
});
