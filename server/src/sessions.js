// Tutor sessions: what Matis asked the tutor while coding, kept per exercise and per day, so the planner, the
// assistant and the tutor know where he gets stuck. Never used as Proof material.
import { dayIn } from "./fsrs.js";

const cut = (s, n) => String(s ?? "").slice(0, n);
const day = (env, now) => dayIn(now, env.TZ || "Europe/Paris");
const parse = (s) => { try { const x = JSON.parse(s); return Array.isArray(x) ? x : []; } catch (e) { return []; } };

/** Save today's conversation on one exercise (the client sends today's messages; the reply is appended). */
export async function remember(db, env, { id, kind, title, code, run, messages, reply }, now = new Date()) {
  const d = day(env, now);
  const msgs = [...messages, { role: "tutor", text: reply }].slice(-30).map((m) => ({ role: m.role === "me" ? "me" : "tutor", text: cut(m.text, 1500) }));
  await db.prepare(`INSERT INTO tutor_sessions (id, exercise, kind, title, day, messages, code, run, asks, updated) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
    ON CONFLICT(id) DO UPDATE SET title = excluded.title, messages = excluded.messages, code = excluded.code, run = excluded.run, asks = excluded.asks, updated = excluded.updated`)
    .bind(`${id}:${d}`, id, kind === "drill" ? "drill" : "problem", cut(title, 120), d, JSON.stringify(msgs), cut(code, 4000), cut(run, 1500), msgs.filter((m) => m.role === "me").length, now.toISOString()).run();
}

/** Earlier days on the same exercise, as text for the tutor (so it does not repeat the same hint). */
export async function earlier(db, env, id, now = new Date()) {
  const rows = (await db.prepare("SELECT day, messages FROM tutor_sessions WHERE exercise = ? AND day < ? ORDER BY day DESC LIMIT 2").bind(id, day(env, now)).all()).results;
  return rows.map((r) => `${r.day}:\n${parse(r.messages).map((m) => `${m.role === "me" ? "Matis" : "Tutor"}: ${cut(m.text, 400)}`).join("\n")}`).join("\n\n");
}

/** Sessions since `since` (YYYY-MM-DD), one line each: for the planner and the assistant. */
export async function recent(db, since, limit = 8) {
  const rows = (await db.prepare("SELECT exercise, title, day, asks, messages, run FROM tutor_sessions WHERE day >= ? ORDER BY updated DESC LIMIT ?").bind(since, limit).all()).results;
  return rows.map((r) => {
    const mine = parse(r.messages).filter((m) => m.role === "me"), fails = String(r.run || "").split("\n").filter((l) => /FAIL|Error|✗/i.test(l)).slice(0, 2).map((l) => cut(l.trim(), 80));
    return `- ${r.title || r.exercise} (${r.day}): asked the tutor ${r.asks}×${mine.length ? `; last: "${cut(mine[mine.length - 1].text, 160).replace(/\s+/g, " ")}"` : ""}${fails.length ? `; failing: ${fails.join(" / ")}` : ""}`;
  });
}
