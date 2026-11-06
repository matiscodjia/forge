// App state sync over D1. Keys hold one JSON value each, with optimistic concurrency on `rev`.
// Notes are rows in `sources` (kind note|journal), last-writer-wins on `updated`, with tombstones.

import { rechunkNotes } from "./sources.js";

export const SYNC_KEYS = ["days", "weeks", "practice", "code", "mocks", "theory", "skills", "pipeline", "path", "srs", "revDays", "log", "mock", "theoryRun"];
const KEYSET = new Set(SYNC_KEYS);
const VIS = new Set(["private", "trusted", "ai"]);
const MAX_VALUE = 1_500_000; // D1 rows are limited to 2 MB
const bad = (m) => Object.assign(new Error(m), { status: 400 });
const iso = (ms) => new Date(Number(ms) || 0).toISOString();

const rowToNote = (r) => {
  const m = r.meta ? JSON.parse(r.meta) : {};
  return { id: r.id, kind: r.kind, title: r.title || "", body: r.body || "", tags: m.tags || [], mod: m.mod || null, visibility: r.visibility, created: Date.parse(r.created), updated: Date.parse(r.updated), deleted: !!r.deleted, rev: r.rev };
};
const NOTE_COLS = "id, kind, title, body, project, visibility, meta, created, updated, deleted, rev";

export async function getState(db, since = 0) {
  const [rev, kv, notes] = await db.batch([
    db.prepare("SELECT v FROM meta WHERE k = 'rev'"),
    db.prepare("SELECT k, v, rev FROM kv WHERE rev > ?").bind(since),
    db.prepare(`SELECT ${NOTE_COLS} FROM sources WHERE kind IN ('note', 'journal') AND rev > ?`).bind(since)
  ]);
  return {
    rev: rev.results[0]?.v ?? 0,
    kv: Object.fromEntries(kv.results.filter((r) => KEYSET.has(r.k)).map((r) => [r.k, { v: JSON.parse(r.v), rev: r.rev }])),
    notes: notes.results.map(rowToNote)
  };
}

function checkNote(n) {
  if (!n || typeof n.id !== "string" || !/^[\w-]{1,64}$/.test(n.id)) throw bad("note.id is invalid");
  const kind = n.kind || "note"; if (kind !== "note" && kind !== "journal") throw bad("note.kind must be note or journal");
  const visibility = n.visibility || (kind === "journal" ? "private" : "trusted");
  if (!VIS.has(visibility)) throw bad(`note.visibility "${visibility}" is invalid`);
  if (String(n.body || "").length > MAX_VALUE) throw bad("note is too large");
  if (!Number.isFinite(Number(n.updated))) throw bad("note.updated must be a timestamp in ms");
  return { kind, visibility };
}

/** body = { kv: { key: { v, base } }, notes: [note…] }  →  { rev, applied, conflicts, notes: { applied, newer } } */
export async function putState(db, body) {
  if (!body || typeof body !== "object") throw bad("Expected a JSON object");
  const kvIn = Object.entries(body.kv || {}), notesIn = Array.isArray(body.notes) ? body.notes : [];
  for (const [k, x] of kvIn) {
    if (!KEYSET.has(k)) throw bad(`Unknown key "${k}"`);
    if (!x || !("v" in x) || !Number.isInteger(x.base ?? 0)) throw bad(`kv.${k} needs {v, base}`);
    if (JSON.stringify(x.v).length > MAX_VALUE) throw bad(`kv.${k} is too large`);
  }
  if (notesIn.length > 25) throw bad("Send at most 25 notes per request");
  const checked = notesIn.map(checkNote);
  if (!kvIn.length && !notesIn.length) return { rev: (await getState(db, Number.MAX_SAFE_INTEGER)).rev, applied: [], conflicts: {}, notes: { applied: [], newer: [] } };

  const rev = await db.prepare("UPDATE meta SET v = v + 1 WHERE k = 'rev' RETURNING v").first("v");
  const now = new Date().toISOString();
  const stmts = kvIn.map(([k, x]) => db.prepare(
    "INSERT INTO kv (k, v, rev, updated) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(k) DO UPDATE SET v = excluded.v, rev = excluded.rev, updated = excluded.updated WHERE kv.rev = ?5"
  ).bind(k, JSON.stringify(x.v), rev, now, x.base ?? 0));
  notesIn.forEach((n, i) => stmts.push(db.prepare(
    `INSERT INTO sources (${NOTE_COLS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
     ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, title = excluded.title, body = excluded.body, project = excluded.project, visibility = excluded.visibility,
       meta = excluded.meta, updated = excluded.updated, deleted = excluded.deleted, rev = excluded.rev
     WHERE excluded.updated >= sources.updated`
  ).bind(n.id, checked[i].kind, String(n.title || ""), String(n.body || ""), n.mod || null, checked[i].visibility, JSON.stringify({ tags: n.tags || [], mod: n.mod || null }),
    iso(n.created || n.updated), iso(n.updated), n.deleted ? 1 : 0, rev)));
  const res = await db.batch(stmts);

  const applied = [], lost = [], notesApplied = [], notesLost = [];
  kvIn.forEach(([k], i) => (res[i].meta.changes ? applied : lost).push(k));
  notesIn.forEach((n, i) => (res[kvIn.length + i].meta.changes ? notesApplied : notesLost).push(n.id));
  const conflicts = {};
  if (lost.length) {
    const rows = await db.prepare(`SELECT k, v, rev FROM kv WHERE k IN (${lost.map(() => "?").join(",")})`).bind(...lost).all();
    rows.results.forEach((r) => { conflicts[r.k] = { v: JSON.parse(r.v), rev: r.rev }; });
  }
  // Applied notes become searchable chunks (with their visibility); deleted ones lose theirs.
  const rechunk = notesIn.map((n, i) => ({ ...n, visibility: checked[i].visibility })).filter((n) => notesApplied.includes(n.id));
  if (rechunk.length) await db.batch(await rechunkNotes(db, rechunk));
  let newer = [];
  if (notesLost.length) newer = (await db.prepare(`SELECT ${NOTE_COLS} FROM sources WHERE id IN (${notesLost.map(() => "?").join(",")})`).bind(...notesLost).all()).results.map(rowToNote);
  return { rev, applied, conflicts, notes: { applied: notesApplied, newer } };
}
