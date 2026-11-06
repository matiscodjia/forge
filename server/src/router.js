// Model routing: task → provider, with clearance checks. Never upgrades silently: every decision is returned for logging.
import { LEVELS, allowed } from "./gate.js";

/**
 * config = {
 *   providers: { cheap: { clearance: "ai", baseUrl, model, keyEnv }, trusted: { clearance: "trusted", … } },
 *   routes: { question_gen: "cheap", agent: "trusted", wiki: { provider: "cheap", fallback: "trusted" } }
 * }
 * A route may name a `fallback`: only then can items above the main provider's clearance switch it.
 * Without a fallback those items are excluded (by contextGate) and the decision says so.
 */
export function resolveRoute(task, items, config) {
  const r = config.routes?.[task];
  if (!r) throw new Error(`No route for task "${task}"`);
  const main = typeof r === "string" ? r : r.provider, fb = typeof r === "string" ? null : r.fallback || null;
  const prov = (name) => { const p = config.providers?.[name]; if (!p) throw new Error(`Unknown provider "${name}" in route "${task}"`); if (!LEVELS.includes(p.clearance) || p.clearance === "private") throw new Error(`Provider "${name}" has invalid clearance "${p.clearance}"`); return { name, ...p }; };
  const p = prov(main);
  const above = (items || []).filter((it) => it && it.visibility !== "private" && LEVELS.includes(it.visibility) && !allowed(it.visibility, p.clearance));
  if (!above.length) return { provider: p, decision: { task, action: "route", provider: p.name } };
  if (fb) {
    const f = prov(fb);
    if (above.every((it) => allowed(it.visibility, f.clearance))) return { provider: f, decision: { task, action: "switched", from: p.name, provider: f.name, because: above.map((i) => i.id) } };
  }
  return { provider: p, decision: { task, action: "excluded", provider: p.name, excluded: above.map((i) => i.id) } };
}
