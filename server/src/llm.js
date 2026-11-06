// The only function that talks to an LLM provider. It accepts nothing but a GatedContext.
import { isGated, redact } from "./gate.js";

/**
 * callLLM(ctx, { instruction, question }, { fetch, env, providers, audit })
 *  - ctx: from contextGate(); anything else throws before any network call.
 *  - instruction: the task prompt written in code (e.g. "Write one exam question from this chunk…").
 *  - question: optional text typed live by Matis; redacted like everything else.
 *  - providers[ctx.provider] = { baseUrl, model, keyEnv } — any OpenAI-compatible /chat/completions endpoint,
 *    or { binding: "AI", model } — a Cloudflare Workers AI binding (env.AI.run).
 *  - audit.write(row) persists the ai_audit row, with token counts, whether the call succeeds or not.
 */
/** Matis's choice: the assistant always speaks English (the app and the interviews are in English), whatever the
    language of his notes, messages or sources. Every call goes through here, so it is set once. */
export const ENGLISH = "Always write in English, even when the sources or Matis's messages are in French or another language (translate what you quote; keep code and math as they are).";
/** The app renders LaTeX between $…$ and $$…$$ (KaTeX), so every formula must be written that way. */
export const MATH = "Write every formula, symbol or index in LaTeX between $...$ (inline) or $$...$$ (display), e.g. $(AB)_{ij} = \\sum_k A_{ik} B_{kj}$, never as bare text; inside JSON strings, double every backslash.";

export async function callLLM(ctx, { instruction, question = "", maxTokens = 1024 } = {}, { fetch: f = fetch, env = {}, providers, audit }) {
  if (!isGated(ctx)) throw new Error("callLLM refuses context that did not pass contextGate");
  const p = providers?.[ctx.provider];
  if (!p || !(p.baseUrl || p.binding)) throw new Error(`Provider "${ctx.provider}" is not configured`);
  const sources = ctx.items.map((it) => `<source id="${it.id}"${it.kind ? ` kind="${it.kind}"` : ""}${it.title ? ` title="${it.title.replace(/"/g, "'")}"` : ""}>\n${it.text}\n</source>`).join("\n");
  const body = {
    model: ctx.model || p.model,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: `${instruction}\n${ENGLISH}\n${MATH}\nCite sources by id like [src:ID]. Use only the sources below; say so when they are not enough.` },
      { role: "user", content: `${sources}\n\n${redact(question)}`.trim() }
    ]
  };
  const row = { ...ctx.audit };
  try {
    let data;
    if (p.binding) {
      // Cloudflare binding (Workers AI): same gated payload, no key, the request stays inside Cloudflare.
      const ai = env[p.binding]; if (!ai || typeof ai.run !== "function") throw new Error(`Binding "${p.binding}" is missing`);
      data = await ai.run(body.model, { messages: body.messages, max_tokens: body.max_tokens });
    } else {
      const res = await f(`${p.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${env[p.keyEnv] || ""}` },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`${ctx.provider} answered ${res.status}`);
      data = await res.json();
    }
    row.tokens_in = data.usage?.prompt_tokens ?? null; row.tokens_out = data.usage?.completion_tokens ?? null;
    const r = data.choices?.[0]?.message?.content ?? data.response ?? "";
    const text = typeof r === "string" ? r : JSON.stringify(r);
    return { text, cited: [...new Set([...text.matchAll(/\[src:([^\]\s]+)\]/g)].map((m) => m[1]))], audit: row };
  } finally {
    if (audit) await audit.write(row);
  }
}

/** D1-backed audit store. */
export const d1Audit = (db) => ({
  write: (r) => db.prepare("INSERT INTO ai_audit (id, at, task, provider, model, item_ids, decision, tokens_in, tokens_out) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(r.id, r.at, r.task, r.provider, r.model, r.item_ids, r.decision ?? null, r.tokens_in, r.tokens_out).run()
});
