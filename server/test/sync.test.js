// End to end: two simulated devices sync through the real Worker handler, on SQLite standing in for D1.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker from "../src/index.js";

await import("../../web/sync.js"); // classic browser script: registers globalThis.ForgeSync
const ForgeSync = globalThis.ForgeSync;
const root = new URL("../migrations/", import.meta.url);

/** Minimal D1 API over node:sqlite: prepare/bind/first/all/run/batch. */
function fakeD1() {
  const db = new DatabaseSync(":memory:");
  for (const f of ["0001_second_brain.sql", "0002_app_state.sql"]) db.exec(readFileSync(new URL(f, root), "utf8"));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async (col) => { const r = db.prepare(sql).get(...args); return r ? (col ? r[col] : r) : null; },
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
    _exec: () => { const p = db.prepare(sql); return /^\s*(SELECT|WITH)/i.test(sql) || /RETURNING/i.test(sql) ? { results: p.all(...args), meta: { changes: 0 } } : { results: [], meta: { changes: Number(p.run(...args).changes) } }; }
  });
  return { prepare: (sql) => stmt(sql), batch: async (ss) => { db.exec("BEGIN"); try { const out = ss.map((s) => s._exec()); db.exec("COMMIT"); return out; } catch (e) { db.exec("ROLLBACK"); throw e; } } };
}

function setup(env = {}) {
  const e = { DB: fakeD1(), AUTH: "dev", ASSETS: { fetch: async () => new Response("asset") }, ...env };
  const f = (path, init = {}) => worker.fetch(new Request(new URL(path, "http://localhost").href, init), e);
  return { env: e, f };
}
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const blankState = () => ({ days: {}, weeks: {}, practice: {}, code: {}, mocks: [], theory: [], skills: {}, pipeline: [], path: {}, srs: {}, revDays: {}, log: [], mock: null, theoryRun: null, notes: [] });
function device(f) {
  const d = { S: blankState(), remote: 0 };
  d.sync = ForgeSync.create({ getState: () => d.S, onRemoteChange: () => { d.remote++; }, fetch: f, storage: memStorage() });
  return d;
}

test("API refuses requests without Access in production, accepts dev on localhost only", async () => {
  const { f } = setup({ AUTH: "" });
  assert.equal((await f("/api/health")).status, 503);
  const prod = setup({ AUTH: "", ACCESS_TEAM: "t", ACCESS_AUD: "a" });
  assert.equal((await prod.f("/api/health")).status, 401);
  const dev = setup();
  assert.equal((await dev.env.ASSETS.fetch()).status, 200);
  const r = await worker.fetch(new Request("https://forge.example.com/api/health"), dev.env);
  assert.equal(r.status, 503, "AUTH=dev must not work off localhost");
  assert.equal((await dev.f("/api/health")).status, 200);
});

test("writes refuse cross-origin and non-JSON bodies; unknown keys are rejected", async () => {
  const { f } = setup();
  assert.equal((await f("/api/state", { method: "PUT", headers: { origin: "https://evil.test", "content-type": "application/json" }, body: "{}" })).status, 403);
  assert.equal((await f("/api/state", { method: "PUT", headers: { "content-type": "text/plain" }, body: "{}" })).status, 415);
  assert.equal((await f("/api/state", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ kv: { theme: { v: 1, base: 0 } } }) })).status, 400);
  assert.equal((await f("/api/state", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ notes: [{ id: "x", visibility: "publik", updated: 1 }] }) })).status, 400);
});

test("first device uploads, second device downloads everything", async () => {
  const { f } = setup();
  const a = device(f), b = device(f);
  a.S.log.push({ id: "l1", date: "2026-11-06", min: 50, area: "dl" });
  a.S.days["2026-11-06"] = { code: true };
  a.S.notes.push({ id: "n1", title: "Attention", body: "Q: why?\nA: variance", tags: ["llm"], mod: "gpt", created: 1, updated: 10 });
  assert.equal(await a.sync.detect(), true);
  await a.sync.sync();
  await b.sync.detect(); await b.sync.sync();
  assert.deepEqual(b.S.log, a.S.log);
  assert.deepEqual(b.S.days, a.S.days);
  assert.equal(b.S.notes[0].title, "Attention");
  assert.equal(b.S.notes[0].visibility, "trusted", "notes default to trusted");
  assert.equal(b.remote, 1);
});

test("concurrent edits on two devices merge without losing sessions", async () => {
  const { f } = setup();
  const a = device(f), b = device(f);
  await a.sync.detect(); await b.sync.detect();
  a.S.log.push({ id: "base", min: 10 }); await a.sync.sync(); await b.sync.sync();
  a.S.log.push({ id: "from-a", min: 25 }); a.S.srs.c1 = { due: "2026-11-07" };
  b.S.log.push({ id: "from-b", min: 50 }); b.S.srs.c2 = { due: "2026-11-09" };
  await a.sync.sync(); await b.sync.sync(); await a.sync.sync();
  const ids = (d) => d.S.log.map((x) => x.id).sort();
  assert.deepEqual(ids(a), ["base", "from-a", "from-b"]);
  assert.deepEqual(ids(b), ids(a));
  assert.deepEqual(Object.keys(a.S.srs).sort(), ["c1", "c2"]);
  assert.deepEqual(a.S.srs, b.S.srs);
});

test("note edits: newest wins, deletions propagate", async () => {
  const { f } = setup();
  const a = device(f), b = device(f);
  await a.sync.detect(); await b.sync.detect();
  a.S.notes.push({ id: "n1", title: "v1", body: "", tags: [], created: 1, updated: 100 }); await a.sync.sync(); await b.sync.sync();
  b.S.notes[0] = { ...b.S.notes[0], title: "v2 from b", updated: 300 };
  a.S.notes[0] = { ...a.S.notes[0], title: "v2 from a (older)", updated: 200 };
  await b.sync.sync(); await a.sync.sync();
  assert.equal(a.S.notes[0].title, "v2 from b");
  a.S.notes = []; await a.sync.sync(); await b.sync.sync();
  assert.equal(b.S.notes.length, 0);
});

test("a fresh device does not overwrite server data with empty defaults", async () => {
  const { f } = setup();
  const a = device(f); await a.sync.detect();
  a.S.path = { micrograd: { status: "done" } }; await a.sync.sync();
  const b = device(f); await b.sync.detect(); await b.sync.sync();
  assert.deepEqual(b.S.path, { micrograd: { status: "done" } });
  await a.sync.sync();
  assert.deepEqual(a.S.path, { micrograd: { status: "done" } });
});

test("offline: sync reports offline and keeps local data", async () => {
  const { f } = setup();
  let down = false; const flaky = (...a) => (down ? Promise.reject(new TypeError("Failed to fetch")) : f(...a));
  const statuses = []; const S = blankState();
  const s = ForgeSync.create({ getState: () => S, onRemoteChange() {}, onStatus: (x) => statuses.push(x), fetch: flaky, storage: memStorage() });
  await s.detect(); down = true; S.log.push({ id: "x", min: 5 });
  await s.sync();
  assert.equal(s.status, "offline"); assert.equal(S.log.length, 1);
  down = false; await s.sync(); assert.equal(s.status, "synced");
});
