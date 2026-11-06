// Shared test helpers: SQLite (node:sqlite) standing in for D1, and the Worker called in-process.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import worker from "../../src/index.js";

const root = new URL("../../migrations/", import.meta.url);
/** Minimal D1 API over node:sqlite: prepare/bind/first/all/run/batch. */
export function fakeD1() {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(root).filter((x) => x.endsWith(".sql")).sort()) db.exec(readFileSync(new URL(f, root), "utf8"));
  const counter = { n: 0, max: 0 };
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async (col) => { counter.n++; const r = db.prepare(sql).get(...args); return r ? (col ? r[col] : r) : null; },
    all: async () => { counter.n++; return { results: db.prepare(sql).all(...args) }; },
    run: async () => { counter.n++; const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
    _exec: () => { counter.n++; const p = db.prepare(sql); return /^\s*(SELECT|WITH)/i.test(sql) || /RETURNING/i.test(sql) ? { results: p.all(...args), meta: { changes: 0 } } : { results: [], meta: { changes: Number(p.run(...args).changes) } }; }
  });
  return { counter, prepare: (sql) => stmt(sql), batch: async (ss) => { db.exec("BEGIN"); try { const out = ss.map((s) => s._exec()); db.exec("COMMIT"); return out; } catch (e) { db.exec("ROLLBACK"); throw e; } } };
}

export function setup(env = {}) {
  const e = { DB: fakeD1(), AUTH: "dev", ASSETS: { fetch: async () => new Response("asset") }, ...env };
  // Each request counts its D1 queries (Workers free plan: 50 per invocation).
  const f = async (path, init = {}) => { e.DB.counter.n = 0; const r = await worker.fetch(new Request(new URL(path, "http://localhost").href, init), e); e.DB.counter.max = Math.max(e.DB.counter.max, e.DB.counter.n); return r; };
  const call = async (method, path, body) => { const r = await f(path, { method, headers: body !== undefined ? { "content-type": "application/json" } : {}, body: body !== undefined ? JSON.stringify(body) : undefined }); const d = await r.json(); if (!r.ok) throw Object.assign(new Error(d.error), { status: r.status }); return d; };
  return { env: e, f, call };
}
