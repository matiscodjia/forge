// Capture: a thought written anywhere in the app is filed by the assistant. It picks the note to append to (or a
// new one), the Path module, tags, a heading, up to two review cards, and one line that pushes Matis further.
// The client applies the decision to its notes (they sync and feed the brain). Without a model, it goes to Inbox.
import { ask, parseJSON } from "./proof.js";
import { ready } from "./ai.js";

const bad = (m, status = 400) => Object.assign(new Error(m), { status });
const cut = (s, n) => String(s ?? "").slice(0, n);

export const FILE = `You are Forge's assistant. Matis (training to become an ML research engineer by March 2027) just wrote a thought, a reflection or a note while using the app. File it.
The sources give: where he was in the app, his notes (id, title, module), the Path modules, and the thought itself.
Decide:
- "note": the id of the existing note it belongs to (same topic or same module), or "new".
- "title": if new, a short specific title ("Attention — why scale by √d_k"); otherwise "".
- "mod": the Path module id it is about, or null.
- "tags": 1 to 3 lowercase tags.
- "heading": 3 to 7 words summing up the thought.
- "cards": 0 to 2 review cards {"q": "...", "a": "..."} ONLY for facts or reasoning worth remembering that the thought states correctly. Never invent content he did not write.
- "nudge": one sentence, addressed to him ("you…"), that pushes him one step higher: a sharper question to answer, a gap or mistake in the thought, or the concrete next thing to build. Be direct and demanding, never flattering.
Write the title, heading, cards and nudge in English, even when the thought is in French. Reply with JSON only:
{"note": "new", "title": "", "mod": null, "tags": [], "heading": "", "cards": [], "nudge": ""}`;

/** Keep only what exists and is well formed. */
export function validateFiling(x, { notes, modules }) {
  const ids = new Set(notes.map((n) => n.id)), mods = new Set(modules.map((m) => m.id));
  const o = x && typeof x === "object" ? x : {};
  const note = ids.has(o.note) ? o.note : "new";
  const mod = mods.has(o.mod) ? o.mod : null;
  const tags = (Array.isArray(o.tags) ? o.tags : []).map((t) => cut(t, 30).toLowerCase().replace(/^#/, "").trim()).filter(Boolean).slice(0, 3);
  const cards = (Array.isArray(o.cards) ? o.cards : []).filter((c) => c && String(c.q || "").trim() && String(c.a || "").trim()).slice(0, 2).map((c) => ({ q: cut(c.q, 300).replace(/\n/g, " ").trim(), a: cut(c.a, 500).replace(/\n/g, " ").trim() }));
  return { note, title: note === "new" ? cut(o.title, 120).trim() : "", mod, tags, heading: cut(o.heading, 80).trim(), cards, nudge: cut(o.nudge, 280).trim() };
}

/** POST /api/capture { text, where: {label, mod}, notes: [{id, title, mod}], modules: [{id, t}] } → filing decision */
export async function fileThought(db, env, b, { now = new Date(), fetch: f } = {}) {
  const text = cut(b?.text, 20_000).trim(); if (!text) throw bad("Write something first.");
  const notes = (Array.isArray(b.notes) ? b.notes : []).slice(0, 60).map((n) => ({ id: cut(n.id, 64), title: cut(n.title, 120), mod: n.mod ? cut(n.mod, 60) : null }));
  const modules = (Array.isArray(b.modules) ? b.modules : []).slice(0, 80).map((m) => ({ id: cut(m.id, 60), t: cut(m.t, 120) }));
  const where = b.where || {};
  const inbox = { note: "inbox", title: "", mod: where.mod && modules.some((m) => m.id === where.mod) ? where.mod : null, tags: [], heading: "", cards: [], nudge: "", fallback: true };
  if (!ready(env, "assistant")) return inbox;
  const items = [
    { id: "capture:where", kind: "context", visibility: "ai", title: "Where he was", text: `${cut(where.label, 200) || "somewhere in Forge"}${where.mod ? ` (module ${cut(where.mod, 60)})` : ""}` },
    { id: "capture:notes", kind: "notes", visibility: "ai", title: "His notes", text: notes.map((n) => `- ${n.id}: ${n.title}${n.mod ? ` [${n.mod}]` : ""}`).join("\n") || "(none yet)" },
    { id: "capture:modules", kind: "modules", visibility: "ai", title: "Path modules", text: modules.map((m) => `- ${m.id}: ${m.t}`).join("\n") },
    { id: "capture:thought", kind: "thought", visibility: "ai", title: "The thought", text }
  ];
  try {
    const { text: reply } = await ask(db, env, "assistant", items, FILE, "", { now, fetch: f, maxTokens: 500 });
    const x = parseJSON(reply); if (!x) return inbox;
    return validateFiling(x, { notes, modules });
  } catch (e) { return { ...inbox, error: e.message }; }
}
