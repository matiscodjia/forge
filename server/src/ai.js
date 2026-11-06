// AI configuration: providers (with clearance) and task routes. Override everything with the AI_CONFIG var (JSON).
// Default: Cloudflare Workers AI through the `AI` binding (no key, requests stay inside Cloudflare, `trusted`).
// With the DEEPSEEK_API_KEY secret set, every task goes to DeepSeek (OpenAI-compatible API), cleared for
// `trusted` items by Matis's choice. Private items never reach any provider (contextGate).

export const TASKS = ["question_gen", "grading", "tutor", "planner"];
export const DEFAULT_AI = {
  providers: { "workers-ai": { clearance: "trusted", binding: "AI", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" } },
  routes: Object.fromEntries(TASKS.map((t) => [t, "workers-ai"]))
};

export function aiConfig(env) {
  if (env.AI_CONFIG) return typeof env.AI_CONFIG === "string" ? JSON.parse(env.AI_CONFIG) : env.AI_CONFIG;
  if (env.DEEPSEEK_API_KEY) return {
    providers: { ...DEFAULT_AI.providers, deepseek: { clearance: "trusted", baseUrl: "https://api.deepseek.com", model: env.DEEPSEEK_MODEL || "deepseek-chat", keyEnv: "DEEPSEEK_API_KEY" } },
    routes: Object.fromEntries(TASKS.map((t) => [t, "deepseek"]))
  };
  return DEFAULT_AI;
}

/** Can `task` run now? (route exists, binding present or API key set) */
export function ready(env, task) {
  try {
    const cfg = aiConfig(env), r = cfg.routes?.[task], name = typeof r === "string" ? r : r?.provider, p = cfg.providers?.[name];
    if (!p) return false;
    return p.binding ? !!env[p.binding] : !!(p.baseUrl && env[p.keyEnv]);
  } catch (e) { return false; }
}

/** Provider name per task, for the health check and the context inspector. */
export const routing = (env) => { try { const c = aiConfig(env); return Object.fromEntries(TASKS.map((t) => { const r = c.routes?.[t]; return [t, typeof r === "string" ? r : r?.provider || null]; })); } catch (e) { return {}; } };
