/* Forge — app logic. All data stays in this browser (localStorage). Export/Import for backups. */
(() => {
"use strict";
const C = window.FORGE;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const now = () => new Date();
const TODAY = () => ymd(now());
const fmtClock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
function isoWeek(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = t.getUTCFullYear(); return `${y}-W${pad(Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7))}`; }

/* ---------------- icons ---------------- */
const I = {
  dashboard: '<path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"/>',
  today: '<circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  arena: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>',
  diagnostic: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/><path d="M7.5 14h9"/>',
  skills: '<path d="M12 3 20 8v8l-8 5-8-5V8z"/><path d="M12 8l4 2.5v3L12 16l-4-2.5v-3z"/>',
  scorecard: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  pipeline: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/>',
  rules: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  play: '<path d="M7 5v14l11-7z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  bolt: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'
};
const icon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;
const ROUTES = [
  ["dashboard", "Dashboard"], ["today", "Today"], ["arena", "Arena"], ["diagnostic", "Diagnostic"],
  ["skills", "Skills"], ["scorecard", "Scorecard"], ["pipeline", "Pipeline"], ["rules", "Rules"]
];
const MOBILE = ["dashboard", "today", "arena", "diagnostic", "pipeline"];

/* ---------------- state ---------------- */
const KEY = "forge.v1";
const blank = () => ({ days: {}, weeks: {}, practice: {}, code: {}, mocks: [], theory: [], skills: {}, pipeline: [], mock: null, theoryRun: null, sel: "two-sum", theme: null });
let S;
try { S = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { S = blank(); }
let saveT = null;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("Couldn't save: browser storage is full or blocked."); } }, 150); };
const uid = () => Math.random().toString(36).slice(2, 10);

/* ---------------- derived ---------------- */
const dayCount = (k) => C.blocks.filter((b) => S.days[k] && S.days[k][b.k]).length;
function streak() { let n = 0, d = now(); if (dayCount(ymd(d)) < 5) d = addDays(d, -1); while (dayCount(ymd(d)) >= 5) { n++; d = addDays(d, -1); } return n; }
const patLevel = (pid) => { const p = S.practice[pid]; if (!p) return 0; if (p.timed) return 3; if (p.solved) return 2; return p.attempts ? 1 : 0; };
const lastMock = () => S.mocks[S.mocks.length - 1];
const daysLeft = () => { const t = new Date(C.start + "T00:00:00"); const d = new Date(TODAY() + "T00:00:00"); return Math.max(0, Math.round((t - d) / 864e5)); };
const theoryBest = (id) => { const xs = S.theory.filter((t) => t.part === id).map((t) => t.score); return xs.length ? Math.max(...xs) : null; };
const theoryLast = (id) => { const xs = S.theory.filter((t) => t.part === id); return xs.length ? xs[xs.length - 1].score : null; };

/* ---------------- shell ---------------- */
function nav() {
  const r = route();
  const badge = { today: `${dayCount(TODAY())}/6`, arena: `${C.problems.filter((p) => patLevel(p.id) >= 2).length}/15` };
  $("#nav").innerHTML = ROUTES.map(([k, t]) => `<a href="#${k}" ${k === r ? 'aria-current="page"' : ""}>${icon(k)}<span>${t}</span>${badge[k] ? `<span class="badge">${badge[k]}</span>` : ""}</a>`).join("");
  $("#bottombar").innerHTML = MOBILE.map((k) => `<a href="#${k}" ${k === r ? 'aria-current="page"' : ""}>${icon(k)}<span>${ROUTES.find((x) => x[0] === k)[1]}</span></a>`).join("");
  $("#sideStreak").textContent = streak();
}
const route = () => { const h = (location.hash || "#dashboard").slice(1); return ROUTES.some((r) => r[0] === h) ? h : "dashboard"; };
let cleanup = [];
function render() {
  cleanup.forEach((f) => f()); cleanup = [];
  const r = route();
  $("#pageTitle").textContent = ROUTES.find((x) => x[0] === r)[1];
  $("#pageDate").textContent = now().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  $("#topAction").innerHTML = "";
  const v = $("#view"); v.style.animation = "none"; void v.offsetWidth; v.style.animation = "";
  VIEWS[r](v);
  nav();
  math(v);
}
window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });
function math(el) { try { window.renderMathInElement && renderMathInElement(el, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], output: "mathml", throwOnError: false }); } catch (e) {} }
let toastT = null;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600); }

