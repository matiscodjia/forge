// Context flows: the single choke point between Forge data and any LLM provider.
// Every outbound LLM payload must be built from a GatedContext, and only contextGate() can create one.

export const LEVELS = ["ai", "trusted", "private"]; // ascending sensitivity
const rank = (v) => {
  const i = LEVELS.indexOf(v);
  if (i < 0) throw new Error(`Unknown visibility "${v}"`);
  return i;
};

/** True when an item of visibility `v` may be sent to a provider with `clearance`. `private` is never allowed. */
export function allowed(v, clearance) {
  if (v === "private" || clearance === "private") return false;
  return rank(v) <= rank(clearance);
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Phone shapes only (not any long number, so code and math survive): +33 6 12 34 56 78, 06.12.34.56.78, (555) 123-4567.
const PHONE = /(?<![\w.+])(?:\+\d{1,3}(?:[\s.-]?\d){7,12}|0\d(?:[\s.-]?\d{2}){4}|\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4})(?![\w.])/g;

/** Best-effort removal of emails and phone numbers. Runs on everything that leaves, at every clearance. */
export function redact(text) {
  return String(text ?? "")
    .replace(EMAIL, "[email]")
    .replace(PHONE, "[phone]");
}

const BRAND = new WeakSet();

/**
 * Filter items for one provider. Returns a frozen GatedContext:
 *   { task, provider, model, items: [{id, kind, title, text}], dropped: [{id, reason}], audit }
 * `audit` is the ai_audit row to persist (tokens filled in after the call).
 */
export function contextGate(items, provider, { task, decision = null, now = () => new Date().toISOString(), id = () => crypto.randomUUID() } = {}) {
  if (!provider || !provider.name || !provider.clearance) throw new Error("contextGate needs a provider with name and clearance");
  if (!task) throw new Error("contextGate needs a task name");
  const sent = [], dropped = [];
  for (const it of items || []) {
    if (!it || !it.id) { dropped.push({ id: null, reason: "missing id" }); continue; }
    let ok;
    try { ok = allowed(it.visibility, provider.clearance); } catch (e) { dropped.push({ id: it.id, reason: e.message }); continue; }
    if (!ok) { dropped.push({ id: it.id, reason: `${it.visibility} above ${provider.clearance}` }); continue; }
    sent.push(Object.freeze({ id: it.id, kind: it.kind || null, title: redact(it.title || ""), text: redact(it.text ?? it.body ?? "") }));
  }
  const ctx = Object.freeze({
    task, provider: provider.name, model: provider.model || "", items: Object.freeze(sent), dropped: Object.freeze(dropped),
    audit: { id: id(), at: now(), task, provider: provider.name, model: provider.model || "", item_ids: JSON.stringify(sent.map((s) => s.id)), decision: decision ? JSON.stringify(decision) : null, tokens_in: null, tokens_out: null }
  });
  BRAND.add(ctx);
  return ctx;
}

export const isGated = (ctx) => BRAND.has(ctx);
