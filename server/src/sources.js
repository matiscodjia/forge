// Sources (courses, files, notes, repo files, commits), their chunks, local full-text search and the audit log.
import { chunkMarkdown, toRows, insertChunks } from "./chunk.js";

const VIS = new Set(["private", "trusted", "ai"]);
const UPLOAD_KINDS = new Set(["course", "file", "decision"]);
const bad = (m, status = 400) => Object.assign(new Error(m), { status });
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 20);
const vis = (v, dflt) => { const x = v ?? dflt; if (!VIS.has(x)) throw bad(`visibility "${x}" is invalid`); return x; };

export async function listSources(db) {
  const r = await db.prepare(
    `SELECT s.id, s.kind, s.title, s.project, s.visibility, s.origin, s.updated, (SELECT count(*) FROM chunks c WHERE c.source_id = s.id) AS chunks
     FROM sources s WHERE s.deleted = 0 AND s.kind NOT IN ('repo', 'commit') ORDER BY s.updated DESC LIMIT 500`).all();
  return r.results;
}

export async function getSource(db, id) {
  const [s, c] = await db.batch([
    db.prepare("SELECT id, kind, title, project, visibility, origin, repo_id, created, updated FROM sources WHERE id = ? AND deleted = 0").bind(id),
    db.prepare("SELECT id, ord, text, meta, visibility FROM chunks WHERE source_id = ? ORDER BY ord").bind(id)
  ]);
  if (!s.results.length) throw bad("Source not found", 404);
  return { ...s.results[0], chunks: c.results.map((x) => ({ ...x, meta: x.meta ? JSON.parse(x.meta) : {} })) };
}

export async function createSource(db, b) {
  const kind = b?.kind || "course";
  if (!UPLOAD_KINDS.has(kind)) throw bad(`kind must be one of ${[...UPLOAD_KINDS].join(", ")}`);
  const title = String(b.title || "").trim().slice(0, 300); if (!title) throw bad("title is required");
  const id = uid(), t = now();
  await db.prepare("INSERT INTO sources (id, kind, title, project, visibility, origin, created, updated, rev) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)")
    .bind(id, kind, title, b.project || null, vis(b.visibility, kind === "decision" ? "trusted" : "ai"), String(b.origin || "").slice(0, 300) || null, t, t).run();
  return { id };
}

/** Append extracted text (PDF pages, a Markdown file…) to an uploaded source. Small batches keep each call cheap. */
export async function appendParts(db, id, b) {
  const parts = Array.isArray(b?.parts) ? b.parts : [];
  if (!parts.length || parts.length > 40) throw bad("Send 1–40 parts per request");
  const src = await db.prepare("SELECT id, kind, visibility FROM sources WHERE id = ? AND deleted = 0").bind(id).first();
  if (!src) throw bad("Source not found", 404);
  if (!UPLOAD_KINDS.has(src.kind)) throw bad("Only uploaded sources accept parts");
  const chunks = parts.flatMap((p) => chunkMarkdown(String(p.text || "").slice(0, 200_000), { ...(p.meta && typeof p.meta === "object" ? p.meta : {}) }));
  const offset = (await db.prepare("SELECT count(*) AS n FROM chunks WHERE source_id = ?").bind(id).first("n")) || 0;
  const rows = (await toRows(id, src.visibility, chunks)).map((r) => ({ ...r, ord: r.ord + offset }));
  if (rows.length) await db.batch([...insertChunks(db, rows), db.prepare("UPDATE sources SET updated = ? WHERE id = ?").bind(now(), id)]);
  return { chunks: rows.length };
}

