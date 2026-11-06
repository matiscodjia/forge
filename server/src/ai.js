// AI configuration: providers (with clearance) and task routes. Override with the AI_CONFIG var (JSON).
// Default: Cloudflare Workers AI through the `AI` binding. No key, free tier, requests stay inside Cloudflare,
// so it gets `trusted` clearance. Private items never reach it (contextGate).

export const DEFAULT_AI = {
  providers: {
    "workers-ai": { clearance: "trusted", binding: "AI", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" }
  },
  routes: { question_gen: "workers-ai", grading: "workers-ai" }
};

export function aiConfig(env) {
  if (!env.AI_CONFIG) return DEFAULT_AI;
  return typeof env.AI_CONFIG === "string" ? JSON.parse(env.AI_CONFIG) : env.AI_CONFIG;
}

/** Can `task` run now? (route exists, binding present or API key set) */
export function ready(env, task) {
  try {
    const cfg = aiConfig(env), r = cfg.routes?.[task], name = typeof r === "string" ? r : r?.provider, p = cfg.providers?.[name];
    if (!p) return false;
    return p.binding ? !!env[p.binding] : !!(p.baseUrl && env[p.keyEnv]);
  } catch (e) { return false; }
}
