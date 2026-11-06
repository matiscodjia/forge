// Forge Worker: serves the static app from web/ and the API under /api/*.
import { verifyAccess } from "./auth.js";
import { getState, putState } from "./state.js";
import { listSources, getSource, createSource, appendParts, patchSource, deleteSource, search, listAudit } from "./sources.js";
import { listRepos, addRepo, patchRepo, deleteRepo, syncStep } from "./github.js";
import { session, generate, answer, retire, mastery, generateCheck, gradeDiagnostic } from "./proof.js";
import { getPlan, plan, activity } from "./planner.js";
import { ready, routing } from "./ai.js";
import { tutor } from "./tutor.js";
import { importReading } from "./reading.js";
import { fileThought } from "./capture.js";
import { explainCard, giveUp } from "./explain.js";

const j = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/** [method, pattern, handler(ctx, params)] — first match wins. */
const ROUTES = [
  ["GET", /^\/api\/health$/, (c) => ({ ok: true, email: c.user.email, github: !!c.env.GITHUB_TOKEN, ai: ready(c.env, "question_gen") && ready(c.env, "grading"), tutor: ready(c.env, "tutor"), planner: ready(c.env, "planner"), assistant: ready(c.env, "assistant"), routes: routing(c.env) })],
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
  ["POST", /^\/api\/repos\/([\w-]+)\/sync$/, (c, [id]) => syncStep(c.db, c.env, id)],
  ["GET", /^\/api\/proof$/, (c) => session(c.db, c.env)],
  ["GET", /^\/api\/proof\/mastery$/, (c) => mastery(c.db, c.env)],
  ["POST", /^\/api\/proof\/generate$/, (c) => generate(c.db, c.env, { force: true })],
  ["POST", /^\/api\/proof\/([\w-]+)\/answer$/, async (c, [id]) => answer(c.db, c.env, id, await c.req.json())],
  ["POST", /^\/api\/proof\/([\w-]+)\/retire$/, (c, [id]) => retire(c.db, id)],
  ["POST", /^\/api\/tutor$/, async (c) => tutor(c.db, c.env, await c.req.json())],
  ["POST", /^\/api\/proof\/check$/, async (c) => generateCheck(c.db, c.env, await c.req.json())],
  ["POST", /^\/api\/diagnostic\/grade$/, async (c) => gradeDiagnostic(c.db, c.env, await c.req.json())],
  ["GET", /^\/api\/plan$/, (c) => getPlan(c.db, c.env)],
  ["POST", /^\/api\/plan$/, (c) => plan(c.db, c.env, { force: true })],
  ["GET", /^\/api\/activity$/, (c) => activity(c.db)],
  ["POST", /^\/api\/reading$/, async (c) => importReading(c.db, await c.req.json())],
  ["POST", /^\/api\/capture$/, async (c) => fileThought(c.db, c.env, await c.req.json())],
  ["POST", /^\/api\/explain$/, async (c) => explainCard(c.db, c.env, await c.req.json())],
  ["POST", /^\/api\/proof\/([\w-]+)\/giveup$/, (c, [id]) => giveUp(c.db, c.env, id)]
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
  },
  // Daily cron (wrangler.jsonc → triggers.crons): today's new question, generated before the day starts.
  async scheduled(ev, env, ctx) {
    // Nightly: today's question from the sources, then the planner agent (plan + check questions).
    const now = new Date(ev.scheduledTime), log = (what) => [(r) => console.log(what, JSON.stringify(r)), (e) => console.log(`${what} failed:`, e.message)];
    ctx.waitUntil(generate(env.DB, env, { now }).then(...log("proof cron")).then(() => plan(env.DB, env, { now })).then(...log("planner cron")));
  }
};
