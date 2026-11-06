// M8 acceptance: chunking, uploads, search, visibility, GitHub sync (per-function chunks, idempotent re-sync).
import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkCode, chunkMarkdown } from "../src/chunk.js";
import { setup } from "./helpers/env.js";

const KALMAN_RS = `use core::ops::Mul;

/// Fixed-size matrix: dimensions are checked at compile time, no heap.
#[derive(Clone, Copy)]
pub struct Matrix<const R: usize, const C: usize> {
    data: [[f32; C]; R],
}

impl<const R: usize, const C: usize> Matrix<R, C> {
    /// All zeros.
    pub const fn zeros() -> Self {
        Self { data: [[0.0; C]; R] }
    }

    pub fn transpose(&self) -> Matrix<C, R> {
        let mut out = Matrix::<C, R>::zeros();
        for i in 0..R { for j in 0..C { out.data[j][i] = self.data[i][j]; } }
        out
    }
}

/// Kalman update: K = P H^T (H P H^T + R)^-1
pub fn kalman_update<const N: usize>(x: &mut [f32; N], z: f32) {
    let k = 0.5;
    for v in x.iter_mut() { *v += k * (z - *v); }
}
`;

test("Rust: one chunk per item with doc comments, attributes and 1-based line ranges", () => {
  const ch = chunkCode("sentinel-core/src/kalman_frugal.rs", KALMAN_RS);
  const sym = ch.map((c) => c.meta.symbol);
  assert.deepEqual(sym, ["(header)", "Matrix", "Matrix<R, C>", "zeros", "transpose", "kalman_update"]);
  const st = ch.find((c) => c.meta.symbol === "Matrix");
  assert.ok(st.text.startsWith("/// Fixed-size matrix") && st.text.includes("#[derive"), "doc comment + attribute travel with the struct");
  assert.deepEqual(st.meta.lines, [3, 7]);
  const ku = ch.find((c) => c.meta.symbol === "kalman_update");
  assert.equal(ku.meta.path, "sentinel-core/src/kalman_frugal.rs");
  assert.equal(KALMAN_RS.split("\n")[ku.meta.lines[0] - 1], "/// Kalman update: K = P H^T (H P H^T + R)^-1");
  assert.ok(ku.text.endsWith("}"));
});

test("Python and Markdown chunkers", () => {
  const py = chunkCode("sim/main.py", "import numpy as np\n\n@dataclass\nclass Tof:\n    x: float\n\n    def dist(self):\n        return 1\n\ndef main():\n    pass\n");
  assert.deepEqual(py.map((c) => c.meta.symbol), ["(header)", "Tof", "dist", "main"]);
  assert.ok(py[1].text.startsWith("@dataclass"));
  const md = chunkMarkdown("# Plan\nintro\n\n## Kalman\nupdate step\n```\n# not a heading\n```\n## Rust\nconst generics");
  assert.deepEqual(md.map((c) => c.meta.heading), ["Plan", "Kalman", "Rust"]);
  assert.ok(md[1].text.includes("# not a heading"));
});

