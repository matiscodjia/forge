// Forge Worker: serves the static app from web/ and the API under /api/*.
import { verifyAccess } from "./auth.js";
import { getState, putState } from "./state.js";

const j = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

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
      if (!(req.headers.get("content-type") || "").startsWith("application/json")) return j({ error: "Expected application/json" }, 415);
    }
    try {
      if (url.pathname === "/api/health") return j({ ok: true, email: user.email });
      if (url.pathname === "/api/state") {
        if (req.method === "GET") return j(await getState(env.DB, Math.max(0, parseInt(url.searchParams.get("since") || "0", 10) || 0)));
        if (req.method === "PUT") return j(await putState(env.DB, await req.json()));
        return j({ error: "Method not allowed" }, 405);
      }
      return j({ error: "Not found" }, 404);
    } catch (e) {
      return j({ error: e.status ? e.message : "Server error" }, e.status || 500);
    }
  }
};
