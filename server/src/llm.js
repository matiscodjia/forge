// The only function that talks to an LLM provider. It accepts nothing but a GatedContext.
import { isGated, redact } from "./gate.js";

/**
 * callLLM(ctx, { instruction, question }, { fetch, env, providers, audit })
 *  - ctx: from contextGate(); anything else throws before any network call.
 *  - instruction: the task prompt written in code (e.g. "Write one exam question from this chunk…").
 *  - question: optional text typed live by Matis; redacted like everything else.
 *  - providers[ctx.provider] = { baseUrl, model, keyEnv } — any OpenAI-compatible /chat/completions endpoint.
 *  - audit.write(row) persists the ai_audit row, with token counts, whether the call succeeds or not.
 */
export async function callLLM(ctx, { instruction, question = "", maxTokens = 1024 } = {}, { fetch: f = fetch, env = {}, providers, audit }) {
  if (!isGated(ctx)) throw new Error("callLLM refuses context that did not pass contextGate");
  const p = providers?.[ctx.provider];
  if (!p || !p.baseUrl) throw new Error(`Provider "${ctx.provider}" is not configured`);
  const sources = ctx.items.map((it) => `<source id="${it.id}"${it.kind ? ` kind="${it.kind}"` : ""}${it.title ? ` title="${it.title.replace(/"/g, "'")}"` : ""}>\n${it.text}\n</source>`).join("\n");
  const body = {
    model: ctx.model || p.model,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: `${instruction}\nCite sources by id like [src:ID]. Use only the sources below; say so when they are not enough.` },
      { role: "user", content: `${sources}\n\n${redact(question)}`.trim() }
    ]
  };
  const row = { ...ctx.audit };
  try {
    const res = await f(`${p.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env[p.keyEnv] || ""}` },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`${ctx.provider} answered ${res.status}`);
    const data = await res.json();
    row.tokens_in = data.usage?.prompt_tokens ?? null; row.tokens_out = data.usage?.completion_tokens ?? null;
    return { text: data.choices?.[0]?.message?.content ?? "", cited: [...new Set([...(data.choices?.[0]?.message?.content || "").matchAll(/\[src:([^\]\s]+)\]/g)].map((m) => m[1]))], audit: row };
  } finally {
    if (audit) await audit.write(row);
  }
}

/** D1-backed audit store. */
export const d1Audit = (db) => ({
  write: (r) => db.prepare("INSERT INTO ai_audit (id, at, task, provider, model, item_ids, decision, tokens_in, tokens_out) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(r.id, r.at, r.task, r.provider, r.model, r.item_ids, r.decision ?? null, r.tokens_in, r.tokens_out).run()
});