export async function patchSource(db, id, b) {
  const s = await db.prepare("SELECT kind FROM sources WHERE id = ? AND deleted = 0").bind(id).first();
  if (!s) throw bad("Source not found", 404);
  if (s.kind === "note" || s.kind === "journal") throw bad("Change a note's visibility in the Library, so every device agrees", 409);
  const sets = [], args = [];
  if (b.visibility !== undefined) { sets.push("visibility = ?"); args.push(vis(b.visibility)); }
  if (b.title !== undefined) { sets.push("title = ?"); args.push(String(b.title).slice(0, 300)); }
  if (b.project !== undefined) { sets.push("project = ?"); args.push(b.project || null); }
  if (!sets.length) throw bad("Nothing to change");
  sets.push("updated = ?"); args.push(now());
  await db.prepare(`UPDATE sources SET ${sets.join(", ")} WHERE id = ?`).bind(...args, id).run(); // trigger sources_vis updates the chunks
  return { ok: true };
}

export async function deleteSource(db, id) {
  const s = await db.prepare("SELECT kind FROM sources WHERE id = ?").bind(id).first();
  if (!s) throw bad("Source not found", 404);
  if (s.kind === "note" || s.kind === "journal") throw bad("Delete notes from the Library", 409);
  await db.batch([db.prepare("DELETE FROM chunks WHERE source_id = ?").bind(id), db.prepare("DELETE FROM sources WHERE id = ?").bind(id)]);
  return { ok: true };
}

/** Replace the chunks of notes that just synced. Two statements whatever the number of notes. */
export async function rechunkNotes(db, notes) {
  if (!notes.length) return [];
  const rows = [];
  for (const n of notes) if (!n.deleted) rows.push(...await toRows(n.id, n.visibility, chunkMarkdown(n.body || "", { heading: null })));
  return [db.prepare("DELETE FROM chunks WHERE source_id IN (SELECT value FROM json_each(?1))").bind(JSON.stringify(notes.map((n) => n.id))), ...insertChunks(db, rows)];
}

/** Local FTS5 search. Allowed over every visibility: nothing leaves the database. */
export async function search(db, q, { project = null, limit = 30 } = {}) {
  const toks = String(q || "").match(/[\p{L}\p{N}_]+/gu) || [];
  if (!toks.length) return { results: [] };
  const match = toks.slice(0, 12).map((t) => `"${t}"*`).join(" ");
  const r = await db.prepare(
    `SELECT c.id, c.source_id, c.meta, c.visibility, s.kind, s.title, s.project, s.origin,
            snippet(chunks_fts, 0, char(1), char(2), '…', 18) AS snip, bm25(chunks_fts) AS score
     FROM chunks_fts JOIN chunks c ON c.rowid = chunks_fts.rowid JOIN sources s ON s.id = c.source_id
     WHERE chunks_fts MATCH ?1 AND s.deleted = 0 AND (?2 IS NULL OR s.project = ?2)
     ORDER BY score LIMIT ?3`).bind(match, project, Math.min(100, limit)).all();
  return { results: r.results.map((x) => ({ ...x, meta: x.meta ? JSON.parse(x.meta) : {} })) };
}

/** The Context inspector: each LLM call with the exact items that left. */
export async function listAudit(db, limit = 100) {
  const rows = (await db.prepare("SELECT * FROM ai_audit ORDER BY at DESC LIMIT ?").bind(Math.min(500, limit)).all()).results;
  const ids = [...new Set(rows.flatMap((r) => { try { return JSON.parse(r.item_ids); } catch (e) { return []; } }))];
  let names = {};
  if (ids.length) {
    const r = await db.prepare(
      `SELECT j.value AS id, coalesce(s.title, s2.title) AS title, coalesce(s.kind, s2.kind) AS kind, coalesce(s.visibility, c.visibility) AS visibility, coalesce(s.id, c.source_id) AS source_id
       FROM json_each(?1) j LEFT JOIN sources s ON s.id = j.value LEFT JOIN chunks c ON c.id = j.value LEFT JOIN sources s2 ON s2.id = c.source_id`).bind(JSON.stringify(ids)).all();
    names = Object.fromEntries(r.results.filter((x) => x.source_id).map((x) => [x.id, x]));
  }
  return { calls: rows.map((r) => ({ ...r, items: (JSON.parse(r.item_ids || "[]")).map((id) => names[id] || { id, title: "(deleted)" }), decision: r.decision ? JSON.parse(r.decision) : null })) };
}
