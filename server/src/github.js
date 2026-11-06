// GitHub sync for selected repos. Resumable steps: each call processes a few changed files (Workers limits:
// 50 subrequests and 50 D1 queries per call), the client calls again until `done`.
// Unchanged files are skipped by git blob SHA, unchanged chunks by content hash: re-syncing creates nothing.
import { chunkCode, langOf, toRows, insertChunks, sha256 } from "./chunk.js";

const bad = (m, status = 400) => Object.assign(new Error(m), { status });
const now = () => new Date().toISOString();
const VIS = new Set(["private", "trusted", "ai"]);
const SKIP_DIR = /(^|\/)(\.git|node_modules|target|dist|build|vendor|\.venv|venv|__pycache__|\.next|coverage|\.wrangler)\//;
const SKIP_FILE = /(^|\/)(package-lock\.json|Cargo\.lock|poetry\.lock|yarn\.lock|pnpm-lock\.yaml|uv\.lock)$|\.min\.(js|css)$/;
const MAX_FILE = 200_000, STEP_BYTES = 150_000, STEP_FILES = 8;

export const wanted = (path, size) => !!langOf(path) && size <= MAX_FILE && !SKIP_DIR.test(path) && !SKIP_FILE.test(path);

function gh(env, f) {
  return async (path, accept = "application/vnd.github+json") => {
    const r = await f(`https://api.github.com${path}`, { headers: { accept, "user-agent": "forge-worker", "x-github-api-version": "2022-11-28", ...(env.GITHUB_TOKEN ? { authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}) } });
    if (r.status === 404) throw bad(`GitHub: ${path.split("?")[0]} not found${env.GITHUB_TOKEN ? "" : " (private repo? set the GITHUB_TOKEN secret)"}`, 404);
    if (r.status === 403 || r.status === 429) throw bad("GitHub rate limit or permission denied. Set a GITHUB_TOKEN secret or retry later.", 429);
    if (!r.ok) throw bad(`GitHub answered ${r.status}`, 502);
    return accept.includes("raw") ? r.text() : r.json();
  };
}
const enc = (p) => p.split("/").map(encodeURIComponent).join("/");

export async function listRepos(db) {
  return (await db.prepare(
    `SELECT r.*, (SELECT count(*) FROM sources s WHERE s.repo_id = r.id AND s.kind = 'repo') AS files,
            (SELECT count(*) FROM chunks c JOIN sources s ON s.id = c.source_id WHERE s.repo_id = r.id) AS chunks
     FROM repos r ORDER BY r.created`).all()).results;
}

export async function addRepo(db, b) {
  const full = String(b?.full_name || "").trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
  if (!/^[\w.-]+\/[\w.-]+$/.test(full)) throw bad("Repository must look like owner/name");
  const visibility = "ai";
  const id = "r" + (await sha256(full.toLowerCase())).slice(0, 15);
  await db.prepare("INSERT INTO repos (id, full_name, branch, project, visibility, created) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(full_name) DO NOTHING")
    .bind(id, full, String(b.branch || "main").trim() || "main", b.project || full.split("/")[1], visibility, now()).run();
  return { id };
}

export async function patchRepo(db, id, b) {
  if (b.visibility !== undefined) delete b.visibility; // no confidentiality levels any more
  const r = await db.prepare("SELECT id FROM repos WHERE id = ?").bind(id).first(); if (!r) throw bad("Repo not found", 404);
  const stmts = [];
  if (b.visibility) stmts.push(db.prepare("UPDATE repos SET visibility = ? WHERE id = ?").bind(b.visibility, id), db.prepare("UPDATE sources SET visibility = ? WHERE repo_id = ?").bind(b.visibility, id));
  if (b.project !== undefined) stmts.push(db.prepare("UPDATE repos SET project = ? WHERE id = ?").bind(b.project || null, id), db.prepare("UPDATE sources SET project = ? WHERE repo_id = ?").bind(b.project || null, id));
  if (stmts.length) await db.batch(stmts);
  return { ok: true };
}

export async function deleteRepo(db, id) {
  await db.batch([
    db.prepare("DELETE FROM chunks WHERE source_id IN (SELECT id FROM sources WHERE repo_id = ?)").bind(id),
    db.prepare("DELETE FROM sources WHERE repo_id = ?").bind(id),
    db.prepare("DELETE FROM repos WHERE id = ?").bind(id)
  ]);
  return { ok: true };
}