/** A fake GitHub with one repo whose files and commits the test can change. */
function fakeGitHub() {
  const files = { "README.md": "# Sentinel\nTracking with a Kalman filter.", "sentinel-core/src/kalman_frugal.rs": KALMAN_RS, "Cargo.lock": "x", "target/debug/junk.rs": "fn x(){}" };
  let commit = 1; const commits = [{ sha: "c1".padEnd(40, "0"), commit: { message: "Initial Kalman filter", author: { date: "2026-11-01T10:00:00Z" } } }];
  const blob = (p) => "b" + [...files[p]].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16);
  const calls = [];
  const f = async (url) => {
    const u = new URL(url); calls.push(u.pathname);
    const ok = (x) => new Response(typeof x === "string" ? x : JSON.stringify(x), { status: 200 });
    if (/\/commits\/main$/.test(u.pathname)) return ok({ sha: `head${commit}`.padEnd(40, "0"), commit: { tree: { sha: `tree${commit}` } } });
    if (/\/git\/trees\//.test(u.pathname)) return ok({ tree: Object.keys(files).map((p) => ({ path: p, type: "blob", sha: blob(p), size: files[p].length })) });
    if (/\/contents\//.test(u.pathname)) { const p = decodeURIComponent(u.pathname.split("/contents/")[1]); return files[p] !== undefined ? ok(files[p]) : new Response("", { status: 404 }); }
    if (/\/commits$/.test(u.pathname)) return ok(commits);
    return new Response("", { status: 404 });
  };
  return { f, files, calls, bump(msg) { commit++; commits.unshift({ sha: `c${commit}`.padEnd(40, "0"), commit: { message: msg, author: { date: `2026-11-0${commit}T10:00:00Z` } } }); } };
}

async function syncAll(call, id) { const steps = []; for (let i = 0; i < 20; i++) { const r = await call("POST", `/api/repos/${id}/sync`, {}); steps.push(r); if (r.done) break; } return steps; }

test("GitHub sync: chunks per function with path + lines; re-sync of unchanged code creates nothing", async () => {
  const gh = fakeGitHub();
  const { call, env } = setup({ GITHUB_TOKEN: "t" });
  globalThis.__realFetch = globalThis.fetch; globalThis.fetch = gh.f;
  try {
    const { id } = await call("POST", "/api/repos", { full_name: "https://github.com/matiscodjia/sentinel", project: "sentinel" });
    const first = await syncAll(call, id);
    assert.deepEqual(first.flatMap((s) => s.processed).sort(), ["README.md", "sentinel-core/src/kalman_frugal.rs"], "lockfiles and target/ are skipped");
    assert.equal(first.at(-1).commits, 1);
    const hits = (await call("GET", "/api/search?q=kalman_update")).results;
    const fn = hits.find((h) => h.meta.symbol === "kalman_update");
    assert.ok(fn, "function chunk is searchable");
    assert.equal(fn.meta.path, "sentinel-core/src/kalman_frugal.rs");
    assert.deepEqual(fn.meta.lines, [22, 26]);
    assert.equal(fn.visibility, "ai");
    const count = () => env.DB.prepare("SELECT (SELECT count(*) FROM chunks) AS c, (SELECT count(*) FROM sources) AS s").first();
    const before = await count();

    gh.calls.length = 0;
    const again = await syncAll(call, id);
    assert.equal(again.length, 1); assert.deepEqual(again[0].processed, []); assert.equal(again[0].commits, 0);
    assert.deepEqual(await count(), before, "re-sync of unchanged code creates nothing");
    assert.ok(!gh.calls.some((p) => p.includes("/contents/")), "no file is downloaded again");

    // Change one function: only that file is fetched; the unchanged chunks keep their ids.
    const ids = (await env.DB.prepare("SELECT id FROM chunks WHERE json_extract(meta, '$.symbol') = 'transpose'").all()).results;
    gh.files["sentinel-core/src/kalman_frugal.rs"] = KALMAN_RS.replace("let k = 0.5;", "let k = 0.25; // tuned gain");
    gh.bump("Tune Kalman gain"); gh.calls.length = 0;
    const third = await syncAll(call, id);
    assert.deepEqual(third.flatMap((s) => s.processed), ["sentinel-core/src/kalman_frugal.rs"]);
    assert.equal(third.at(-1).commits, 1);
    assert.deepEqual((await env.DB.prepare("SELECT id FROM chunks WHERE json_extract(meta, '$.symbol') = 'transpose'").all()).results, ids);
    assert.equal((await call("GET", "/api/search?q=tuned gain")).results.length, 1);
    assert.equal((await call("GET", "/api/search?q=0.5")).results.filter((r) => r.meta.symbol === "kalman_update").length, 0, "stale chunk removed");
    assert.ok((await call("GET", "/api/search?q=Tune Kalman gain")).results.some((r) => r.kind === "commit"));

    // Delete a file upstream: its source and chunks go.
    delete gh.files["README.md"]; gh.bump("Remove README");
    await syncAll(call, id);
    assert.equal((await call("GET", "/api/search?q=Tracking")).results.length, 0);

    // Repo visibility cascades to every chunk.
    await call("PATCH", `/api/repos/${id}`, { visibility: "private" });
    assert.equal((await env.DB.prepare("SELECT count(*) AS n FROM chunks c JOIN sources s ON s.id = c.source_id WHERE s.repo_id = ? AND c.visibility != 'private'").bind(id).first()).n, 0);
    const repos = await call("GET", "/api/repos");
    assert.equal(repos[0].files, 1); assert.ok(repos[0].chunks >= 6);
    assert.ok(env.DB.counter.max <= 50, `a request used ${env.DB.counter.max} D1 queries`);
  } finally { globalThis.fetch = globalThis.__realFetch; }
});

test("course upload in batches, search with snippets, visibility toggle reaches chunks", async () => {
  const { call, env } = setup();
  const { id } = await call("POST", "/api/sources", { kind: "course", title: "CS231n lecture 4", project: "cs231n", origin: "lecture4.pdf" });
  const pages = Array.from({ length: 50 }, (_, i) => ({ text: `Page ${i + 1}. Backpropagation computes gradients with the chain rule. ${"filler ".repeat(40)}`, meta: { page: i + 1 } }));
  for (let i = 0; i < pages.length; i += 20) await call("POST", `/api/sources/${id}/parts`, { parts: pages.slice(i, i + 20) });
  const src = await call("GET", `/api/sources/${id}`);
  assert.equal(src.chunks.length, 50); assert.equal(src.chunks[49].meta.page, 50); assert.equal(src.visibility, "ai");
  const r = (await call("GET", "/api/search?q=chain rul")).results;
  assert.ok(r.length > 0 && r[0].snip.includes("\u0001"), "prefix match with highlight markers");
  await call("PATCH", `/api/sources/${id}`, { visibility: "private" });
  assert.equal((await env.DB.prepare("SELECT count(*) AS n FROM chunks WHERE source_id = ? AND visibility = 'private'").bind(id).first()).n, 50);
  await assert.rejects(call("PATCH", `/api/sources/${id}`, { visibility: "public" }), (e) => e.status === 400);
  await assert.rejects(call("POST", "/api/sources", { kind: "note", title: "x" }), (e) => e.status === 400);
  await call("DELETE", `/api/sources/${id}`);
  assert.equal((await env.DB.prepare("SELECT count(*) AS n FROM chunks").first()).n, 0);
  assert.equal((await call("GET", "/api/search?q=\"; DROP TABLE chunks; --")).results.length, 0, "FTS syntax in the query is neutralised");
});

test("synced notes become chunks with their visibility; journal entries stay private", async () => {
  const { call } = setup();
  const notes = [
    { id: "n1", kind: "note", title: "Attention", body: "## Scaling\nDivide by sqrt(d_k) to keep variance near one.", tags: [], updated: 10 },
    { id: "j1", kind: "journal", title: "Journal", body: "Felt nervous before the Kalman interview.", tags: [], updated: 10 }
  ];
  await call("PUT", "/api/state", { kv: {}, notes });
  const r = (await call("GET", "/api/search?q=variance")).results;
  assert.equal(r[0].source_id, "n1"); assert.equal(r[0].visibility, "trusted"); assert.equal(r[0].meta.heading, "Scaling");
  assert.equal((await call("GET", "/api/search?q=nervous")).results[0].visibility, "private");
  await assert.rejects(call("PATCH", "/api/sources/n1", { visibility: "ai" }), (e) => e.status === 409);
  await call("PUT", "/api/state", { kv: {}, notes: [{ id: "n1", deleted: true, updated: 20 }] });
  assert.equal((await call("GET", "/api/search?q=variance")).results.length, 0);
  const many = Array.from({ length: 26 }, (_, i) => ({ id: `m${i}`, title: "x", body: "y", updated: 1 }));
  await assert.rejects(call("PUT", "/api/state", { kv: {}, notes: many }), (e) => e.status === 400);
});

test("context inspector lists calls with the exact items sent", async () => {
  const { call, env } = setup();
  await call("PUT", "/api/state", { kv: {}, notes: [{ id: "n1", title: "Attention", body: "x", updated: 1 }] });
  await env.DB.prepare("INSERT INTO ai_audit (id, at, task, provider, model, item_ids, decision, tokens_in, tokens_out) VALUES ('a1', '2026-11-06T10:00:00Z', 'grading', 'cheap', 'm', '[\"n1\",\"gone\"]', '{\"action\":\"excluded\",\"excluded\":[\"j1\"]}', 10, 2)").run();
  const { calls } = await call("GET", "/api/audit");
  assert.equal(calls[0].items[0].title, "Attention");
  assert.equal(calls[0].items[1].title, "(deleted)");
  assert.deepEqual(calls[0].decision.excluded, ["j1"]);
});