/* theme */
function applyTheme() { if (S.theme) document.documentElement.setAttribute("data-theme", S.theme); else document.documentElement.removeAttribute("data-theme"); $("#themeBtn").textContent = S.theme ? S.theme[0].toUpperCase() + S.theme.slice(1) : "System"; }
$("#themeBtn").onclick = () => { S.theme = S.theme === null ? "dark" : S.theme === "dark" ? "light" : null; applyTheme(); save(); };
/* export / import */
$("#exportBtn").onclick = () => {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `forge-backup-${TODAY()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("Backup downloaded.");
};
$("#importBtn").onclick = () => $("#importFile").click();
$("#importFile").onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (Array.isArray(d.pipeline) && Object.keys(d).length <= 2) { // starter file: merge pipeline only
      const have = new Set(S.pipeline.map((p) => p.company + "|" + p.role));
      d.pipeline.forEach((p) => { if (!have.has(p.company + "|" + p.role)) S.pipeline.push(Object.assign({ id: uid() }, p)); });
      toast(`Imported ${d.pipeline.length} applications.`);
    } else { S = Object.assign(blank(), d); toast("Backup restored."); }
    save(); applyTheme(); render();
  } catch (err) { toast("That file isn't a Forge backup."); }
  e.target.value = "";
};

/* ---------------- charts ---------------- */
function ring(value, total, label, sub) {
  const r = 54, c = 2 * Math.PI * r, f = total ? Math.min(1, value / total) : 0;
  return `<div class="ring"><svg viewBox="0 0 132 132"><circle cx="66" cy="66" r="${r}" fill="none" stroke="var(--panel-3)" stroke-width="10"/><circle cx="66" cy="66" r="${r}" fill="none" stroke="url(#rg)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - f)}"/><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--ember)"/></linearGradient></defs></svg><div class="c"><div><b class="num">${label}</b><span>${sub}</span></div></div></div>`;
}
function lineChart(points, { h = 200, target = 80 } = {}) {
  const W = 640, H = h, L = 34, R = 14, T = 16, B = 26;
  if (!points.length) return "";
  const x = (i) => L + (points.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (points.length - 1));
  const y = (v) => T + ((100 - v) * (H - T - B)) / 100;
  let g = "";
  [0, 25, 50, 75, 100].forEach((v) => { g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`; });
  g += `<line x1="${L}" x2="${W - R}" y1="${y(target)}" y2="${y(target)}" stroke="var(--ember)" stroke-width="1" stroke-dasharray="4 4"/><text x="${W - R}" y="${y(target) - 6}" text-anchor="end" style="fill:var(--ember)">target ${target}</text>`;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.v)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const step = Math.max(1, Math.ceil(points.length / 8));
  const labels = points.map((p, i) => (i % step === 0 || i === points.length - 1) ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${esc(p.l)}</text>` : "").join("");
  const last = points[points.length - 1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Score over time"><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".28"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>${g}<path d="${area}" fill="url(#ag)"/><path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.v)}" r="${i === points.length - 1 ? 5 : 3}" fill="var(--accent)" stroke="var(--panel)" stroke-width="2"/>`).join("")}<text x="${x(points.length - 1)}" y="${y(last.v) - 12}" text-anchor="middle" style="fill:var(--fg);font-weight:600">${last.v}</text>${labels}</svg>`;
}
function radar() {
  const n = C.tracks.length, cx = 150, cy = 140, R = 100;
  const pt = (i, v) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [cx + Math.cos(a) * R * v / 5, cy + Math.sin(a) * R * v / 5]; };
  let g = "";
  [1, 2, 3, 4, 5].forEach((lv) => { g += `<polygon points="${C.tracks.map((_, i) => pt(i, lv).join(",")).join(" ")}" fill="none" stroke="var(--line)" stroke-width="1"/>`; });
  C.tracks.forEach((t, i) => { const [x, y] = pt(i, 5); const [lx, ly] = pt(i, 6.1); g += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--line)"/><text x="${lx}" y="${ly + 4}" text-anchor="middle">${esc(t.t.split(" ")[0])}</text>`; });
  const tgt = C.tracks.map((t, i) => pt(i, t.target).join(",")).join(" ");
  const cur = C.tracks.map((t, i) => pt(i, Math.max(0.15, S.skills[t.k] || 0)).join(",")).join(" ");
  return `<svg class="chart" viewBox="0 0 300 285" width="100%" style="max-width:340px;display:block;margin:auto" role="img" aria-label="Skill levels against targets">${g}<polygon points="${tgt}" fill="none" stroke="var(--ember)" stroke-width="1.5" stroke-dasharray="4 4"/><polygon points="${cur}" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="2"/>${C.tracks.map((t, i) => { const [x, y] = pt(i, Math.max(0.15, S.skills[t.k] || 0)); return `<circle cx="${x}" cy="${y}" r="3.5" fill="var(--accent)"/>`; }).join("")}</svg>`;
}
function heatmap(weeks = 22) {
  const end = now(); const start = addDays(end, -((weeks - 1) * 7 + ((end.getDay() + 6) % 7)));
  let cells = "";
  for (let d = new Date(start); d <= addDays(end, 6 - ((end.getDay() + 6) % 7)); d = addDays(d, 1)) {
    const k = ymd(d), n = dayCount(k), fut = d > end;
    const lv = n === 0 ? 0 : n <= 1 ? 1 : n <= 3 ? 2 : n === 4 ? 3 : n === 5 ? 4 : 5;
    cells += `<i style="background:var(--heat-${fut ? 0 : lv});${fut ? "opacity:.35" : ""}" class="${k === TODAY() ? "today" : ""}" title="${k}: ${n}/6 blocks"></i>`;
  }
  return `<div class="heat">${cells}</div>`;
}

/* ---------------- views ---------------- */
const VIEWS = {};

VIEWS.dashboard = (v) => {
  const m = lastMock(), prev = S.mocks[S.mocks.length - 2];
  const solved = C.problems.filter((p) => patLevel(p.id) >= 2).length, timed = C.problems.filter((p) => patLevel(p.id) === 3).length;
  const wk = isoWeek(now()); let reach = 0; for (let i = 0; i < 7; i++) { const d = addDays(now(), -i); if (isoWeek(d) === wk && S.days[ymd(d)] && S.days[ymd(d)].reach) reach++; }
  const td = dayCount(TODAY());
  const open = C.blocks.filter((b) => !(S.days[TODAY()] && S.days[TODAY()][b.k]));
  const hour = now().getHours(); const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const nextProb = C.problems.find((p) => patLevel(p.id) < 2) || C.problems.find((p) => patLevel(p.id) < 3);
  const headline = !S.mocks.length ? "Your first move: the 55-minute coding diagnostic." : td >= 5 ? "Today is banked. Rest is part of the plan." : `${6 - td} blocks left today. Start with the hardest one.`;
  const pts = S.mocks.map((x) => ({ v: x.score, l: x.date.slice(5) }));
  const pipeNext = S.pipeline.filter((p) => p.status !== "closed" && p.next).slice(0, 3);
  v.innerHTML = `
  <section class="hero">
    <div>
      <div class="eyebrow">${hello}, Matis</div>
      <h2 style="margin-top:8px">${esc(headline)}</h2>
      <p>Measure the gap, train it every day, ship proof in public. Every number here comes from work you actually did.</p>
      <div class="row">
        ${!S.mocks.length ? `<a class="btn primary" href="#diagnostic">${icon("play")} Start diagnostic</a>` : `<a class="btn primary" href="#arena" data-go="${nextProb ? nextProb.id : ""}">${icon("play")} Train: ${esc(nextProb ? nextProb.pattern : "Arena")}</a>`}
        <a class="btn" href="#today">${icon("today")} Today's blocks</a>
      </div>
    </div>
    ${ring(daysLeft(), 116, daysLeft(), "days to 1 March")}
  </section>
  <section class="grid g-4">
    <div class="card kpi ember"><span class="eyebrow">Streak</span><b>${streak()}</b><span class="sub">days at 5/6 blocks</span></div>
    <div class="card kpi"><span class="eyebrow">Last coding mock</span><b>${m ? m.score : "—"}<span class="muted" style="font-size:15px">/100</span></b><span class="sub">${m ? (prev ? `<span class="delta" style="color:${m.score >= prev.score ? "var(--good)" : "var(--bad)"}">${m.score >= prev.score ? "▲" : "▼"} ${Math.abs(m.score - prev.score)}</span> vs previous` : `${m.elapsedMin} min · first mock`) : "not taken yet"}</span></div>
    <div class="card kpi"><span class="eyebrow">Patterns</span><b>${solved}<span class="muted" style="font-size:15px">/15</span></b><span class="sub">${timed} solved under the clock</span></div>
    <div class="card kpi"><span class="eyebrow">Outreach this week</span><b>${reach}<span class="muted" style="font-size:15px">/7</span></b><span class="sub">days with 2 messages sent</span></div>
  </section>
  <section class="grid g-main">
    <div class="card">
      <div class="card-h"><h3>Consistency</h3><div class="legend">less ${[0, 1, 2, 3, 4, 5].map((i) => `<i style="background:var(--heat-${i})"></i>`).join("")} more</div></div>
      ${heatmap()}
      <div class="row muted" style="margin-top:12px;font-size:13px"><span>Each square is one day. Color = blocks completed out of 6.</span></div>
    </div>
    <div class="card">
      <div class="card-h"><h3>Skill shape</h3><span class="row" style="gap:12px;font-size:12px"><span><span style="color:var(--accent)">●</span> now</span><span><span style="color:var(--ember)">- -</span> March target</span></span></div>
      ${radar()}
    </div>
  </section>
  <section class="grid g-main">
    <div class="card">
      <div class="card-h"><h3>Coding mock score</h3><a class="btn small" href="#diagnostic">New mock</a></div>
      ${pts.length ? lineChart(pts) : `<div class="empty">No mock yet. Take the 55-minute diagnostic: your first score becomes the baseline this line grows from.</div>`}
    </div>
    <div class="card">
      <div class="card-h"><h3>Next up</h3></div>
      <div class="next-list">
        ${open.slice(0, 3).map((b) => `<a class="next-item" href="#today" style="text-decoration:none;color:inherit"><span class="dot ember"></span><span>${esc(b.t)}</span><span class="pill">${b.min ? b.min + " min" : "tonight"}</span></a>`).join("") || `<div class="next-item"><span class="dot good"></span><span>All blocks done today</span><span class="pill good">✓</span></div>`}
        ${pipeNext.map((p) => `<a class="next-item" href="#pipeline" style="text-decoration:none;color:inherit"><span class="dot"></span><span><b>${esc(p.company)}</b> · ${esc(p.next)}</span><span class="pill acc">${esc((C.statuses.find((s) => s.k === p.status) || {}).t || "")}</span></a>`).join("")}
      </div>
    </div>
  </section>`;
  $$("[data-go]", v).forEach((a) => a.addEventListener("click", () => { if (a.dataset.go) { S.sel = a.dataset.go; save(); } }));
};

/* ---- today ---- */
let focus = null; try { focus = JSON.parse(sessionStorage.getItem("forge.focus") || "null"); } catch (e) {} // {k, dur, end|null, left}
const saveFocus = () => { try { sessionStorage.setItem("forge.focus", JSON.stringify(focus)); } catch (e) {} };
VIEWS.today = (v) => {
  const t = TODAY(), d = S.days[t] || {}, n = dayCount(t);
  if (!focus) focus = { k: "code", dur: 45 * 60000, end: null, left: 45 * 60000 };
  const fb = C.blocks.find((b) => b.k === focus.k) || C.blocks[0];
  v.innerHTML = `
  <section class="card">
    <div class="row" style="justify-content:space-between">
      <div><div class="eyebrow">Today</div><h2 style="margin-top:6px;font-size:22px">${n}/6 blocks · ${n >= 5 ? "day banked" : `${5 - n} more to bank the day`}</h2></div>
      <span class="pill ember">${streak()}-day streak</span>
    </div>
    <div class="progress" style="margin-top:14px"><i style="width:${(n / 6) * 100}%"></i></div>
  </section>
  <section class="blocks">${C.blocks.map((b) => `<button class="block ${d[b.k] ? "done" : ""}" data-k="${b.k}" aria-pressed="${!!d[b.k]}"><span class="tick">${icon("check")}</span><span class="meta">${b.min ? b.min + " min" : "evening"}</span><h3>${esc(b.t)}</h3><p>${esc(b.d)}</p></button>`).join("")}</section>
  <section class="card focus">
    <div><div class="eyebrow">Focus timer</div><div class="clock" id="fclock">${fmtClock(focus.end ? focus.end - Date.now() : focus.left)}</div></div>
    <div style="display:grid;gap:12px">
      <div class="seg" role="group" aria-label="Block">${C.blocks.filter((b) => b.min).map((b) => `<button data-fk="${b.k}" aria-pressed="${b.k === focus.k}">${esc(b.t)}</button>`).join("")}</div>
      <div class="row"><button class="btn primary" id="fgo">${focus.end ? "Pause" : "Start"} ${esc(fb.t.toLowerCase())}</button><button class="btn" id="freset">Reset</button><span class="muted" style="font-size:13px">When the timer ends, the block is ticked for you.</span></div>
    </div>
  </section>`;
  $$(".block", v).forEach((b) => b.onclick = () => { S.days[t] = Object.assign({}, S.days[t], { [b.dataset.k]: !(S.days[t] || {})[b.dataset.k] }); save(); const was = n; render(); const now5 = dayCount(t); if (was < 5 && now5 >= 5) toast("Day banked. Streak +1."); });
  $$("[data-fk]", v).forEach((b) => b.onclick = () => { if (focus.end) return toast("Pause the timer first."); const bl = C.blocks.find((x) => x.k === b.dataset.fk); focus = { k: bl.k, dur: bl.min * 60000, end: null, left: bl.min * 60000 }; saveFocus(); render(); });
  $("#fgo").onclick = () => { if (focus.end) { focus.left = focus.end - Date.now(); focus.end = null; } else { focus.end = Date.now() + focus.left; } saveFocus(); render(); };
  $("#freset").onclick = () => { focus = { k: focus.k, dur: focus.dur, end: null, left: focus.dur }; saveFocus(); render(); };
  if (focus.end) {
    const iv = setInterval(() => {
      const left = focus.end - Date.now(); const el = $("#fclock"); if (el) el.textContent = fmtClock(left);
      if (left <= 0) { clearInterval(iv); S.days[t] = Object.assign({}, S.days[t], { [focus.k]: true }); save(); toast(`${fb.t} done.`); focus = { k: focus.k, dur: focus.dur, end: null, left: focus.dur }; saveFocus(); render(); }
    }, 500);
    cleanup.push(() => clearInterval(iv));
  }
};

/* ---- runner (Pyodide in a worker) ---- */
let TESTS = null;
const testsReady = fetch("tests.json").then((r) => r.json()).then((d) => { TESTS = Object.fromEntries(d.map((p) => [p.id, p])); return TESTS; }).catch(() => null);
const Runner = {
  w: null, ready: false, pending: new Map(), seq: 0, status: "idle", onStatus: null,
  boot() {
    if (this.w) return;
    this.status = "loading"; this.onStatus && this.onStatus();
    this.w = new Worker("worker.js");
    this.w.onmessage = (e) => {
      const m = e.data;
      if (m.type === "ready") { this.ready = true; this.status = "ready"; this.onStatus && this.onStatus(); }
      else if (m.type === "fatal") { this.status = "failed"; this.onStatus && this.onStatus(); }
      else if (m.type === "result") { const p = this.pending.get(m.id); if (p) { clearTimeout(p.t); this.pending.delete(m.id); p.res(m.data); } }
    };
    this.w.onerror = () => { this.status = "failed"; this.onStatus && this.onStatus(); };
  },
  run(payload) {
    this.boot();
    return new Promise((res) => {
      const id = ++this.seq;
      const arm = () => setTimeout(() => { this.pending.delete(id); this.w.terminate(); this.w = null; this.ready = false; this.status = "idle"; res({ error: "Time limit exceeded (10 s). Check for an infinite loop or an O(n²) solution on the big test." }); }, 10000);
      const entry = { res, t: null }; this.pending.set(id, entry);
      const start = () => { entry.t = arm(); this.w.postMessage(Object.assign({ id }, payload)); };
      if (this.ready) start(); else { const wait = setInterval(() => { if (this.ready) { clearInterval(wait); start(); } else if (this.status === "failed") { clearInterval(wait); this.pending.delete(id); res({ error: "Python couldn't load. Check your connection and reload the page." }); } }, 100); }
    });
  }
};

/* ---- arena ---- */
let cm = null;
function starter(p) { return `${p.sig}\n    # 1. Restate the problem. 2. Brute force + complexity. 3. Optimise.\n    pass\n`; }
function examplesFor(p) {
  if (!TESTS || !TESTS[p.id]) return "";
  return TESTS[p.id].cases.slice(0, 2).map((c, i) => `<div class="ex">Example ${i + 1}\nInput:  ${esc(JSON.stringify(c.args).slice(1, -1))}\nOutput: ${esc(JSON.stringify(c.expected))}</div>`).join("");
}
VIEWS.arena = (v) => {
  const mock = S.mock;
  const list = mock ? C.problems.filter((p) => mock.ids.includes(p.id)) : C.problems;
  if (!list.some((p) => p.id === S.sel)) S.sel = list[0].id;
  const p = C.problems.find((x) => x.id === S.sel);
  const st = (pid) => ["", "tried", "solved", "timed"][patLevel(pid)];
  v.innerHTML = `
  ${mock ? `<div class="mockbar"><span class="pill ember">${icon("flag")} Timed mock</span><span class="clock" id="mclock">00:00</span><span class="muted" style="font-size:14px">${mock.ids.length} problems · 55 min · run tests as often as you like</span><span style="flex:1"></span><button class="btn ember" id="mfinish">Finish & score</button><button class="btn small" id="mabort">Abandon</button></div>` : ""}
  <div class="arena">
    <aside class="card plist" aria-label="Problems">
      ${list.map((x) => `<button class="pitem" data-p="${x.id}" aria-current="${x.id === p.id}"><span class="st ${st(x.id)}"></span><span style="min-width:0"><span class="nm" style="display:block">${esc(x.pattern)}</span><span class="pt">${esc(x.fn)}()</span></span><span class="lvl ${x.level}">${x.level}</span></button>`).join("")}
      ${!mock ? `<div class="faint" style="font-size:12px;padding:10px 10px 4px"><span style="color:var(--warn)">○</span> tried · <span style="color:var(--good)">●</span> solved · <span style="color:var(--ember)">●</span> solved in a mock</div>` : ""}
    </aside>
    <div style="display:grid;gap:16px;min-width:0">
      <section class="card statement">
        <div class="row"><span class="pill acc">${esc(p.pattern)}</span><span class="lvl ${p.level}">${p.level}</span>${S.practice[p.id] && S.practice[p.id].solved ? `<span class="pill good">solved</span>` : ""}</div>
        <h2 style="font-size:22px">${esc(p.fn)}</h2>
        <p>${p.text}</p>
        <div class="examples" id="examples">${examplesFor(p)}</div>
      </section>
      <section class="editor">
        <div class="editor-bar"><span class="file">solution.py</span><span style="flex:1"></span><span class="pill" id="rstatus"></span><button class="btn small" id="resetCode">Reset code</button><button class="btn primary small" id="runBtn">${icon("play")} Run tests</button></div>
        <textarea id="code"></textarea>
      </section>
      <section class="card" id="results"><div class="muted">Press <b>Run tests</b> (or Ctrl/⌘ + Enter). Your code runs in real Python against ${TESTS && TESTS[p.id] ? TESTS[p.id].cases.length : "several"} tests, including edge cases and one large input.</div></section>
    </div>
  </div>`;
  testsReady.then(() => { const ex = $("#examples"); if (ex && !ex.innerHTML) ex.innerHTML = examplesFor(p); });
  const ta = $("#code"); ta.value = S.code[p.id] || starter(p);
  cm = CodeMirror.fromTextArea(ta, { mode: "python", lineNumbers: true, indentUnit: 4, tabSize: 4, matchBrackets: true, autoCloseBrackets: true, extraKeys: { Tab: (c) => c.replaceSelection("    "), "Ctrl-Enter": () => runTests(p), "Cmd-Enter": () => runTests(p) } });
  cm.on("change", () => { S.code[p.id] = cm.getValue(); save(); });
  const rs = () => { const el = $("#rstatus"); if (!el) return; el.textContent = { idle: "Python: loads on first run", loading: "Loading Python…", ready: "Python ready", failed: "Python failed to load" }[Runner.status]; el.className = "pill " + ({ ready: "good", failed: "bad", loading: "warn" }[Runner.status] || ""); };
  Runner.onStatus = rs; rs(); Runner.boot();
  $$(".pitem", v).forEach((b) => b.onclick = () => { S.sel = b.dataset.p; save(); render(); });
  $("#runBtn").onclick = () => runTests(p);
  $("#resetCode").onclick = (e) => { if (!e.target.dataset.sure) { e.target.dataset.sure = 1; e.target.textContent = "Click again to reset"; return; } cm.setValue(starter(p)); };
  if (mock) {
    const tick = () => { const el = $("#mclock"); if (!el) return; const ms = Date.now() - mock.start; el.textContent = fmtClock(ms); el.classList.toggle("over", ms > 55 * 60000); };
    tick(); const iv = setInterval(tick, 1000); cleanup.push(() => clearInterval(iv));
    $("#mfinish").onclick = finishMock;
    $("#mabort").onclick = (e) => { if (!e.target.dataset.sure) { e.target.dataset.sure = 1; e.target.textContent = "Click again: nothing is saved"; return; } S.mock = null; save(); render(); };
  }
};
async function runTests(p) {
  const btn = $("#runBtn"), box = $("#results"); if (!btn) return;
  await testsReady; if (!TESTS) { box.innerHTML = `<div class="verdict err">Test cases couldn't load. Reload the page.</div>`; return; }
  btn.disabled = true; box.innerHTML = `<div class="muted">${Runner.ready ? "Running…" : "Loading Python (first run takes a few seconds)…"}</div>`;
  const t = TESTS[p.id];
  const r = await Runner.run({ code: cm.getValue(), fn: p.fn, cases: t.cases, cmp: t.cmp });
  btn.disabled = false;
  const pr = S.practice[p.id] = Object.assign({ attempts: 0, solved: false, timed: false }, S.practice[p.id]); pr.attempts++;
  if (r.error) { box.innerHTML = `<div class="verdict err">Error</div><pre class="out" style="margin-top:10px">${esc(r.error)}</pre>${r.stdout ? `<pre class="out" style="margin-top:8px">${esc(r.stdout)}</pre>` : ""}`; if (S.mock) S.mock.last[p.id] = { pass: 0, total: t.cases.length }; save(); nav(); return; }
  const pass = r.results.filter((x) => x.ok).length, total = r.results.length, all = pass === total;
  const ms = r.results.reduce((a, x) => a + x.ms, 0);
  if (all) { if (!pr.solved) pr.solvedAt = TODAY(); pr.solved = true; if (S.mock && Date.now() - S.mock.start <= 55 * 60000) pr.timed = true; }
  if (S.mock) S.mock.last[p.id] = { pass, total };
  save(); nav();
  $$(".pitem").forEach((b) => { const s = b.querySelector(".st"); if (s) s.className = "st " + ["", "tried", "solved", "timed"][patLevel(b.dataset.p)]; });
  box.innerHTML = `<div class="verdict ${all ? "ok" : "ko"}">${all ? icon("check") : ""} ${pass}/${total} tests passed <span class="muted" style="font-weight:400;font-size:13px;margin-left:auto">${ms.toFixed(1)} ms total</span></div>
    <div class="results" style="margin-top:10px">${r.results.map((x, i) => `<div class="res ${x.ok ? "ok" : "ko"}"><span class="ic">${x.ok ? "✓" : "✗"}</span><span class="num muted">Test ${i + 1}</span><span class="io">${x.ok ? `${esc(x.input)}` : `in: ${esc(x.input)}<br>${x.error ? `<span style="color:var(--bad)">${esc(x.error)}</span>` : `got: ${esc(x.got)}`}<br>expected: ${esc(x.expected)}`}</span><span class="num faint" style="font-size:12px">${x.ms} ms</span></div>`).join("")}</div>
    ${r.stdout ? `<div class="eyebrow" style="margin:12px 0 6px">print output</div><pre class="out">${esc(r.stdout)}</pre>` : ""}
    ${all && !S.mock ? `<p class="muted" style="margin-top:12px;font-size:14px">Solved. Now explain your solution aloud in English in under 2 minutes, with its time and space complexity.</p>` : ""}`;
}
function startMock() {
  const pick = (lvl) => { const pool = C.problems.filter((p) => p.level === lvl); const fresh = pool.filter((p) => patLevel(p.id) < 3); const src = fresh.length ? fresh : pool; return src.sort(() => Math.random() - 0.5); };
  const easy = pick("Easy")[0], meds = pick("Medium").slice(0, 2);
  const ids = S.mocks.length ? [easy.id, meds[0].id, meds[1].id] : ["two-sum", "longest-unique", "merge-intervals"];
  S.mock = { ids, start: Date.now(), last: {} }; S.sel = ids[0]; save(); location.hash = "#arena"; render();
}
function finishMock() {
  const m = S.mock; const el = Math.round((Date.now() - m.start) / 60000);
  const per = m.ids.map((id) => ({ id, pass: (m.last[id] || {}).pass || 0, total: (m.last[id] || {}).total || (TESTS && TESTS[id] ? TESTS[id].cases.length : 1) }));
  let score = Math.round((per.reduce((a, x) => a + x.pass / x.total, 0) / per.length) * 100);
  if (el > 55) score = Math.max(0, score - Math.min(20, el - 55)); // 1 point per minute over, max 20
  S.mocks.push({ date: TODAY(), ids: m.ids, per, score, elapsedMin: el });
  S.mock = null; save();
  toast(`Mock scored ${score}/100.`); location.hash = "#diagnostic"; render();
}

/* ---- diagnostic ---- */
let diagPart = "coding"; try { diagPart = sessionStorage.getItem("forge.part") || "coding"; } catch (e) {}
VIEWS.diagnostic = (v) => {
  const parts = [{ id: "coding", n: "Part 1", h: "Coding under time", min: 55 }].concat(C.theory.map((t) => ({ id: t.id, n: t.n, h: t.h, min: t.min })));
  const best = (id) => id === "coding" ? (S.mocks.length ? Math.max(...S.mocks.map((m) => m.score)) : null) : theoryBest(id);
  const last = (id) => id === "coding" ? (lastMock() ? lastMock().score : null) : theoryLast(id);
  v.innerHTML = `
  <section><p class="muted" style="max-width:70ch">Four timed parts. No internet and no AI while the clock runs. Submit even when unfinished: the unfinished part tells you exactly where the gap is. Retake each part every two weeks.</p></section>
  <section class="parts">${parts.map((p) => { const l = last(p.id), b = best(p.id); return `<button class="part" data-part="${p.id}" aria-pressed="${p.id === diagPart}"><span class="eyebrow">${p.n} · ${p.min} min</span><b style="font-size:15px">${esc(p.h)}</b><span class="score" style="color:${l == null ? "var(--faint)" : l >= 80 ? "var(--good)" : l >= 55 ? "var(--warn)" : "var(--bad)"}">${l == null ? "—" : l}</span><span class="muted" style="font-size:12px">${b == null ? "not taken" : `best ${b}`}</span></button>`; }).join("")}</section>
  <section class="card" id="diagBody"></section>
  <section class="card"><div class="card-h"><h3>History</h3></div><div class="table-wrap">${historyTable()}</div></section>`;
  $$(".part", v).forEach((b) => b.onclick = () => { if (S.theoryRun && !S.theoryRun.done && S.theoryRun.part !== b.dataset.part) return toast("Finish or abandon the running part first."); diagPart = b.dataset.part; try { sessionStorage.setItem("forge.part", diagPart); } catch (e) {} render(); });
  const body = $("#diagBody");
  if (diagPart === "coding") {
    body.innerHTML = `<div class="row" style="justify-content:space-between;align-items:flex-start"><div style="max-width:62ch"><div class="eyebrow">Part 1 · 55 minutes</div><h2 style="font-size:22px;margin-top:6px">Timed coding mock</h2><p class="muted" style="margin-top:8px">${S.mocks.length ? "One easy and two medium problems, chosen from patterns you haven't yet solved under time." : "Your baseline: Two Sum (easy), Longest substring without repeats and Merge intervals (medium)."} Real Python, hidden tests, one clock. Score = share of tests passed, minus 1 point per minute over 55.</p></div>${S.mock ? `<a class="btn ember" href="#arena">Resume running mock</a>` : `<button class="btn primary" id="mstart">${icon("play")} Start 55:00</button>`}</div>
    ${S.mocks.length ? `<div style="margin-top:18px">${lineChart(S.mocks.map((m) => ({ v: m.score, l: m.date.slice(5) })), { h: 180 })}</div>` : ""}`;
    const b = $("#mstart"); if (b) b.onclick = startMock;
    return;
  }
  const part = C.theory.find((t) => t.id === diagPart);
  const run = S.theoryRun && S.theoryRun.part === part.id ? S.theoryRun : null;
  if (!run) {
    body.innerHTML = `<div class="row" style="justify-content:space-between;align-items:flex-start"><div style="max-width:62ch"><div class="eyebrow">${part.n} · ${part.min} minutes</div><h2 style="font-size:22px;margin-top:6px">${esc(part.h)}</h2><p class="muted" style="margin-top:8px">${part.qs.length} questions. Answer in English, in your own words, with formulas where useful. After you submit, compare with the key points and tick only what you really covered.</p></div><button class="btn primary" id="tstart">${icon("play")} Start ${part.min}:00</button></div>`;
    $("#tstart").onclick = () => { S.theoryRun = { part: part.id, start: Date.now(), answers: {}, ticks: {}, done: false }; save(); render(); };
    return;
  }
  body.innerHTML = `
    <div class="row" style="justify-content:space-between"><div><div class="eyebrow">${part.n} · ${run.done ? "self-grading" : "running"}</div><h2 style="font-size:22px;margin-top:6px">${esc(part.h)}</h2></div>
      <div class="row">${run.done ? `<span class="pill">${run.elapsedMin} min used</span>` : `<span class="clock num" id="tclock" style="font:700 26px var(--display)">00:00</span>`}
      ${run.done ? `<button class="btn" id="tcopy">Copy for Claude</button><button class="btn primary" id="tsave">Save score</button>` : `<button class="btn primary" id="tsubmit">Submit</button>`}<button class="btn small" id="tabort">${run.done ? "Discard" : "Abandon"}</button></div></div>
    <div style="margin-top:12px">${part.qs.map((q, i) => `<div class="q"><div class="row" style="justify-content:space-between"><b>Question ${i + 1}</b></div><div class="qt math">${q.q}</div>
      <textarea class="input" data-q="${i}" ${run.done ? "readonly" : ""} placeholder="Your answer…">${esc(run.answers[i] || "")}</textarea>
      ${run.done ? `<div class="keys"><span class="eyebrow">Key points · tick what your answer really covers</span>${q.keys.map((k, j) => `<label><input type="checkbox" data-tk="${i}-${j}" ${run.ticks[i + "-" + j] ? "checked" : ""}><span class="math">${k}</span></label>`).join("")}</div>` : ""}</div>`).join("")}</div>`;
  $$("textarea[data-q]", body).forEach((t) => t.oninput = () => { run.answers[t.dataset.q] = t.value; save(); });
  $$("[data-tk]", body).forEach((c) => c.onchange = () => { run.ticks[c.dataset.tk] = c.checked; save(); });
  $("#tabort").onclick = (e) => { if (!e.target.dataset.sure) { e.target.dataset.sure = 1; e.target.textContent = "Click again to confirm"; return; } S.theoryRun = null; save(); render(); };
  if (!run.done) {
    const tick = () => { const el = $("#tclock"); if (!el) return; const ms = Date.now() - run.start; el.textContent = fmtClock(ms); el.style.color = ms > part.min * 60000 ? "var(--bad)" : ""; };
    tick(); const iv = setInterval(tick, 1000); cleanup.push(() => clearInterval(iv));
    $("#tsubmit").onclick = () => { run.done = true; run.elapsedMin = Math.round((Date.now() - run.start) / 60000); save(); render(); };
  } else {
    $("#tsave").onclick = () => {
      const total = part.qs.reduce((a, q) => a + q.keys.length, 0); const got = Object.values(run.ticks).filter(Boolean).length;
      const score = Math.round((got / total) * 100);
      S.theory.push({ part: part.id, date: TODAY(), score, elapsedMin: run.elapsedMin, answers: run.answers });
      S.theoryRun = null; save(); toast(`${part.n} scored ${score}/100.`); render();
    };
    $("#tcopy").onclick = async () => {
      const txt = `Grade my Forge diagnostic — ${part.n}: ${part.h} (${run.elapsedMin} min of ${part.min}).\n\n` + part.qs.map((q, i) => `Q${i + 1}. ${q.q.replace(/<[^>]+>/g, "")}\nMy answer: ${run.answers[i] || "(empty)"}`).join("\n\n");
      try { await navigator.clipboard.writeText(txt); toast("Copied. Paste it into your chat with Claude."); } catch (e) { toast("Copy failed. Select the answers manually."); }
    };
  }
};
function historyTable() {
  const rows = S.mocks.map((m) => ({ d: m.date, p: "Part 1 · Coding", s: m.score, t: m.elapsedMin, x: m.per.map((x) => `${(C.problems.find((p) => p.id === x.id) || {}).pattern}: ${x.pass}/${x.total}`).join(" · ") }))
    .concat(S.theory.map((t) => { const p = C.theory.find((x) => x.id === t.part); return { d: t.date, p: `${p.n} · ${p.h}`, s: t.score, t: t.elapsedMin, x: "" }; }))
    .sort((a, b) => b.d.localeCompare(a.d));
  if (!rows.length) return `<div class="empty">Nothing yet. Your first result appears here.</div>`;
  return `<table><thead><tr><th>Date</th><th>Part</th><th>Time</th><th>Score</th><th>Detail</th></tr></thead><tbody>${rows.map((r) => `<tr><td class="num">${r.d}</td><td>${esc(r.p)}</td><td class="num">${r.t} min</td><td><span class="pill ${r.s >= 80 ? "good" : r.s >= 55 ? "warn" : "bad"}">${r.s}</span></td><td class="muted" style="font-size:13px">${esc(r.x)}</td></tr>`).join("")}</tbody></table>`;
}

/* ---- skills ---- */
VIEWS.skills = (v) => {
  v.innerHTML = `
  <section class="grid g-main">
    <div class="card"><div class="card-h"><h3>Tracks</h3><span class="muted" style="font-size:13px">Raise a level only when the proof exists. Orange ring = March target.</span></div>
      <div class="tracks">${C.tracks.map((t) => { const lv = S.skills[t.k] || 0; return `<div class="track"><div style="min-width:0"><div class="row"><h4>${esc(t.t)}</h4><span class="pill ${lv >= t.target ? "good" : ""}">${esc(C.levels[lv])}</span></div><p>Metric: ${esc(t.metric)}</p><p>Proof: ${esc(t.proof)}</p></div><div class="steps">${[1, 2, 3, 4, 5].map((i) => `<button data-t="${t.k}" data-l="${i}" class="${i <= lv ? "on" : ""} ${i === t.target ? "tgt" : ""}" title="${esc(C.levels[i])}" aria-label="${esc(t.t)}: ${esc(C.levels[i])}">${i}</button>`).join("")}</div></div>`; }).join("")}</div>
    </div>
    <div class="card"><div class="card-h"><h3>Shape</h3></div>${radar()}
      <div class="muted" style="font-size:13px;margin-top:8px">${C.levels.map((l, i) => `${i} ${l}`).join(" · ")}</div></div>
  </section>
  <section class="card"><div class="card-h"><h3>Coding patterns</h3><span class="muted" style="font-size:13px">Measured by the Arena: tried · solved · solved in a timed mock</span></div>
    <div class="patgrid">${C.problems.map((p) => { const l = patLevel(p.id); return `<a class="pat" href="#arena" data-go="${p.id}"><span>${esc(p.pattern)}</span><span class="pips ${l === 3 ? "full" : ""}">${[1, 2, 3].map((i) => `<i class="${i <= l ? "on" : ""}"></i>`).join("")}</span></a>`; }).join("")}</div>
  </section>`;
  $$("[data-t]", v).forEach((b) => b.onclick = () => { const k = b.dataset.t, l = +b.dataset.l; S.skills[k] = S.skills[k] === l ? l - 1 : l; save(); render(); });
  $$("[data-go]", v).forEach((a) => a.addEventListener("click", () => { S.sel = a.dataset.go; save(); }));
};

/* ---- scorecard ---- */
VIEWS.scorecard = (v) => {
  const wk = isoWeek(now()); const w = S.weeks[wk] || {};
  const rows = Object.values(S.weeks).sort((a, b) => b.week.localeCompare(a.week));
  v.innerHTML = `
  <section class="card"><div class="card-h"><h3>Log week ${wk}</h3><span class="muted" style="font-size:13px">Every Sunday, after the weekly mock.</span></div>
    <form id="wf" class="grid g-3" style="grid-template-columns:repeat(6,minmax(0,1fr))">
      <label class="field"><span>Week</span><input class="input" id="w_week" value="${esc(wk)}"></label>
      <label class="field"><span>Problems solved</span><input class="input" type="number" min="0" id="w_solved" value="${w.solved ?? ""}"></label>
      <label class="field"><span>Deep-work hours</span><input class="input" type="number" min="0" step="0.5" id="w_hours" value="${w.hours ?? ""}"></label>
      <label class="field"><span>Messages sent</span><input class="input" type="number" min="0" id="w_sent" value="${w.sent ?? ""}"></label>
      <label class="field"><span>Replies</span><input class="input" type="number" min="0" id="w_rep" value="${w.replies ?? ""}"></label>
      <label class="field"><span>Interviews</span><input class="input" type="number" min="0" id="w_int" value="${w.interviews ?? ""}"></label>
      <label class="field" style="grid-column:1/-1"><span>Shipped this week (links, commits, results)</span><input class="input" id="w_ship" value="${esc(w.shipped || "")}" placeholder="e.g. ROUILLE v0.3 with conv layer + benchmark on STM32"></label>
      <div class="row" style="grid-column:1/-1"><button class="btn primary" type="submit">Save week</button></div>
    </form>
  </section>
  <section class="grid g-2">
    <div class="card"><div class="card-h"><h3>Messages → replies</h3></div>${rows.length ? funnel(rows) : `<div class="empty">Log your first week to see the funnel.</div>`}</div>
    <div class="card"><div class="card-h"><h3>Deep-work hours</h3></div>${rows.length ? bars(rows.slice().reverse()) : `<div class="empty">Hours appear here week by week.</div>`}</div>
  </section>
  <section class="card"><div class="table-wrap">${rows.length ? `<table><thead><tr><th>Week</th><th>Solved</th><th>Hours</th><th>Sent</th><th>Replies</th><th>Interviews</th><th>Shipped</th></tr></thead><tbody>${rows.map((r) => `<tr><td class="num">${esc(r.week)}</td><td class="num">${r.solved ?? "—"}</td><td class="num">${r.hours ?? "—"}</td><td class="num">${r.sent ?? "—"}</td><td class="num">${r.replies ?? "—"}</td><td class="num">${r.interviews ?? "—"}</td><td>${esc(r.shipped || "")}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">No weeks logged yet.</div>`}</div></section>`;
  $("#wf").onsubmit = (e) => {
    e.preventDefault(); const n = (id) => { const x = $(id).value; return x === "" ? null : Number(x); };
    const week = $("#w_week").value.trim(); if (!/^\d{4}-W\d{2}$/.test(week)) return toast(`Week must look like ${wk}.`);
    S.weeks[week] = { week, solved: n("#w_solved"), hours: n("#w_hours"), sent: n("#w_sent"), replies: n("#w_rep"), interviews: n("#w_int"), shipped: $("#w_ship").value.trim() };
    save(); toast(`Week ${week} saved.`); render();
  };
};
function funnel(rows) {
  const s = rows.reduce((a, r) => ({ sent: a.sent + (r.sent || 0), rep: a.rep + (r.replies || 0), int: a.int + (r.interviews || 0) }), { sent: 0, rep: 0, int: 0 });
  const mx = Math.max(1, s.sent);
  const bar = (l, v, c) => `<div style="display:grid;grid-template-columns:90px 1fr 44px;gap:10px;align-items:center;margin-bottom:10px"><span class="muted" style="font-size:13px">${l}</span><div class="progress" style="height:14px"><i style="width:${(v / mx) * 100}%;background:${c}"></i></div><b class="num" style="text-align:right">${v}</b></div>`;
  return bar("Sent", s.sent, "var(--accent)") + bar("Replies", s.rep, "var(--ember)") + bar("Interviews", s.int, "var(--good)") + `<div class="muted" style="font-size:13px">Reply rate ${s.sent ? Math.round((s.rep / s.sent) * 100) : 0}% · target 20%</div>`;
}
function bars(rows) {
  const W = 600, H = 170, B = 24, mx = Math.max(10, ...rows.map((r) => r.hours || 0)); const bw = Math.min(46, (W - 20) / rows.length - 8);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Hours per week">${rows.map((r, i) => { const h = ((r.hours || 0) / mx) * (H - B - 18); const x = 10 + i * ((W - 20) / rows.length) + 4; return `<rect x="${x}" y="${H - B - h}" width="${bw}" height="${Math.max(1, h)}" rx="5" fill="var(--accent)"/><text x="${x + bw / 2}" y="${H - B - h - 5}" text-anchor="middle" style="fill:var(--fg)">${r.hours ?? 0}</text><text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(r.week.slice(5))}</text>`; }).join("")}</svg>`;
}

/* ---- pipeline ---- */
VIEWS.pipeline = (v) => {
  v.innerHTML = `
  <section class="board" id="board">${C.statuses.map((s) => { const items = S.pipeline.filter((p) => p.status === s.k); return `<div class="col" data-col="${s.k}"><div class="col-h"><b>${s.t}</b><span class="pill">${items.length}</span></div>${items.map((p) => `<article class="kcard" draggable="true" data-id="${p.id}"><b>${esc(p.company)}</b><span class="r">${esc(p.role)}</span>${p.next ? `<span class="n">${esc(p.next)}</span>` : ""}<div class="row" style="justify-content:space-between"><select data-mv="${p.id}" aria-label="Move ${esc(p.company)}">${C.statuses.map((x) => `<option value="${x.k}" ${x.k === p.status ? "selected" : ""}>${x.t}</option>`).join("")}</select><button class="x" data-del="${p.id}">Delete</button></div></article>`).join("") || `<div class="faint" style="font-size:12px;padding:8px 6px">Drop here</div>`}</div>`; }).join("")}</section>
  <section class="card"><div class="card-h"><h3>Add an application</h3>${!S.pipeline.length ? `<span class="muted" style="font-size:13px">Have a starter file? Use Import in the sidebar.</span>` : ""}</div>
    <form id="pf" class="grid" style="grid-template-columns:1fr 1.4fr 1fr 1.4fr auto;align-items:end">
      <label class="field"><span>Company</span><input class="input" id="p_co" required></label>
      <label class="field"><span>Role · place</span><input class="input" id="p_role"></label>
      <label class="field"><span>Status</span><select class="input" id="p_st">${C.statuses.map((s) => `<option value="${s.k}">${s.t}</option>`).join("")}</select></label>
      <label class="field"><span>Next step</span><input class="input" id="p_next"></label>
      <button class="btn primary" type="submit">Add</button>
    </form></section>`;
  const move = (id, st) => { const p = S.pipeline.find((x) => x.id === id); if (p && p.status !== st) { p.status = st; save(); render(); if (st === "offer") toast("An offer. Well earned."); } };
  $$(".kcard", v).forEach((k) => { k.ondragstart = (e) => { e.dataTransfer.setData("text/plain", k.dataset.id); k.classList.add("dragging"); }; k.ondragend = () => k.classList.remove("dragging"); });
  $$(".col", v).forEach((c) => { c.ondragover = (e) => { e.preventDefault(); c.classList.add("drop"); }; c.ondragleave = () => c.classList.remove("drop"); c.ondrop = (e) => { e.preventDefault(); c.classList.remove("drop"); move(e.dataTransfer.getData("text/plain"), c.dataset.col); }; });
  $$("[data-mv]", v).forEach((s) => s.onchange = () => move(s.dataset.mv, s.value));
  $$("[data-del]", v).forEach((b) => b.onclick = () => { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "Confirm"; return; } S.pipeline = S.pipeline.filter((p) => p.id !== b.dataset.del); save(); render(); });
  $("#pf").onsubmit = (e) => { e.preventDefault(); const co = $("#p_co").value.trim(); if (!co) return; S.pipeline.push({ id: uid(), company: co, role: $("#p_role").value.trim(), status: $("#p_st").value, next: $("#p_next").value.trim(), added: TODAY() }); save(); render(); };
};

/* ---- rules ---- */
VIEWS.rules = (v) => {
  v.innerHTML = `<section><p class="muted" style="max-width:66ch">How real knowledge is built. Read this when you panic before an interview.</p></section>
  <section class="rules">${C.rules.map(([h, p], i) => `<div class="card rule"><span class="k">${i + 1}</span><div><h3>${esc(h)}</h3><p>${esc(p)}</p></div></div>`).join("")}</section>`;
};

/* ---------------- boot ---------------- */
applyTheme();
render();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
document.addEventListener("visibilitychange", () => { if (!document.hidden && ["dashboard", "today"].includes(route())) render(); });
})();
