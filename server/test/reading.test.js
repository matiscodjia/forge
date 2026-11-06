// Reading importer: arXiv links read from the HTML rendering (ar5iv fallback), math kept as LaTeX, references dropped,
// deduplicated by URL; PDFs and private hosts refused.
import { test } from "node:test";
import assert from "node:assert/strict";
import { importReading, htmlToMarkdown, candidates } from "../src/reading.js";
import { getSource } from "../src/sources.js";
import { fakeD1 } from "./helpers/env.js";

const para = (n) => `<p>${"Attention lets every position look at every other position. ".repeat(n)}</p>`;
const PAPER = `<html><head><title>Attention Is All You Need</title><script>x()</script></head><body><nav>menu</nav><article>
  <h1>Attention Is All You Need</h1><h2>1 Introduction</h2>${para(20)}
  <h2>3.2 Scaled Dot-Product Attention</h2><p>We compute <math alttext="\\mathrm{softmax}(QK^{T}/\\sqrt{d_k})V"><mi>x</mi></math> &amp; scale.</p>${para(20)}
  <h2>References</h2><p>[1] Bahdanau et al.</p></article><footer>arXiv</footer></body></html>`;

test("htmlToMarkdown keeps headings and math, drops chrome and references", () => {
  const { title, text } = htmlToMarkdown(PAPER);
  assert.equal(title, "Attention Is All You Need");
  assert.match(text, /^# Attention Is All You Need/m); assert.match(text, /^## 3.2 Scaled Dot-Product Attention/m);
  assert.match(text, /\$\\mathrm\{softmax\}\(QK\^\{T\}\/\\sqrt\{d_k\}\)V\$ & scale/);
  assert.ok(!/menu|x\(\)|Bahdanau|arXiv/.test(text));
  assert.deepEqual(candidates("https://arxiv.org/abs/1706.03762"), ["https://arxiv.org/html/1706.03762", "https://ar5iv.labs.arxiv.org/html/1706.03762"]);
  assert.deepEqual(candidates("https://arxiv.org/pdf/2205.14135v2.pdf"), ["https://arxiv.org/html/2205.14135", "https://ar5iv.labs.arxiv.org/html/2205.14135"]);
});

test("importReading: arXiv falls back to ar5iv, chunks are AI-visible and linked to the module, deduplicated", async () => {
  const db = fakeD1(), hits = [];
  const fetch = async (url) => { hits.push(url); return url.includes("ar5iv") ? new Response(PAPER, { headers: { "content-type": "text/html" } }) : new Response("nope", { status: 404 }); };
  const r = await importReading(db, { url: "https://arxiv.org/abs/1706.03762", title: "Attention Is All You Need", mod: "transformer" }, { fetch });
  assert.equal(r.existing, false); assert.ok(r.chunks >= 2);
  assert.deepEqual(hits, ["https://arxiv.org/html/1706.03762", "https://ar5iv.labs.arxiv.org/html/1706.03762"]);
  const s = await getSource(db, r.id);
  assert.equal(s.visibility, "ai"); assert.equal(s.origin, "https://arxiv.org/abs/1706.03762");
  assert.ok(s.chunks.every((c) => c.visibility === "ai" && c.meta.mod === "transformer"));
  assert.ok(s.chunks.some((c) => c.meta.heading === "3.2 Scaled Dot-Product Attention"));
  const again = await importReading(db, { url: "https://arxiv.org/abs/1706.03762" }, { fetch });
  assert.equal(again.existing, true); assert.equal(again.id, r.id); assert.equal(hits.length, 2);
});

test("importReading refuses PDFs, empty pages and private hosts", async () => {
  const db = fakeD1();
  const pdf = async () => new Response("%PDF", { headers: { "content-type": "application/pdf" } });
  await assert.rejects(importReading(db, { url: "https://cdn.openai.com/x.pdf" }, { fetch: pdf }), (e) => e.status === 422 && /Sources/.test(e.message));
  await assert.rejects(importReading(db, { url: "https://example.com/" }, { fetch: async () => new Response("<p>hi</p>", { headers: { "content-type": "text/html" } }) }), (e) => e.status === 422);
  for (const url of ["http://localhost:8787/", "http://10.0.0.1/", "http://[::1]/", "file:///etc/passwd", "nope"]) await assert.rejects(importReading(db, { url }, { fetch: pdf }), (e) => e.status === 400, url);
});
