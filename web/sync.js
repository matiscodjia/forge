/* Forge sync: localStorage stays the working copy (works offline); D1 behind /api/state is the source of truth.
   Per key: pull changes since the last rev, merge where both sides changed, push what changed locally.
   Notes: last writer wins on `updated`, deletions travel as tombstones. */
(function (root) {
"use strict";
const KEYS = ["days", "weeks", "practice", "code", "mocks", "theory", "skills", "pipeline", "path", "srs", "revDays", "log", "mock", "theoryRun"];
const META = "forge.sync";
const h = (v) => { const s = JSON.stringify(v === undefined ? null : v); let x = 5381; for (let i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) | 0; return (x >>> 0).toString(36) + ":" + s.length; };
const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
const isEmpty = (v) => v == null || (Array.isArray(v) ? !v.length : isObj(v) && !Object.keys(v).length);

/** Merge when both sides changed a key: union of records, local wins on a direct clash. */
function merge(local, remote) {
  if (Array.isArray(local) && Array.isArray(remote)) {
    if (local.concat(remote).every((x) => isObj(x) && "id" in x)) { const m = new Map(remote.map((x) => [x.id, x])); local.forEach((x) => m.set(x.id, x)); return [...m.values()]; }
    const seen = new Set(remote.map((x) => JSON.stringify(x))); return remote.concat(local.filter((x) => !seen.has(JSON.stringify(x))));
  }
  if (isObj(local) && isObj(remote)) { const o = Object.assign({}, remote); for (const k of Object.keys(local)) o[k] = k in remote ? merge(local[k], remote[k]) : local[k]; return o; }
  return local === undefined ? remote : local;
}

function create({ getState, onRemoteChange, onStatus = () => {}, fetch: f = (...a) => root.fetch(...a), storage = root.localStorage }) {
  let meta = { rev: 0, base: {}, hash: {}, notes: {} };
  try { meta = Object.assign(meta, JSON.parse(storage.getItem(META) || "{}")); } catch (e) {}
  const saveMeta = () => { try { storage.setItem(META, JSON.stringify(meta)); } catch (e) {} };
  let enabled = false, busy = false, again = false, status = "local";
  const set = (s, detail) => { status = s; onStatus(s, detail); };

  const api = async (method, path, body) => {
    const r = await f(path, { method, credentials: "same-origin", redirect: "manual", headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    if (r.type === "opaqueredirect" || r.status === 401 || r.status === 403) { const e = new Error("signed out"); e.auth = true; throw e; } // Access session expired
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    return r.json();
  };

  async function detect() {
    try {
      const r = await f("/api/health", { credentials: "same-origin", redirect: "manual" });
      const ok = r.ok && (r.headers.get("content-type") || "").includes("application/json");
      enabled = ok; set(ok ? "synced" : r.type === "opaqueredirect" || r.status === 401 || r.status === 403 ? "signed-out" : "local");
    } catch (e) { enabled = false; set("local"); }
    return enabled;
  }

  function applyPull(S, res) {
    let changed = false;
    for (const [k, x] of Object.entries(res.kv || {})) {
      const dirty = meta.hash[k] === undefined ? !isEmpty(S[k]) : h(S[k]) !== meta.hash[k];
      S[k] = dirty ? merge(S[k], x.v) : x.v;
      meta.base[k] = x.rev; meta.hash[k] = dirty ? null : h(x.v); changed = true; // merged value stays dirty → pushed next
    }
    for (const n of res.notes || []) {
      const i = S.notes.findIndex((x) => x.id === n.id), local = S.notes[i];
      const localDirty = local && local.updated !== meta.notes[n.id];
      if (local && localDirty && local.updated > n.updated) continue;
      if (n.deleted) { if (i >= 0) { S.notes.splice(i, 1); changed = true; } }
      else { const clean = { id: n.id, kind: n.kind, title: n.title, body: n.body, tags: n.tags, mod: n.mod, visibility: n.visibility, created: n.created, updated: n.updated }; if (i >= 0) S.notes[i] = clean; else S.notes.unshift(clean); changed = true; }
      meta.notes[n.id] = n.deleted ? -1 : n.updated;
    }
    meta.rev = Math.max(meta.rev, res.rev || 0);
    return changed;
  }

  async function run() {
    const S = getState();
    let changed = applyPull(S, await api("GET", `/api/state?since=${meta.rev}`));
    for (let round = 0; round < 40; round++) { // notes go 20 at a time: the server does a bounded amount of work per call
      const kv = {};
      for (const k of KEYS) if (meta.hash[k] === undefined ? !isEmpty(S[k]) : h(S[k]) !== meta.hash[k]) kv[k] = { v: S[k] === undefined ? null : S[k], base: meta.base[k] || 0 };
      const ids = new Set(S.notes.map((n) => n.id));
      let notes = S.notes.filter((n) => n.updated !== meta.notes[n.id]);
      for (const [id, u] of Object.entries(meta.notes)) if (u !== -1 && !ids.has(id)) notes.push({ id, deleted: true, updated: Date.now() });
      notes = notes.slice(0, 20);
      if (!Object.keys(kv).length && !notes.length) break;
      const res = await api("PUT", "/api/state", { kv, notes });
      for (const k of res.applied) { meta.base[k] = res.rev; meta.hash[k] = h(kv[k].v); }
      for (const id of res.notes.applied) { const n = notes.find((x) => x.id === id); meta.notes[id] = n.deleted ? -1 : n.updated; }
      if (Object.keys(res.conflicts).length || res.notes.newer.length) changed = applyPull(S, { kv: res.conflicts, notes: res.notes.newer }) || changed;
      saveMeta();
    }
    saveMeta();
    return changed;
  }

  async function sync() {
    if (!enabled && !(await detect())) return false; // signed out or offline earlier: retry on the next tick
    if (busy) { again = true; return false; }
    busy = true; set("syncing");
    try {
      const changed = await run(); set("synced");
      if (changed) onRemoteChange();
      return changed;
    } catch (e) { set(e.auth ? "signed-out" : "offline", e.message); return false; }
    finally { busy = false; if (again) { again = false; setTimeout(sync, 50); } }
  }

  return { detect, sync, merge, get enabled() { return enabled; }, get status() { return status; }, _meta: () => meta };
}

const ForgeSync = { create, merge, KEYS };
if (typeof module !== "undefined" && module.exports) module.exports = ForgeSync; else root.ForgeSync = ForgeSync;
})(typeof window !== "undefined" ? window : globalThis);