/** One sync step. Returns { done, head, processed: [paths], remaining, deleted, commits }. */
export async function syncStep(db, env, id, { fetch: f = fetch } = {}) {
  const repo = await db.prepare("SELECT * FROM repos WHERE id = ?").bind(id).first();
  if (!repo) throw bad("Repo not found", 404);
  const api = gh(env, f), [owner, name] = repo.full_name.split("/");
  const head = await api(`/repos/${owner}/${name}/commits/${encodeURIComponent(repo.branch)}`);
  const sha = head.sha, tree = await api(`/repos/${owner}/${name}/git/trees/${head.commit.tree.sha}?recursive=1`);
  const files = (tree.tree || []).filter((t) => t.type === "blob" && wanted(t.path, t.size || 0));
  const have = Object.fromEntries((await db.prepare("SELECT id, origin AS path, json_extract(meta, '$.blob') AS blob FROM sources WHERE repo_id = ? AND kind = 'repo'").bind(id).all()).results.map((r) => [r.path, r]));
  const changed = files.filter((t) => !have[t.path] || have[t.path].blob !== t.sha);
  const present = new Set(files.map((t) => t.path)), gone = Object.values(have).filter((r) => !present.has(r.path)).map((r) => r.id);

  const stmts = [], processed = []; let bytes = 0;
  for (const t of changed) {
    if (processed.length >= STEP_FILES || (processed.length && bytes + (t.size || 0) > STEP_BYTES)) break;
    const text = await api(`/repos/${owner}/${name}/contents/${enc(t.path)}?ref=${sha}`, "application/vnd.github.raw+json");
    const sid = "g" + (await sha256(`${id}:${t.path}`)).slice(0, 23), ts = now();
    const rows = await toRows(sid, repo.visibility, chunkCode(t.path, text));
    stmts.push(
      db.prepare(`INSERT INTO sources (id, kind, title, project, visibility, origin, body, meta, created, updated, repo_id, rev) VALUES (?1, 'repo', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8, ?9, 0)
                  ON CONFLICT(id) DO UPDATE SET body = excluded.body, meta = excluded.meta, updated = excluded.updated, visibility = excluded.visibility, project = excluded.project`)
        .bind(sid, `${repo.full_name.split("/")[1]}/${t.path}`, repo.project, repo.visibility, t.path, text, JSON.stringify({ blob: t.sha, lang: langOf(t.path), commit: sha }), ts, id),
      db.prepare("DELETE FROM chunks WHERE source_id = ?1 AND hash NOT IN (SELECT json_extract(value, '$.hash') FROM json_each(?2))").bind(sid, JSON.stringify(rows.map((r) => ({ hash: r.hash })))),
      ...insertChunks(db, rows)
    );
    processed.push(t.path); bytes += t.size || 0;
  }
  if (gone.length && !processed.length) {
    stmts.push(db.prepare("DELETE FROM chunks WHERE source_id IN (SELECT value FROM json_each(?1))").bind(JSON.stringify(gone)),
      db.prepare("DELETE FROM sources WHERE id IN (SELECT value FROM json_each(?1))").bind(JSON.stringify(gone)));
  }
  const remaining = changed.length - processed.length;
  let commits = 0;
  if (!remaining) {
    // Last 30 commits of the branch, minus those already stored (author dates are unreliable for `since`).
    const list = repo.head_sha === sha ? [] : await api(`/repos/${owner}/${name}/commits?sha=${encodeURIComponent(repo.branch)}&per_page=30`);
    const known = new Set(list.length ? (await db.prepare("SELECT origin FROM sources WHERE repo_id = ? AND kind = 'commit'").bind(id).all()).results.map((r) => r.origin) : []);
    const rows = [];
    for (const c of list) {
      if (known.has(c.sha)) continue;
      const msg = c.commit?.message || "", cid = "c" + (await sha256(`${id}:${c.sha}`)).slice(0, 23), when = c.commit?.author?.date || now();
      const text = `commit ${c.sha.slice(0, 10)} · ${when.slice(0, 10)}\n${msg}`;
      rows.push({ sid: cid, title: msg.split("\n")[0].slice(0, 200), when, sha: c.sha, text, hash: await sha256(text) });
    }
    if (rows.length) {
      stmts.push(db.prepare(`INSERT INTO sources (id, kind, title, project, visibility, origin, body, meta, created, updated, repo_id, rev)
          SELECT json_extract(j.value, '$.sid'), 'commit', json_extract(j.value, '$.title'), ?2, ?3, json_extract(j.value, '$.sha'), json_extract(j.value, '$.text'),
                 json_object('sha', json_extract(j.value, '$.sha')), json_extract(j.value, '$.when'), json_extract(j.value, '$.when'), ?4, 0
          FROM json_each(?1) j WHERE true ON CONFLICT(id) DO NOTHING`).bind(JSON.stringify(rows), repo.project, repo.visibility, id),
        ...insertChunks(db, rows.map((r) => ({ id: `${r.sid}:${r.hash.slice(0, 24)}`, source_id: r.sid, ord: 0, text: r.text, meta: JSON.stringify({ commit: r.sha }), visibility: repo.visibility, hash: r.hash }))));
      commits = rows.length;
    }
    stmts.push(db.prepare("UPDATE repos SET head_sha = ?, synced_at = ? WHERE id = ?").bind(sha, now(), id));
  }
  if (stmts.length) await db.batch(stmts);
  return { done: !remaining && !(gone.length && processed.length), head: sha, processed, remaining, deleted: processed.length ? 0 : gone.length, commits, files: files.length };
}
