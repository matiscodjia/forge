// Warm-up: one real call per AI task, step by step (each step is its own request, to stay inside the Worker's
// per-request limits). It checks the routing, the key and the replies, and leaves real work behind: a Proof
// question and today's plan. Every call is also in the audit log.
import { aiConfig, routing } from "./ai.js";
import { tutor } from "./tutor.js";
import { generate, gradeDiagnostic } from "./proof.js";
import { plan } from "./planner.js";
import { fileThought } from "./capture.js";

export const STEPS = ["tutor", "question_gen", "grading", "planner", "assistant"];
const bad = (m, status = 400) => Object.assign(new Error(m), { status });

const RUN = {
  tutor: async (db, env, o) => {
    const r = await tutor(db, env, { kind: "drill", id: "softmax", title: "Stable softmax", desc: "Write softmax(x) over the last axis, numerically stable.", tests: ["rows sum to 1", "no overflow for x = 1000"], code: "def softmax(x):\n    e = np.exp(x)\n    return e / e.sum()", run: "test_overflow: FAILED (nan)", messages: [{ role: "me", text: "Why do I get nan for big inputs?" }] }, o);
    return r.reply;
  },
  question_gen: async (db, env, o) => {
    const r = await generate(db, env, { ...o, force: true });
    const q = await db.prepare("SELECT prompt, source_title FROM questions WHERE id = ?").bind(r.id).first();
    return q ? `${q.prompt} (from ${q.source_title})` : JSON.stringify(r);
  },
  grading: async (db, env, o) => {
    const r = await gradeDiagnostic(db, env, { part: "ml", questions: [{ q: "Why divide attention scores by √d_k?", keys: ["dot products grow with d_k (variance d_k)", "large logits saturate the softmax", "gradients vanish when saturated"], answer: "Because the dot product of two random vectors has variance d_k, so without scaling the logits get large, the softmax saturates and its gradients become tiny." }] }, o);
    return `score ${r.score}: ${r.scores[0].fix}`;
  },
  planner: async (db, env, o) => { const r = await plan(db, env, { ...o, force: true }); return `${r.plan.fallback ? "[fallback] " : ""}${r.plan.why}`; },
  assistant: async (db, env, o) => {
    const r = await fileThought(db, env, { text: "Je viens de comprendre que le masque causal doit être appliqué avant le softmax, sinon les positions futures gardent du poids.", where: { label: "Arena · Causal self-attention" }, notes: [], modules: [{ id: "gpt", t: "GPT from scratch" }] }, o);
    if (r.fallback) throw new Error(r.error || "the assistant's reply was unusable");
    return `→ ${r.title || r.note} [${r.mod || "no module"}] · ${r.cards.length} card(s) · ${r.nudge}`;
  }
};

/** POST /api/warmup/:step → { step, provider, model, ok, ms, sample | error } */
export async function warmup(db, env, step, { now = new Date(), fetch: f } = {}) {
  if (!RUN[step]) throw bad(`Unknown step. Steps: ${STEPS.join(", ")}`);
  const provider = routing(env)[step === "assistant" ? "assistant" : step] || null;
  const model = provider ? aiConfig(env).providers?.[provider]?.model || "" : "";
  const t0 = Date.now();
  try {
    const sample = String(await RUN[step](db, env, { now, fetch: f }) || "").slice(0, 400);
    return { step, provider, model, ok: true, ms: Date.now() - t0, sample };
  } catch (e) {
    return { step, provider, model, ok: false, ms: Date.now() - t0, error: e.message };
  }
}
