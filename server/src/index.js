// Forge Worker: serves the static app from web/ and the API under /api/*.
import { verifyAccess } from "./auth.js";
import { getState, putState } from "./state.js";
import { listSources, getSource, createSource, appendParts, patchSource, deleteSource, search, listAudit } from "./sources.js";
import { listRepos, addRepo, patchRepo, deleteRepo, syncStep } from "./github.js";

const j = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/** [method, pattern, handler(ctx, params)] — first match wins. */
const ROUTES = [
  ["GET", /^\/api\/health$/, (c) => ({ ok: true, email: c.user.email, github: !!c.env.GITHUB_TOKEN })],
  ["GET", /^\/api\/state$/, (c) => getState(c.db, Math.max(0, parseInt(c.url.searchParams.get("since") || "0", 10) || 0))],
  ["PUT", /^\/api\/state$/, async (c) => putState(c.db, await c.req.json())],
  ["GET", /^\/api\/sources$/, (c) => listSources(c.db)],
  ["POST", /^\/api\/sources$/, async (c) => createSource(c.db, await c.req.json())],
  ["GET", /^\/api\/sources\/([\w-]+)$/, (c, [id]) => getSource(c.db, id)],
  ["POST", /^\/api\/sources\/([\w-]+)\/parts$/, async (c, [id]) => appendParts(c.db, id, await c.req.json())],
  ["PATCH", /^\/api\/sources\/([\w-]+)$/, async (c, [id]) => patchSource(c.db, id, await c.req.json())],
  ["DELETE", /^\/api\/sources\/([\w-]+)$/, (c, [id]) => deleteSource(c.db, id)],
  ["GET", /^\/api\/search$/, (c) => search(c.db, c.url.searchParams.get("q"), { project: c.url.searchParams.get("project") || null })],
  ["GET", /^\/api\/audit$/, (c) => listAudit(c.db)],
  ["GET", /^\/api\/repos$/, (c) => listRepos(c.db)],
  ["POST", /^\/api\/repos$/, async (c) => addRepo(c.db, await c.req.json())],
  ["PATCH", /^\/api\/repos\/([\w-]+)$/, async (c, [id]) => patchRepo(c.db, id, await c.req.json())],
  ["DELETE", /^\/api\/repos\/([\w-]+)$/, (c, [id]) => deleteRepo(c.db, id)],
  ["POST", /^\/api\/repos\/([\w-]+)\/sync$/, (c, [id]) => syncStep(c.db, c.env, id)]
];

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);

    let user;
    try { user = await verifyAccess(req, env); } catch (e) { return j({ error: e.message }, e.status || 401); }
    // Writes must come from this origin with a JSON body (blocks cross-site form posts).
    if (req.method !== "GET") {
      const origin = req.headers.get("origin");
      if (origin && origin !== url.origin) return j({ error: "Cross-origin request refused" }, 403);
      if (req.method !== "DELETE" && !(req.headers.get("content-type") || "").startsWith("application/json")) return j({ error: "Expected application/json" }, 415);
    }
    const ctx = { req, env, url, user, db: env.DB };
    let allowed = false;
    for (const [m, re, h] of ROUTES) {
      const p = url.pathname.match(re); if (!p) continue;
      allowed = true; if (m !== req.method) continue;
      try { return j(await h(ctx, p.slice(1))); }
      catch (e) { return j({ error: e.status ? e.message : "Server error" }, e.status || 500); }
    }
    return j({ error: allowed ? "Method not allowed" : "Not found" }, allowed ? 405 : 404);
  }
};
