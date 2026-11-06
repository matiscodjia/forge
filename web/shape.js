/* Forge skill shape: one value per track, from observed evidence only (no self-rating).
   value = weighted mean of the evidence levels (0–5); confidence c = 1 − e^(−W/4) from the total weight W sets the
   uncertainty. Each piece of evidence has a weight that decays with age (90-day e-folding). A track with no evidence
   is "not measured", never zero and never guessed.
   Pasted Proof answers never reach this file: the server's mastery excludes them. Pure: no DOM, no storage. */
(() => {
const DECAY = 90, K = 4;
const DAY = 864e5;
const age = (today, d) => d ? Math.max(0, (Date.parse(today) - Date.parse(d)) / DAY) : 0;
const fade = (today, d) => Math.exp(-age(today, d) / DECAY);
const AREA_TRACK = { math: "math", dl: "ml", llm: "ml", sys: "sys", res: "ship", code: "coding", eng: "eng" };

/** Every piece of evidence in the state, as { track, v (0–5), w, kind, label }. */
function evidence({ S, C, drills = [], mastery = null, commits = {}, today, isDone = null }) {
  const out = [], add = (track, v, w, kind, label) => { if (w > 0.001) out.push({ track, v: Math.max(0, Math.min(5, v)), w, kind, label }); };
  // Proof: honest reviews only. mastery is already "score × chance you still remember it".
  (mastery?.tracks || []).forEach((t) => { if (t.mastery != null && t.proven) add(t.key, (t.mastery / 100) * 5, t.proven, "proof", `${t.proven} proof review${t.proven === 1 ? "" : "s"}`); });
  // Arena drills: solved alone is worth more than solved with hints; tried counts a little.
  drills.forEach((d) => {
    const st = S.drills?.[d.id]; if (!st || !st.attempts) return;
    const f = fade(today, st.solvedAt || st.last);
    if (st.solved) add(d.track, 1.5 + 0.75 * d.lvl - 0.4 * Math.min(3, st.hints || 0), f, "drill", `${d.title}${st.hints ? ` · ${st.hints} hint${st.hints === 1 ? "" : "s"}` : ""}`);
    else add(d.track, 1, 0.4 * f, "drill", `${d.title} · tried`);
  });
  // Interview patterns.
  (C.problems || []).forEach((p) => {
    const st = S.practice?.[p.id]; if (!st || !st.attempts) return;
    const f = fade(today, st.solvedAt);
    if (st.timed) add("coding", 4.2, f, "pattern", `${p.pattern} · under time`);
    else if (st.solved) add("coding", 3, 0.8 * f, "pattern", p.pattern);
    else add("coding", 1.5, 0.4 * f, "pattern", `${p.pattern} · tried`);
  });
  (S.mocks || []).forEach((m) => add("coding", (m.score / 100) * 5, 2 * fade(today, m.date), "mock", `mock ${m.score}/100`));
  (S.theory || []).forEach((t) => add(t.part, (t.score / 100) * 5, 2 * fade(today, t.date), "diagnostic", `diagnostic ${t.score}/100`));
  // Path modules: done with checks is solid; a public proof link is shipping evidence too.
  (C.modules || []).forEach((m) => {
    const p = S.path?.[m.id] || {}; if (!(isDone ? isDone(m.id) : p.status === "done")) return;
    const stage = (C.stages || []).find((s) => s.k === m.stage), tr = AREA_TRACK[stage?.area] || "ml", f = fade(today, p.finished);
    add(tr, 3.5, f, "module", m.t);
    if (p.proof && /^https?:/.test(p.proof)) add("ship", 3, 0.6 * f, "module", `${m.t} · proof link`);
  });
  // Path exit checks proven through Proof (answer ≥ 70), on top of the reviews counted above.
  Object.entries(mastery?.checks || {}).forEach(([key, c]) => {
    if (!c.proven) return; const m = (C.modules || []).find((x) => x.id === key.split("#")[0]); if (!m) return;
    const stage = (C.stages || []).find((s) => s.k === m.stage); add(AREA_TRACK[stage?.area] || "ml", 3.5, 1, "check", `${m.t} · check ${Number(key.split("#")[1]) + 1}`);
  });
  // Shipping: days with a commit, per week, over 12 weeks (5 days a week ≈ level 5).
  const wk = {}; Object.entries(commits || {}).forEach(([d, n]) => { const w = Math.floor(age(today, d) / 7); if (n > 0 && w < 12) wk[w] = (wk[w] || 0) + 1; });
  Object.entries(wk).forEach(([w, days]) => add("ship", days, 0.5 * Math.exp(-(w * 7) / DECAY), "commits", `${days} day${days === 1 ? "" : "s"} with commits, ${w == 0 ? "this week" : `${w} wk ago`}`));
  return out;
}
function isoMonday(wk) { const m = /^(\d{4})-W(\d{2})$/.exec(wk || ""); if (!m) return null; const y = +m[1], n = +m[2]; const j4 = new Date(Date.UTC(y, 0, 4)); const d = new Date(j4); d.setUTCDate(j4.getUTCDate() - ((j4.getUTCDay() + 6) % 7) + (n - 1) * 7); return d.toISOString().slice(0, 10); }

/** One row per track: est (0–5, or null when not measured), conf (0–1), unc (± levels), target, n, top evidence. */
function compute(tracks, ev) {
  return tracks.map((t) => {
    const mine = ev.filter((e) => e.track === t.k), W = mine.reduce((a, e) => a + e.w, 0);
    const est = W ? mine.reduce((a, e) => a + e.w * e.v, 0) / W : null;
    const conf = 1 - Math.exp(-W / K);
    const spread = W ? Math.sqrt(mine.reduce((a, e) => a + e.w * (e.v - est) ** 2, 0) / W) : 0;
    const unc = W ? Math.min(2.5, (1 - conf) * 2.5 + spread / Math.sqrt(1 + W)) : null;
    return { k: t.k, t: t.t, target: t.target, est, measured: est, conf, unc, W, n: mine.length,
      top: mine.slice().sort((a, b) => b.w - a.w).slice(0, 3).map((e) => e.label) };
  });
}

/** SVG radar: ink polygon = estimate; hollow point at the centre = not measured yet (its sides dashed);
    short ticks = target. No orange (that is for heat). */
function svg(rows, { size = 360, labels = true } = {}) {
  const n = rows.length, cx = size / 2, cy = size / 2 + 4, R = size * 0.34;
  const pt = (i, v) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [cx + Math.cos(a) * R * v / 5, cy + Math.sin(a) * R * v / 5]; };
  const f = (p) => p.map((x) => x.toFixed(1)).join(",");
  let g = "";
  [1, 2, 3, 4, 5].forEach((lv) => { g += `<polygon points="${rows.map((_, i) => f(pt(i, lv))).join(" ")}" fill="none" stroke="var(--line)" stroke-width="1"/>`; });
  rows.forEach((r, i) => {
    g += `<line x1="${cx}" y1="${cy}" x2="${f(pt(i, 5)).split(",")[0]}" y2="${f(pt(i, 5)).split(",")[1]}" stroke="var(--line)"/>`;
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n, [tx, ty] = pt(i, r.target), dx = Math.cos(a + Math.PI / 2) * 5, dy = Math.sin(a + Math.PI / 2) * 5;
    g += `<line x1="${(tx - dx).toFixed(1)}" y1="${(ty - dy).toFixed(1)}" x2="${(tx + dx).toFixed(1)}" y2="${(ty + dy).toFixed(1)}" stroke="var(--mute)" stroke-width="1.5"/>`;
    if (labels) { const [lx, ly] = pt(i, 6.2); g += `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="${Math.abs(lx - cx) < 8 ? "middle" : lx > cx ? "start" : "end"}">${r.t.split(" ")[0]}</text>`; }
  });
  const P = rows.map((r, i) => pt(i, r.est == null ? 0.12 : Math.max(0.12, r.est)));
  g += `<polygon points="${P.map(f).join(" ")}" fill="color-mix(in srgb, var(--fg) 7%, transparent)" stroke="none"/>`;
  rows.forEach((r, i) => { const j = (i + 1) % n, solid = r.measured != null && rows[j].measured != null; g += `<line x1="${P[i][0].toFixed(1)}" y1="${P[i][1].toFixed(1)}" x2="${P[j][0].toFixed(1)}" y2="${P[j][1].toFixed(1)}" stroke="var(--fg)" stroke-width="${solid ? 1.75 : 1.25}" ${solid ? "" : 'stroke-dasharray="4 4"'}/>`; });
  rows.forEach((r, i) => { const tip = `${r.t}\n${r.measured == null ? "not measured yet" : `${r.est.toFixed(1)} ± ${r.unc.toFixed(1)} · ${r.n} piece${r.n === 1 ? "" : "s"} of evidence`}`; g += `<circle cx="${P[i][0].toFixed(1)}" cy="${P[i][1].toFixed(1)}" r="4" fill="${r.measured == null ? "var(--bg)" : "var(--fg)"}" stroke="var(--fg)" stroke-width="1.5"/><circle cx="${P[i][0].toFixed(1)}" cy="${P[i][1].toFixed(1)}" r="12" fill="transparent" data-tip="${tip.replace(/"/g, "&quot;")}"/>`; });
  return `<svg class="chart shape" viewBox="${-60} 0 ${size + 120} ${size + 8}" width="100%" role="img" aria-label="Skill shape: measured level per track and target">${g}</svg>`;
}

globalThis.ForgeShape = { evidence, compute, svg, isoMonday, DECAY, K };
})();
