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
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  path: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 18h5a3.5 3.5 0 0 0 0-7h-2a3.5 3.5 0 0 1 0-7h5"/>',
  library: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10v16H5.5A1.5 1.5 0 0 1 4 18.5zM10 4h4v16h-4zM14.5 4.6l3.9-1 2.9 15.6-3.9.8z"/>',
  review: '<rect x="3" y="7" width="14" height="13" rx="2"/><path d="M7 4h12a2 2 0 0 1 2 2v11"/><path d="m7.5 13.5 2 2 3.5-4"/>',
  log: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2h5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  proof: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z"/><path d="m8.8 12 2.3 2.3 4.2-4.6"/>',
  sources: '<ellipse cx="12" cy="6" rx="7" ry="2.8"/><path d="M5 6v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6M5 12v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-6"/>',
  context: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'
};
const icon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;
const ROUTES = [
  ["dashboard", "Home", ""], ["today", "Today", ""],
  ["path", "Path", "Learn"], ["library", "Library", "Learn"], ["review", "Review", "Learn"], ["proof", "Proof", "Learn"],
  ["arena", "Arena", "Practice"], ["diagnostic", "Diagnostic", "Practice"],
  ["log", "Log", "Track"], ["skills", "Skills", "Track"], ["scorecard", "Scorecard", "Track"], ["pipeline", "Pipeline", "Track"], ["rules", "Rules", "Track"],
  ["sources", "Sources", "Brain"], ["context", "Context", "Brain"]
];
const MOBILE = ["dashboard", "today", "path", "review"];
const NB = () => C.blocks.length; /* blocks per day */
const BANK = 5;                  /* blocks needed to bank a day */

/* ---------------- state ---------------- */
const KEY = "forge.v1";
const blank = () => ({ v: 2, days: {}, weeks: {}, practice: {}, code: {}, mocks: [], theory: [], skills: {}, pipeline: [], mock: null, theoryRun: null, sel: "two-sum", theme: null,
  path: {}, notes: [], srs: {}, revDays: {}, log: [], lastExport: null });
const hydrate = (d) => { const x = Object.assign(blank(), d || {}); ["notes", "log", "mocks", "theory", "pipeline"].forEach((k) => { if (!Array.isArray(x[k])) x[k] = []; }); ["path", "srs", "revDays", "days", "weeks", "practice", "code", "skills"].forEach((k) => { if (!x[k] || typeof x[k] !== "object" || Array.isArray(x[k])) x[k] = {}; }); x.v = 2; return x; };
let S;
try { S = hydrate(JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { S = blank(); }
let saveT = null;
const flush = () => { clearTimeout(saveT); saveT = null; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("Couldn't save: browser storage is full or blocked. Export a backup now."); } schedSync(); };

/* Cloud sync (only when served by the Forge Worker; on any other host Forge stays local-only). */
let syncT = null;
const schedSync = (ms = 1500) => { if (!Sync || !Sync.enabled) return; clearTimeout(syncT); syncT = setTimeout(() => Sync.sync(), ms); };
const SYNC_TXT = { synced: ["Synced", ""], syncing: ["Syncing…", ""], offline: ["Offline · saved on this device", "warn"], "signed-out": ["Signed out · reload to sign in", "warn"], local: ["", ""] };
const Sync = window.ForgeSync ? ForgeSync.create({
  getState: () => S,
  onRemoteChange: () => {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
    const a = document.activeElement; const typing = a && (a.tagName === "TEXTAREA" || a.tagName === "INPUT" || a.closest(".CodeMirror"));
    if (!typing) render();
  },
  onStatus: (s) => { const el = document.getElementById("syncNote"); if (!el) return; const [t, c] = SYNC_TXT[s] || ["", ""]; el.hidden = !t; el.textContent = t; el.className = "sync-note " + c; }
}) : null;
const save = () => { clearTimeout(saveT); saveT = setTimeout(flush, 150); };
window.addEventListener("pagehide", () => { if (saveT) flush(); });
document.addEventListener("visibilitychange", () => { if (document.hidden && saveT) flush(); });
/* Another tab wrote: adopt its state so neither tab silently overwrites the other. */
window.addEventListener("storage", (e) => {
  if (e.key !== KEY || !e.newValue) return;
  try { S = hydrate(JSON.parse(e.newValue)); } catch (err) { return; }
  const a = document.activeElement; const typing = a && (a.tagName === "TEXTAREA" || a.tagName === "INPUT" || a.closest(".CodeMirror"));
  if (typing) toast("Updated in another tab. Your next edit continues from that version."); else render();
});
const uid = () => Math.random().toString(36).slice(2, 10);

/* ---------------- derived ---------------- */
const dayCount = (k) => C.blocks.filter((b) => S.days[k] && S.days[k][b.k]).length;
function streak() { let n = 0, d = now(); if (dayCount(ymd(d)) < BANK) d = addDays(d, -1); while (dayCount(ymd(d)) >= BANK) { n++; d = addDays(d, -1); } return n; }
const patLevel = (pid) => { const p = S.practice[pid]; if (!p) return 0; if (p.timed) return 3; if (p.solved) return 2; return p.attempts ? 1 : 0; };
const lastMock = () => S.mocks[S.mocks.length - 1];
const daysLeft = () => { const t = new Date(C.start + "T00:00:00"); const d = new Date(TODAY() + "T00:00:00"); return Math.max(0, Math.round((t - d) / 864e5)); };
const theoryBest = (id) => { const xs = S.theory.filter((t) => t.part === id).map((t) => t.score); return xs.length ? Math.max(...xs) : null; };
const theoryLast = (id) => { const xs = S.theory.filter((t) => t.part === id); return xs.length ? xs[xs.length - 1].score : null; };

/* ---------------- shell ---------------- */
function nav() {
  const r = route(), rq = SRS.queue(), due = rq.due.length + rq.fresh.length;
  const badge = { today: `${dayCount(TODAY())}/${NB()}`, arena: `${C.problems.filter((p) => patLevel(p.id) >= 2).length}/${C.problems.length}`, path: `${modsDone()}/${C.modules.length}`, review: due ? String(due) : "", proof: proofDue ? String(proofDue) : "" };
  let g = null, html = "";
  ROUTES.forEach(([k, t, grp]) => { if (grp !== g) { g = grp; if (grp) html += `<div class="nav-g">${grp}</div>`; } html += `<a href="#${k}" ${k === r ? 'aria-current="page"' : ""}>${icon(k)}<span>${t}</span>${badge[k] ? `<span class="badge">${badge[k]}</span>` : ""}</a>`; });
  $("#nav").innerHTML = html;
  $("#bottombar").innerHTML = MOBILE.map((k) => `<a href="#${k}" ${k === r ? 'aria-current="page"' : ""}>${icon(k)}<span>${ROUTES.find((x) => x[0] === k)[1]}</span></a>`).join("") + `<button type="button" id="moreBtn" ${MOBILE.includes(r) ? "" : 'aria-current="page"'}>${icon("more")}<span>More</span></button>`;
  $("#moreBtn").onclick = () => Palette.open("");
  $("#sideStreak").textContent = streak();
  const be = $("#backupNote"); if (be) { const d = S.lastExport ? Math.floor((Date.now() - S.lastExport) / 864e5) : null; const hasData = S.notes.length || S.log.length || Object.keys(S.days).length; be.textContent = d == null ? (hasData ? "No backup yet" : "") : d === 0 ? "Backed up today" : `Last backup ${d}d ago`; be.className = "backup-note " + (!(Sync && Sync.enabled) && ((d == null && hasData) || d > 7) ? "stale" : ""); }
}
const parseHash = () => { const [h, ...rest] = (location.hash || "#dashboard").slice(1).split("/"); return { r: ROUTES.some((x) => x[0] === h) ? h : "dashboard", arg: rest.length ? decodeURIComponent(rest.join("/")) : null }; };
const route = () => parseHash().r;
const routeArg = () => parseHash().arg;
let cleanup = [];
function render() {
  cleanup.forEach((f) => f()); cleanup = [];
  const r = route();
  $("#pageTitle").textContent = ROUTES.find((x) => x[0] === r)[1];
  document.title = `${ROUTES.find((x) => x[0] === r)[1]} · Forge`;
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
$("#searchBtn").onclick = () => Palette.open("");
$("#themeBtn").onclick = () => { S.theme = S.theme === null ? "dark" : S.theme === "dark" ? "light" : null; applyTheme(); save(); };
/* export / import */
$("#exportBtn").onclick = () => {
  S.lastExport = Date.now(); flush();
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
    } else {
      if (!d || typeof d !== "object" || !("days" in d || "notes" in d || "mocks" in d)) throw new Error("not a backup");
      S = hydrate(d); toast("Backup restored.");
    }
    flush(); applyTheme(); render();
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
    cells += `<i style="background:var(--heat-${fut ? 0 : lv});${fut ? "opacity:.35" : ""}" class="${k === TODAY() ? "today" : ""}" data-tip="${k}\n${n}/${NB()} blocks · ${fmtH(dayMin(k))} h logged"></i>`;
  }
  return `<div class="heat">${cells}</div>`;
}

/* ---------------- knowledge helpers ---------------- */
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const fmtH = (min) => { const h = min / 60; return h >= 10 ? String(Math.round(h)) : h.toFixed(1).replace(/\.0$/, ""); };
const noteById = (id) => S.notes.find((n) => n.id === id);
const noteByTitle = (t) => { const k = String(t).trim().toLowerCase(); return S.notes.find((n) => (n.title || "").trim().toLowerCase() === k); };
const newNote = (o = {}) => { const n = Object.assign({ id: uid(), title: "Untitled", body: "", tags: [], mod: null, visibility: "trusted", created: Date.now(), updated: Date.now() }, o); S.notes.unshift(n); save(); return n; };
const ext = (url) => /^https?:/.test(url) ? ' target="_blank" rel="noopener noreferrer"' : "";

/* Markdown (subset) with $math$, ```code```, [[wikilinks]] and Q:/A: card lines. Everything is escaped first. */
function inline(t) {
  const keep = []; const K = (h) => `\u0000${keep.push(h) - 1}\u0000`;
  t = t.replace(/`([^`]+)`/g, (_, c) => K(`<code>${esc(c)}</code>`));
  t = t.replace(/\$\$[^$]+\$\$|\$[^$\n]+\$/g, (m) => K(esc(m)));
  t = t.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, title, label) => { const n = noteByTitle(title); const l = esc(label || title); return K(n ? `<a class="wl" href="#library/${n.id}">${l}</a>` : `<a class="wl missing" href="#library" data-new="${esc(title.trim())}" title="Create this note">${l}</a>`); });
  t = t.replace(/\[([^\]]+)\]\(((?:https?:\/\/|#)[^\s)]*)\)/g, (_, l, u) => K(`<a href="${esc(u)}"${ext(u)}>${esc(l)}</a>`));
  t = esc(t)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
  return t.replace(/\u0000(\d+)\u0000/g, (_, n) => keep[+n]);
}
function md(src) {
  const L = String(src || "").replace(/\r/g, "").split("\n");
  let out = "", para = [], list = null, i = 0;
  const fp = () => { if (para.length) { out += `<p>${inline(para.join(" "))}</p>`; para = []; } };
  const fl = () => { if (list) { out += `</${list}>`; list = null; } };
  const li = (tag, html) => { fp(); if (list !== tag) { fl(); out += `<${tag}>`; list = tag; } out += `<li>${html}</li>`; };
  while (i < L.length) {
    const l = L[i]; let m;
    if (/^\s*```/.test(l)) { fp(); fl(); const b = []; i++; while (i < L.length && !/^\s*```/.test(L[i])) b.push(L[i++]); i++; out += `<pre class="code"><code>${esc(b.join("\n"))}</code></pre>`; continue; }
    if (/^\s*\$\$/.test(l)) { fp(); fl(); const b = [l]; if (!/\$\$.*\$\$/.test(l.trim().slice(0)) || l.trim() === "$$") { i++; while (i < L.length && !/\$\$\s*$/.test(L[i])) b.push(L[i++]); if (i < L.length) b.push(L[i]); } i++; out += `<div class="mblock">${esc(b.join("\n"))}</div>`; continue; }
    if (!l.trim()) { fp(); fl(); i++; continue; }
    if ((m = l.match(/^(#{1,4})\s+(.*)/))) { fp(); fl(); const n = m[1].length + 1; out += `<h${n}>${inline(m[2])}</h${n}>`; i++; continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { fp(); fl(); out += "<hr>"; i++; continue; }
    if ((m = l.match(/^\s*Q:\s*(.+)/i)) && L[i + 1] && /^\s*A:\s*/i.test(L[i + 1])) { fp(); fl(); out += `<div class="qa"><div><span class="eyebrow">Q</span>${inline(m[1])}</div><div><span class="eyebrow">A</span>${inline(L[i + 1].replace(/^\s*A:\s*/i, ""))}</div></div>`; i += 2; continue; }
    if ((m = l.match(/^(?![-*>#\s])(.+?)\s::\s(.+)$/))) { fp(); fl(); out += `<div class="qa def"><div>${inline(m[1])}</div><div>${inline(m[2])}</div></div>`; i++; continue; }
    if ((m = l.match(/^>\s?(.*)/))) { fp(); fl(); const b = [m[1]]; i++; while (i < L.length && /^>\s?/.test(L[i])) b.push(L[i++].replace(/^>\s?/, "")); out += `<blockquote>${inline(b.join(" "))}</blockquote>`; continue; }
    if ((m = l.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)/))) { li("ul", `<span class="cb ${m[1].trim() ? "on" : ""}"></span>${inline(m[2])}`); i++; continue; }
    if ((m = l.match(/^\s*[-*]\s+(.*)/))) { li("ul", inline(m[1])); i++; continue; }
    if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { li("ol", inline(m[1])); i++; continue; }
    fl(); para.push(l.trim()); i++;
  }
  fp(); fl(); return out;
}
/* Cards inside a note: "Q: …" + next line "A: …", or "front :: back". Fenced code is skipped. */
function noteCards(n) {
  const out = [], L = (n.body || "").replace(/\r/g, "").split("\n"); let code = false;
  for (let i = 0; i < L.length; i++) {
    if (/^\s*```/.test(L[i])) { code = !code; continue; } if (code) continue;
    let m;
    if ((m = L[i].match(/^\s*Q:\s*(.+)/i)) && L[i + 1] && /^\s*A:\s*/i.test(L[i + 1])) { const f = m[1].trim(); out.push({ id: `n:${n.id}:${hash(f)}`, f, b: L[i + 1].replace(/^\s*A:\s*/i, "").trim(), src: n.title || "Untitled", note: n.id }); i++; }
    else if ((m = L[i].match(/^(?![-*>#\s])(.+?)\s::\s(.+)$/))) { const f = m[1].trim(); out.push({ id: `n:${n.id}:${hash(f)}`, f, b: m[2].trim(), src: n.title || "Untitled", note: n.id }); }
  }
  return out;
}

/* ---------------- spaced repetition (SM-2 style) ---------------- */
const NEW_PER_DAY = 12;
const SEED = C.cards.map(([f, b]) => ({ id: "seed:" + hash(f), f, b, src: "Forge deck" }));
const SRS = {
  all() { return SEED.concat(...S.notes.map(noteCards)); },
  queue() {
    const t = TODAY(), cards = this.all().filter((c) => !(S.srs[c.id] && S.srs[c.id].off));
    const due = cards.filter((c) => S.srs[c.id] && S.srs[c.id].due <= t).sort((a, b) => S.srs[a.id].due.localeCompare(S.srs[b.id].due));
    const introduced = Object.values(S.srs).filter((s) => s.intro === t).length;
    const fresh = cards.filter((c) => !S.srs[c.id]).slice(0, Math.max(0, NEW_PER_DAY - introduced));
    return { due, fresh, cards };
  },
  next(st, g) {
    st = Object.assign({ ease: 2.5, ivl: 0, reps: 0, lapses: 0, intro: TODAY() }, st);
    if (g === 1) { st.lapses++; st.reps = 0; st.ivl = 0; st.ease = Math.max(1.3, st.ease - 0.2); }
    else {
      if (g === 2) { st.ivl = st.reps === 0 ? 1 : Math.max(st.ivl + 1, Math.round(st.ivl * 1.2)); st.ease = Math.max(1.3, st.ease - 0.15); }
      else if (g === 3) st.ivl = st.reps === 0 ? 1 : st.reps === 1 ? 3 : Math.max(st.ivl + 1, Math.round(st.ivl * st.ease));
      else { st.ivl = st.reps === 0 ? 4 : Math.max(st.ivl + 2, Math.round(st.ivl * st.ease * 1.3)); st.ease += 0.15; }
      st.reps++;
    }
    st.due = ymd(addDays(now(), st.ivl)); st.last = TODAY(); return st;
  },
  grade(id, g) {
    S.srs[id] = this.next(S.srs[id], g);
    const r = S.revDays[TODAY()] = Object.assign({ n: 0, again: 0 }, S.revDays[TODAY()]); r.n++; if (g === 1) r.again++;
    save();
  },
  label(ivl) { return ivl === 0 ? "now" : ivl < 30 ? `${ivl}d` : ivl < 365 ? `${Math.round(ivl / 30)}mo` : `${(ivl / 365).toFixed(1)}y`; },
  retention(days = 30) { let n = 0, a = 0; for (let i = 0; i < days; i++) { const r = S.revDays[ymd(addDays(now(), -i))]; if (r) { n += r.n; a += r.again; } } return n ? Math.round(((n - a) / n) * 100) : null; }
};

/* ---------------- path & time log ---------------- */
const modById = (id) => C.modules.find((m) => m.id === id);
const stageOf = (m) => C.stages.find((s) => s.k === m.stage);
const PS = (id) => S.path[id] || (S.path[id] = { res: {}, checks: {} });
const modStatus = (id) => (S.path[id] && S.path[id].status) || "todo";
const modsDone = () => C.modules.filter((m) => modStatus(m.id) === "done").length;
const modProgress = (m) => { const p = S.path[m.id] || {}; const r = p.res || {}, c = p.checks || {}; const got = m.res.filter((_, i) => r[i]).length + m.checks.filter((_, i) => c[i]).length + (p.proof ? 1 : 0); return got / (m.res.length + m.checks.length + 1); };
const activeMods = () => C.modules.filter((m) => modStatus(m.id) === "active");
const nextMod = () => activeMods()[0] || C.modules.find((m) => modStatus(m.id) !== "done");
const areaOf = (k) => C.areas.find((a) => a.k === k) || { k, t: k };
const areaIdx = (k) => Math.max(0, C.areas.findIndex((a) => a.k === k)) + 1;
const modMin = (id) => S.log.reduce((a, e) => a + (e.mod === id ? e.min : 0), 0);
const weekOf = (date) => isoWeek(new Date(date + "T12:00:00"));
const weekMin = (wk) => S.log.reduce((a, e) => a + (weekOf(e.date) === wk ? e.min : 0), 0);
const dayMin = (d) => S.log.reduce((a, e) => a + (e.date === d ? e.min : 0), 0);
function addLog(o) {
  const min = Math.round(Number(o.min)); if (!(min > 0)) return false;
  const m = o.mod ? modById(o.mod) : null;
  S.log.push({ id: uid(), date: o.date || TODAY(), min, area: o.area || (m ? stageOf(m).area : "dl"), mod: m ? m.id : null, note: (o.note || "").trim(), src: o.src || "manual" });
  if (m && modStatus(m.id) === "todo") { const p = PS(m.id); p.status = "active"; p.started = p.started || TODAY(); }
  save(); return true;
}
function copyText(txt, ok) { return navigator.clipboard.writeText(txt).then(() => toast(ok), () => toast("Copy failed: your browser blocked clipboard access.")); }

/* ---------------- tooltip ---------------- */
const tip = document.createElement("div"); tip.className = "tip"; tip.setAttribute("role", "tooltip"); document.body.appendChild(tip);
document.addEventListener("pointermove", (e) => {
  const t = e.target.closest && e.target.closest("[data-tip]");
  if (!t) { tip.classList.remove("show"); return; }
  tip.innerHTML = t.dataset.tip.split("\n").map((l, i) => i ? `<div>${esc(l)}</div>` : `<b>${esc(l)}</b>`).join("");
  tip.classList.add("show");
  const w = tip.offsetWidth, h = tip.offsetHeight; let x = e.clientX + 14, y = e.clientY - h - 12;
  if (x + w > innerWidth - 8) x = e.clientX - w - 14; if (y < 8) y = e.clientY + 18;
  tip.style.transform = `translate(${x}px, ${y}px)`;
});

/* Hours per ISO week, stacked by area. One axis, 2px gaps between segments, hover per week. */
function weekStack(n = 12) {
  const weeks = []; for (let i = n - 1; i >= 0; i--) weeks.push(isoWeek(addDays(now(), -7 * i)));
  const data = weeks.map((wk) => { const by = {}; S.log.forEach((e) => { if (weekOf(e.date) === wk) by[e.area] = (by[e.area] || 0) + e.min / 60; }); return { wk, by, tot: Object.values(by).reduce((a, b) => a + b, 0) }; });
  const W = 640, H = 210, Lm = 30, R = 8, T = 14, B = 24;
  const mx = Math.ceil(Math.max(C.weeklyHours, ...data.map((d) => d.tot)) / 5) * 5;
  const y = (v) => T + (H - T - B) * (1 - v / mx), slot = (W - Lm - R) / n, bw = Math.min(30, slot * 0.6);
  let g = "";
  for (let v = 0; v <= mx; v += mx > 30 ? 10 : 5) g += `<line x1="${Lm}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${Lm - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  data.forEach((d, i) => {
    const x = Lm + i * slot + (slot - bw) / 2; let acc = 0; const segs = C.areas.filter((a) => d.by[a.k]);
    segs.forEach((a, j) => {
      const y0 = y(acc), y1 = y(acc + d.by[a.k]); acc += d.by[a.k];
      const top = j === segs.length - 1, h = Math.max(0, y0 - y1 - (j ? 2 : 0)), yy = y1, r = top ? Math.min(4, h, bw / 2) : 0;
      if (h <= 0) return;
      g += r ? `<path d="M${x},${yy + h} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + bw - r} Q${x + bw},${yy} ${x + bw},${yy + r} V${yy + h} Z" fill="var(--c${areaIdx(a.k)})"/>` : `<rect x="${x}" y="${yy}" width="${bw}" height="${h}" fill="var(--c${areaIdx(a.k)})"/>`;
    });
    const tipTxt = [`${d.wk} · ${d.tot.toFixed(1)} h`].concat(segs.map((a) => `${a.t}: ${d.by[a.k].toFixed(1)} h`)).join("\n");
    g += `<rect x="${Lm + i * slot}" y="${T}" width="${slot}" height="${H - T - B}" fill="transparent" data-tip="${esc(tipTxt)}"/>`;
    if (i % (n > 8 ? 2 : 1) === (n - 1) % 2 || n <= 8) g += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${d.wk.slice(5)}</text>`;
  });
  g += `<line x1="${Lm}" x2="${W - R}" y1="${y(C.weeklyHours)}" y2="${y(C.weeklyHours)}" stroke="var(--muted)" stroke-dasharray="4 4"/><text x="${W - R}" y="${y(C.weeklyHours) - 6}" text-anchor="end">target ${C.weeklyHours} h</text>`;
  const used = C.areas.filter((a) => data.some((d) => d.by[a.k]));
  return `<div class="legend" style="gap:14px;flex-wrap:wrap;margin-bottom:8px">${used.map((a) => `<span class="row" style="gap:6px"><i style="background:var(--c${areaIdx(a.k)})"></i>${esc(a.t)}</span>`).join("")}</div><svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Deep-work hours per week by area">${g}</svg>`;
}
function areaBars(entries) {
  const by = {}; entries.forEach((e) => { by[e.area] = (by[e.area] || 0) + e.min; });
  const rows = C.areas.filter((a) => by[a.k]).sort((a, b) => by[b.k] - by[a.k]); const mx = Math.max(1, ...rows.map((a) => by[a.k]));
  return rows.map((a) => `<div class="hbar" data-tip="${esc(`${a.t}\n${fmtH(by[a.k])} h · ${S.log.filter((e) => e.area === a.k).length} sessions`)}"><span>${esc(a.t)}</span><div class="track-b"><i style="width:${(by[a.k] / mx) * 100}%;background:var(--c${areaIdx(a.k)})"></i></div><b class="num">${fmtH(by[a.k])} h</b></div>`).join("");
}

/* ---------------- views ---------------- */
const VIEWS = {};

VIEWS.dashboard = (v) => {
  const td = dayCount(TODAY()), wk = isoWeek(now()), wmin = weekMin(wk), q = SRS.queue(), due = q.due.length + q.fresh.length;
  const open = C.blocks.filter((b) => !(S.days[TODAY()] && S.days[TODAY()][b.k]));
  const hour = now().getHours(); const hello = hour < 5 ? "Late night" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const nm = nextMod(), act = activeMods();
  const headline = td >= BANK ? "Today is banked. Rest is part of the plan." : !S.log.length && !act.length ? "Start the path: one module, rebuilt from a blank file." : `${NB() - td} blocks left today. Start with the hardest one.`;
  const pts = S.mocks.map((x) => ({ v: x.score, l: x.date.slice(5) }));
  const pipeNext = S.pipeline.filter((p) => p.status !== "closed" && p.next).slice(0, 3);
  const recentNotes = S.notes.slice().sort((a, b) => b.updated - a.updated).slice(0, 4);
  v.innerHTML = `
  <section class="hero">
    <div>
      <div class="eyebrow">${hello}, Matis</div>
      <h2 style="margin-top:8px">${esc(headline)}</h2>
      <p>Understand it by rebuilding it. Measure the gap, train it daily, ship proof in public. Every number here comes from work you actually did.</p>
      <div class="row">
        ${nm ? `<a class="btn primary" href="#path/${nm.id}">${icon("play")} ${act.length ? "Continue" : "Start"}: ${esc(nm.t)}</a>` : ""}
        ${due ? `<a class="btn" href="#review">${icon("review")} Review ${due} cards</a>` : ""}
        <a class="btn" href="#today">${icon("today")} Today's blocks</a>
      </div>
    </div>
    ${ring(daysLeft(), 116, daysLeft(), "days to 1 March")}
  </section>
  <section class="grid g-4">
    <a class="card kpi ember" href="#today"><span class="eyebrow">Streak</span><b>${streak()}</b><span class="sub">days at ${BANK}/${NB()} blocks</span></a>
    <a class="card kpi" href="#log"><span class="eyebrow">Deep work this week</span><b>${fmtH(wmin)}<span class="muted" style="font-size:15px"> / ${C.weeklyHours} h</span></b><div class="progress"><i style="width:${Math.min(100, (wmin / 60 / C.weeklyHours) * 100)}%"></i></div></a>
    <a class="card kpi" href="#path"><span class="eyebrow">Path</span><b>${modsDone()}<span class="muted" style="font-size:15px">/${C.modules.length}</span></b><span class="sub">${act.length} active · ${S.notes.length} notes</span></a>
    <a class="card kpi" href="#review"><span class="eyebrow">Cards to review</span><b>${due}</b><span class="sub">${SRS.retention() == null ? "retention appears after reviews" : `${SRS.retention()}% retention, 30 days`}</span></a>
  </section>
  <section class="grid g-main">
    <div class="card">
      <div class="card-h"><h3>Deep work, last 12 weeks</h3><a class="btn small" href="#log">Log</a></div>
      ${S.log.length ? weekStack(12) : `<div class="empty">Finish a focus timer or log a session: hours by area build up here.</div>`}
    </div>
    <div class="card">
      <div class="card-h"><h3>Next up</h3></div>
      <div class="next-list">
        ${act.slice(0, 2).map((m) => `<a class="next-item" href="#path/${m.id}"><span class="dot" style="background:var(--c${areaIdx(stageOf(m).area)})"></span><span><b>${esc(m.t)}</b> · ${Math.round(modProgress(m) * 100)}%</span><span class="pill">${fmtH(modMin(m.id))}/${m.hrs} h</span></a>`).join("")}
        ${open.slice(0, 3).map((b) => `<a class="next-item" href="#today"><span class="dot ember"></span><span>${esc(b.t)}</span><span class="pill">${b.min ? b.min + " min" : "tonight"}</span></a>`).join("") || `<div class="next-item"><span class="dot good"></span><span>All blocks done today</span><span class="pill good">✓</span></div>`}
        ${pipeNext.map((p) => `<a class="next-item" href="#pipeline"><span class="dot"></span><span><b>${esc(p.company)}</b> · ${esc(p.next)}</span><span class="pill acc">${esc((C.statuses.find((s) => s.k === p.status) || {}).t || "")}</span></a>`).join("")}
      </div>
    </div>
  </section>
  <section class="grid g-main">
    <div class="card">
      <div class="card-h"><h3>Consistency</h3><div class="legend">less ${[0, 1, 2, 3, 4, 5].map((i) => `<i style="background:var(--heat-${i})"></i>`).join("")} more</div></div>
      ${heatmap()}
      <div class="row muted" style="margin-top:12px;font-size:13px"><span>Each square is one day. Color = blocks completed out of ${NB()}.</span></div>
    </div>
    <div class="card">
      <div class="card-h"><h3>Skill shape</h3><span class="row" style="gap:12px;font-size:12px"><span><span style="color:var(--accent)">●</span> now</span><span><span style="color:var(--ember)">- -</span> target</span></span></div>
      ${radar()}
    </div>
  </section>
  <section class="grid g-main">
    <div class="card">
      <div class="card-h"><h3>Coding mock score</h3><a class="btn small" href="#diagnostic">New mock</a></div>
      ${pts.length ? lineChart(pts) : `<div class="empty">No mock yet. Take the 55-minute diagnostic: your first score becomes the baseline this line grows from.</div>`}
    </div>
    <div class="card">
      <div class="card-h"><h3>Recent notes</h3><a class="btn small" href="#library">Library</a></div>
      ${recentNotes.length ? `<div class="next-list">${recentNotes.map((n) => `<a class="next-item" href="#library/${n.id}"><span class="dot"></span><span>${esc(n.title || "Untitled")}</span><span class="pill">${noteCards(n).length} cards</span></a>`).join("")}</div>` : `<div class="empty">Notes you write while working through the path show up here.</div>`}
    </div>
  </section>`;
};

/* ---- today ---- */
/* A finished focus block becomes a logged session. Outreach and sleep aren't deep work. */
const BLOCK_AREA = { code: "code", ship: "res", eng: "eng" };
function logFocus(b) {
  if (b.k === "fund") { const m = nextMod(); addLog({ min: b.min, mod: m ? m.id : null, area: m ? stageOf(m).area : "math", note: b.t, src: "timer" }); }
  else if (BLOCK_AREA[b.k]) addLog({ min: b.min, area: BLOCK_AREA[b.k], note: b.t, src: "timer" });
}
let focus = null; try { focus = JSON.parse(sessionStorage.getItem("forge.focus") || "null"); } catch (e) {} // {k, dur, end|null, left}
const saveFocus = () => { try { sessionStorage.setItem("forge.focus", JSON.stringify(focus)); } catch (e) {} };
VIEWS.today = (v) => {
  const t = TODAY(), d = S.days[t] || {}, n = dayCount(t);
  if (!focus) focus = { k: "code", dur: 45 * 60000, end: null, left: 45 * 60000 };
  const fb = C.blocks.find((b) => b.k === focus.k) || C.blocks[0];
  v.innerHTML = `
  <section class="card">
    <div class="row" style="justify-content:space-between">
      <div><div class="eyebrow">Today</div><h2 style="margin-top:6px;font-size:22px">${n}/${NB()} blocks · ${n >= BANK ? "day banked" : `${BANK - n} more to bank the day`}</h2></div>
      <span class="row"><a class="pill" href="#log" style="text-decoration:none">${fmtH(dayMin(t))} h deep work today</a><span class="pill ember">${streak()}-day streak</span></span>
    </div>
    <div class="progress" style="margin-top:14px"><i style="width:${(n / NB()) * 100}%"></i></div>
  </section>
  <section class="blocks">${C.blocks.map((b) => `<button class="block ${d[b.k] ? "done" : ""}" data-k="${b.k}" aria-pressed="${!!d[b.k]}"><span class="tick">${icon("check")}</span><span class="meta">${b.min ? b.min + " min" : "evening"}</span><h3>${esc(b.t)}</h3><p>${esc(b.d)}</p></button>`).join("")}</section>
  <section class="card focus">
    <div><div class="eyebrow">Focus timer</div><div class="clock" id="fclock">${fmtClock(focus.end ? focus.end - Date.now() : focus.left)}</div></div>
    <div style="display:grid;gap:12px">
      <div class="seg" role="group" aria-label="Block">${C.blocks.filter((b) => b.min).map((b) => `<button data-fk="${b.k}" aria-pressed="${b.k === focus.k}">${esc(b.t)}</button>`).join("")}</div>
      <div class="row"><button class="btn primary" id="fgo">${focus.end ? "Pause" : "Start"} ${esc(fb.t.toLowerCase())}</button><button class="btn" id="freset">Reset</button><span class="muted" style="font-size:13px">When the timer ends, the block is ticked and the time is logged${focus.k === "fund" && nextMod() ? ` to ${esc(nextMod().t)}` : ""}.</span></div>
    </div>
  </section>`;
  $$(".block", v).forEach((b) => b.onclick = () => { S.days[t] = Object.assign({}, S.days[t], { [b.dataset.k]: !(S.days[t] || {})[b.dataset.k] }); save(); const was = n; render(); const now5 = dayCount(t); if (was < BANK && now5 >= BANK) toast("Day banked. Streak +1."); });
  $$("[data-fk]", v).forEach((b) => b.onclick = () => { if (focus.end) return toast("Pause the timer first."); const bl = C.blocks.find((x) => x.k === b.dataset.fk); focus = { k: bl.k, dur: bl.min * 60000, end: null, left: bl.min * 60000 }; saveFocus(); render(); });
  $("#fgo").onclick = () => { if (focus.end) { focus.left = focus.end - Date.now(); focus.end = null; } else { focus.end = Date.now() + focus.left; } saveFocus(); render(); };
  $("#freset").onclick = () => { focus = { k: focus.k, dur: focus.dur, end: null, left: focus.dur }; saveFocus(); render(); };
  if (focus.end) {
    const iv = setInterval(() => {
      const left = focus.end - Date.now(); const el = $("#fclock"); if (el) el.textContent = fmtClock(left);
      if (left <= 0) { clearInterval(iv); S.days[t] = Object.assign({}, S.days[t], { [focus.k]: true }); logFocus(fb); save(); toast(`${fb.t} done.`); focus = { k: focus.k, dur: focus.dur, end: null, left: focus.dur }; saveFocus(); render(); }
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
  ${Sync && Sync.enabled ? `<section class="card" id="smast"><div class="faint">Loading measured mastery…</div></section>` : ""}
  <section class="card"><div class="card-h"><h3>Coding patterns</h3><span class="muted" style="font-size:13px">Measured by the Arena: tried · solved · solved in a timed mock</span></div>
    <div class="patgrid">${C.problems.map((p) => { const l = patLevel(p.id); return `<a class="pat" href="#arena" data-go="${p.id}"><span>${esc(p.pattern)}</span><span class="pips ${l === 3 ? "full" : ""}">${[1, 2, 3].map((i) => `<i class="${i <= l ? "on" : ""}"></i>`).join("")}</span></a>`; }).join("")}</div>
  </section>`;
  $$("[data-t]", v).forEach((b) => b.onclick = () => { const k = b.dataset.t, l = +b.dataset.l; S.skills[k] = S.skills[k] === l ? l - 1 : l; save(); render(); });
  masteryCard($("#smast"), { compare: true });
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
      <label class="field"><span>Deep-work hours</span><input class="input" type="number" min="0" step="0.5" id="w_hours" value="${w.hours ?? ""}" placeholder="${fmtH(weekMin(wk))} logged"></label>
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

/* ---- path ---- */
const KIND = { video: "Video", course: "Course", book: "Book", paper: "Paper", blog: "Blog", code: "Code" };
VIEWS.path = (v) => {
  const id = routeArg(); if (id && modById(id)) return moduleView(v, modById(id));
  const done = modsDone(), act = activeMods(), est = C.modules.reduce((a, m) => a + m.hrs, 0), logged = S.log.reduce((a, e) => a + (e.mod ? e.min : 0), 0);
  v.innerHTML = `
  <section class="card">
    <div class="row" style="justify-content:space-between;align-items:flex-start">
      <div style="max-width:64ch"><div class="eyebrow">The path</div><h2 style="margin-top:6px;font-size:22px">${done}/${C.modules.length} modules · ${fmtH(logged)} of ~${est} h</h2>
        <p class="muted" style="margin-top:8px">Watch or read once. Then close everything and rebuild the deliverable on a blank file. A module is done when the proof link exists and every check is honestly true.</p></div>
      ${(() => { const m = nextMod(); return m ? `<a class="btn primary" href="#path/${m.id}">${icon("play")} ${act.length ? "Continue" : "Start"}: ${esc(m.t)}</a>` : ""; })()}
    </div>
    <div class="progress" style="margin-top:14px"><i style="width:${(done / C.modules.length) * 100}%"></i></div>
  </section>
  ${C.stages.map((s, si) => { const ms = C.modules.filter((m) => m.stage === s.k); const d = ms.filter((m) => modStatus(m.id) === "done").length; return `
  <section class="stage">
    <div class="stage-h"><div><span class="eyebrow">Stage ${si} · ${esc(areaOf(s.area).t)}</span><h3>${esc(s.t)}</h3><p class="muted">${esc(s.d)}</p></div><span class="pill ${d === ms.length ? "good" : ""}">${d}/${ms.length}</span></div>
    <div class="mods">${ms.map((m) => { const st = modStatus(m.id), pr = modProgress(m), mm = modMin(m.id); return `<a class="mod" href="#path/${m.id}"><span class="mst ${st}" aria-label="${st}"></span><span class="mt"><b>${esc(m.t)}</b><span class="muted">${esc(m.why)}</span></span><span class="meter" data-tip="${esc(`${Math.round(pr * 100)}% of resources, checks and proof`)}"><i style="width:${pr * 100}%"></i></span><span class="num muted mh">${fmtH(mm)}/${m.hrs} h</span></a>`; }).join("")}</div>
  </section>`; }).join("")}`;
};
function moduleView(v, m) {
  const p = S.path[m.id] || { res: {}, checks: {} }, st = modStatus(m.id), stg = stageOf(m), si = C.stages.indexOf(stg);
  const idx = C.modules.indexOf(m), prev = C.modules[idx - 1], next = C.modules[idx + 1];
  const mine = S.log.filter((e) => e.mod === m.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6), notes = S.notes.filter((n) => n.mod === m.id);
  const allChecks = m.checks.every((_, i) => (p.checks || {})[i]);
  $("#pageTitle").textContent = "Path"; document.title = `${m.t} · Forge`;
  v.innerHTML = `
  <nav class="crumbs"><a href="#path">Path</a><span>/</span><span>Stage ${si} · ${esc(stg.t)}</span></nav>
  <section class="card">
    <div class="row" style="justify-content:space-between;align-items:flex-start">
      <div style="max-width:68ch"><div class="eyebrow">${esc(areaOf(stg.area).t)} · ~${m.hrs} h · ${fmtH(modMin(m.id))} h logged</div><h2 style="margin-top:6px;font-size:24px">${esc(m.t)}</h2><p class="muted" style="margin-top:8px">${esc(m.why)}</p></div>
      <div class="seg" role="group" aria-label="Status">${[["todo", "To do"], ["active", "Active"], ["done", "Done"]].map(([k, t]) => `<button data-st="${k}" aria-pressed="${st === k}">${t}</button>`).join("")}</div>
    </div>
    <div class="progress" style="margin-top:14px"><i style="width:${modProgress(m) * 100}%"></i></div>
  </section>
  <section class="grid g-main">
    <div style="display:grid;gap:16px;min-width:0">
      <div class="card"><div class="card-h"><h3>1 · Learn</h3><span class="muted" style="font-size:13px">Tick when finished, not when opened</span></div>
        <div class="reslist">${m.res.map(([k, t, u], i) => `<label class="resitem"><input type="checkbox" data-res="${i}" ${(p.res || {})[i] ? "checked" : ""}><span class="pill">${KIND[k] || k}</span><a href="${esc(u)}"${ext(u)}>${esc(t)}</a></label>`).join("")}</div></div>
      <div class="card"><div class="card-h"><h3>2 · Build from scratch</h3></div>
        <p>${esc(m.build)}</p>
        <label class="field" style="margin-top:14px"><span>Proof: repo, commit, notebook or post</span><div class="row" style="flex-wrap:nowrap"><input class="input" id="proof" placeholder="https://github.com/…" value="${esc(p.proof || "")}">${p.proof && /^https?:/.test(p.proof) ? `<a class="btn" href="${esc(p.proof)}" target="_blank" rel="noopener noreferrer">${icon("link")} Open</a>` : ""}</div></label></div>
      <div class="card"><div class="card-h"><h3>3 · Exit checks</h3><span class="muted" style="font-size:13px">Say each one aloud, without notes</span></div>
        <div class="keys">${m.checks.map((c, i) => `<label><input type="checkbox" data-ck="${i}" ${(p.checks || {})[i] ? "checked" : ""}><span class="math">${c}</span></label>`).join("")}</div>
        <div class="row" style="margin-top:12px"><button class="btn" id="quiz">Copy quiz prompt for Claude</button><span class="muted" style="font-size:13px">An examiner that asks follow-ups, without giving answers.</span></div></div>
    </div>
    <div style="display:grid;gap:16px;min-width:0">
      <div class="card"><div class="card-h"><h3>Log time</h3><span class="pill">${fmtH(modMin(m.id))} h</span></div>
        <div class="row">${[25, 50, 90].map((n) => `<button class="btn small" data-add="${n}">+${n} min</button>`).join("")}</div>
        <form id="mlog" class="row" style="margin-top:10px;flex-wrap:nowrap"><input class="input" id="mmin" type="number" min="1" max="720" placeholder="min" style="width:80px"><input class="input" id="mnote" placeholder="What you did (optional)"><button class="btn" type="submit">Log</button></form>
        ${mine.length ? `<div class="mini-log">${mine.map((e) => `<div><span class="num muted">${e.date.slice(5)}</span><span>${esc(e.note || "Session")}</span><span class="num">${e.min} min</span></div>`).join("")}</div>` : ""}</div>
      <div class="card"><div class="card-h"><h3>Notes</h3><button class="btn small" id="mnew">${icon("plus")} New note</button></div>
        ${notes.length ? `<div class="next-list">${notes.map((n) => `<a class="next-item" href="#library/${n.id}"><span class="dot"></span><span>${esc(n.title || "Untitled")}</span><span class="pill">${noteCards(n).length} cards</span></a>`).join("")}</div>` : `<p class="muted" style="font-size:14px">Write what you rebuilt, the bugs you hit and 5 Q:/A: cards. They go straight into Review.</p>`}</div>
      <div class="row" style="justify-content:space-between">${prev ? `<a class="btn small" href="#path/${prev.id}">← ${esc(prev.t)}</a>` : "<span></span>"}${next ? `<a class="btn small" href="#path/${next.id}">${esc(next.t)} →</a>` : ""}</div>
    </div>
  </section>`;
  const set = (fn) => { const q = PS(m.id); fn(q); save(); };
  $$("[data-st]", v).forEach((b) => b.onclick = () => {
    const k = b.dataset.st;
    if (k === "done" && st !== "done" && (!allChecks || !p.proof) && !b.dataset.sure) { b.dataset.sure = 1; b.textContent = "Proof or checks missing. Click again"; return; }
    set((q) => { q.status = k; if (k !== "todo") q.started = q.started || TODAY(); q.finished = k === "done" ? TODAY() : null; });
    if (k === "done") toast(`${m.t}: done. On to the next one.`); render();
  });
  $$("[data-res]", v).forEach((c) => c.onchange = () => { set((q) => { q.res = q.res || {}; q.res[c.dataset.res] = c.checked; }); render(); });
  $$("[data-ck]", v).forEach((c) => c.onchange = () => { set((q) => { q.checks = q.checks || {}; q.checks[c.dataset.ck] = c.checked; }); render(); });
  $("#proof").onchange = (e) => { set((q) => { q.proof = e.target.value.trim(); }); render(); };
  $$("[data-add]", v).forEach((b) => b.onclick = () => { addLog({ min: +b.dataset.add, mod: m.id }); toast(`${b.dataset.add} min logged on ${m.t}.`); render(); });
  $("#mlog").onsubmit = (e) => { e.preventDefault(); if (addLog({ min: $("#mmin").value, mod: m.id, note: $("#mnote").value })) { toast("Session logged."); render(); } else toast("Enter the minutes first."); };
  $("#mnew").onclick = () => { const n = newNote({ title: `${m.t} — notes`, mod: m.id, tags: [stg.area], body: `## What I rebuilt\n\n\n## Bugs I hit\n\n\n## Cards\nQ: \nA: \n` }); location.hash = `#library/${n.id}`; };
  $("#quiz").onclick = () => copyText(`You are a demanding ML research examiner. Quiz me on "${m.t}". Ask one question at a time, wait for my answer, then grade it strictly, point out what's missing, and ask a harder follow-up. Do not give the answer unless I've tried twice. Cover these checks:\n${m.checks.map((c) => "- " + c.replace(/\$/g, "")).join("\n")}\nAlso ask me to write code for: ${m.build}`, "Prompt copied. Paste it into Claude.");
}

/* ---- library ---- */
let libQ = "", libTag = "";
VIEWS.library = (v) => {
  const id = routeArg(); if (id && noteById(id)) return noteView(v, noteById(id));
  $("#topAction").innerHTML = `<button class="btn small" id="njour" title="Private: never sent to an AI">Journal entry</button><button class="btn primary small" id="nnew">${icon("plus")} New note</button>`;
  $("#nnew").onclick = () => { const n = newNote(); location.hash = `#library/${n.id}`; };
  $("#njour").onclick = () => { const n = newNote({ kind: "journal", title: `Journal ${TODAY()}`, tags: ["journal"], visibility: "private" }); location.hash = `#library/${n.id}`; };
  const tags = [...new Set(S.notes.flatMap((n) => n.tags || []))].sort();
  const q = libQ.trim().toLowerCase();
  const list = S.notes.filter((n) => (!libTag || (n.tags || []).includes(libTag)) && (!q || (n.title + " " + n.body + " " + (n.tags || []).join(" ")).toLowerCase().includes(q))).sort((a, b) => b.updated - a.updated);
  const totalCards = S.notes.reduce((a, n) => a + noteCards(n).length, 0);
  v.innerHTML = `
  <section class="row" style="justify-content:space-between">
    <input class="input" id="lq" type="search" placeholder="Search ${S.notes.length} notes…" value="${esc(libQ)}" style="max-width:420px">
    <span class="muted" style="font-size:13px">${S.notes.length} notes · ${totalCards} cards feeding Review</span>
  </section>
  ${tags.length ? `<section class="row" style="gap:6px">${["", ...tags].map((t) => `<button class="chip" data-tag="${esc(t)}" aria-pressed="${t === libTag}">${t ? "#" + esc(t) : "All"}</button>`).join("")}</section>` : ""}
  <section id="lres">${!S.notes.length ? `<div class="empty"><p style="max-width:56ch;margin:0 auto 14px">Your knowledge base. One note per idea, paper or module: Markdown, $\\LaTeX$ math, code, <code>[[links]]</code> between notes, and <code>Q:</code>/<code>A:</code> lines that become review cards.</p><div class="row" style="justify-content:center"><button class="btn primary" id="guide">Create a guide note</button><button class="btn" id="blank">Blank note</button></div></div>`
    : list.length ? `<div class="notes">${list.map((n) => { const c = noteCards(n).length, m = n.mod && modById(n.mod); const snip = (n.body || "").replace(/[#*`>$\[\]]/g, "").replace(/\s+/g, " ").trim().slice(0, 150); return `<a class="note-card" href="#library/${n.id}"><b>${esc(n.title || "Untitled")}</b><p>${esc(snip) || '<span class="faint">Empty</span>'}</p><div class="row" style="gap:6px">${m ? `<span class="pill acc">${esc(m.t)}</span>` : ""}${n.visibility === "private" ? `<span class="pill warn" title="Never sent to an AI">private</span>` : n.visibility === "ai" ? `<span class="pill" title="Any AI provider may read it">ai</span>` : ""}${(n.tags || []).map((t) => `<span class="pill">#${esc(t)}</span>`).join("")}${c ? `<span class="pill ember">${c} cards</span>` : ""}<span class="faint num" style="margin-left:auto;font-size:12px">${ymd(new Date(n.updated))}</span></div></a>`; }).join("")}</div>`
    : `<div class="empty">No note matches.</div>`}</section>`;
  const lq = $("#lq"); lq.oninput = () => { libQ = lq.value; const pos = lq.selectionStart; render(); const n = $("#lq"); n.focus(); n.setSelectionRange(pos, pos); };
  $$("[data-tag]", v).forEach((b) => b.onclick = () => { libTag = b.dataset.tag; render(); });
  const g = $("#guide"); if (g) g.onclick = () => { const n = newNote({ title: "How Forge notes work", tags: ["meta"], body: GUIDE }); location.hash = `#library/${n.id}`; };
  const b = $("#blank"); if (b) b.onclick = () => { const n = newNote(); location.hash = `#library/${n.id}`; };
};
const GUIDE = `## Writing\nMarkdown: **bold**, *italic*, \`code\`, lists, > quotes, and headings with #.\n\nMath inline $p = \\mathrm{softmax}(z)$ or as a block:\n\n$$\\frac{\\partial L}{\\partial z} = p - y$$\n\n\`\`\`python\nlogits = x @ W + b\n\`\`\`\n\n## Linking\nLink notes with [[Attention]]. A link to a note that doesn't exist yet is dimmed: click it to create it. Each note lists its backlinks.\n\n## Cards\nEvery Q:/A: pair becomes a spaced-repetition card in Review:\n\nQ: Why scale attention by $1/\\sqrt{d_k}$?\nA: To keep score variance near 1 so softmax doesn't saturate.\n\nOne-line form, term :: definition:\n\nKV cache :: keys and values of past tokens, reused at each decoding step\n\n## Habit\nAfter each module: what you rebuilt, the bugs you hit, 5 cards. Short and in your own words.`;
let noteMode = "split";
function noteView(v, n) {
  $("#pageTitle").textContent = "Library"; document.title = `${n.title || "Untitled"} · Forge`;
  const back = S.notes.filter((x) => x.id !== n.id && new RegExp(`\\[\\[\\s*${(n.title || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(\\|[^\\]]*)?\\]\\]`, "i").test(x.body || ""));
  v.innerHTML = `
  <nav class="crumbs"><a href="#library">Library</a><span>/</span><span>${esc(n.title || "Untitled")}</span></nav>
  <section class="note-ed" data-mode="${noteMode}">
    <div class="note-meta">
      <input class="input note-title" id="ntitle" value="${esc(n.title)}" placeholder="Title" aria-label="Title">
      <div class="row" style="flex-wrap:nowrap">
        <label class="field" style="flex:1"><span>Tags, comma-separated</span><input class="input" id="ntags" value="${esc((n.tags || []).join(", "))}" placeholder="llm, paper"></label>
        <label class="field"><span>AI visibility</span><select class="input" id="nvis" title="Who may read this note">${[["private", "Private · never sent to an AI"], ["trusted", "Trusted providers only"], ["ai", "Any AI provider"]].map(([k, t]) => `<option value="${k}" ${(n.visibility || "trusted") === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <label class="field" style="flex:1"><span>Path module</span><select class="input" id="nmod"><option value="">None</option>${C.stages.map((s) => `<optgroup label="${esc(s.t)}">${C.modules.filter((m) => m.stage === s.k).map((m) => `<option value="${m.id}" ${n.mod === m.id ? "selected" : ""}>${esc(m.t)}</option>`).join("")}</optgroup>`).join("")}</select></label>
      </div>
      <div class="row" style="justify-content:space-between"><div class="seg" role="group" aria-label="View">${[["edit", "Write"], ["split", "Split"], ["view", "Read"]].map(([k, t]) => `<button data-nm="${k}" aria-pressed="${noteMode === k}">${t}</button>`).join("")}</div>
        <span class="row"><span class="pill ember" id="ncards">${noteCards(n).length} cards</span><span class="faint" id="nsaved" style="font-size:12px">Saved</span><button class="btn small" id="ndel">Delete</button></span></div>
    </div>
    <div class="note-panes">
      <textarea class="input note-src" id="nbody" spellcheck="true" placeholder="Write in Markdown. $math$, [[links]], Q:/A: cards…">${esc(n.body)}</textarea>
      <article class="md note-prev card" id="nprev">${md(n.body) || '<p class="faint">Preview appears here.</p>'}</article>
    </div>
    ${back.length ? `<div class="card"><div class="eyebrow" style="margin-bottom:8px">Linked from</div><div class="row" style="gap:6px">${back.map((x) => `<a class="chip" href="#library/${x.id}">${esc(x.title)}</a>`).join("")}</div></div>` : ""}
  </section>`;
  const cur = () => noteById(n.id);
  let pt = null;
  const touch = (fn) => { const x = cur(); if (!x) return; fn(x); x.updated = Date.now(); save(); $("#nsaved").textContent = "Saved"; };
  const prev = () => { clearTimeout(pt); pt = setTimeout(() => { const x = cur(); if (!x) return; const el = $("#nprev"); if (!el) return; el.innerHTML = md(x.body) || '<p class="faint">Preview appears here.</p>'; math(el); $("#ncards").textContent = `${noteCards(x).length} cards`; }, 220); };
  cleanup.push(() => clearTimeout(pt));
  $("#nbody").oninput = (e) => { touch((x) => { x.body = e.target.value; }); prev(); };
  $("#nbody").onkeydown = (e) => { if (e.key === "Tab") { e.preventDefault(); const t = e.target, s = t.selectionStart; t.setRangeText("  ", s, t.selectionEnd, "end"); t.dispatchEvent(new Event("input")); } };
  $("#ntitle").oninput = (e) => touch((x) => { x.title = e.target.value; });
  $("#ntitle").onchange = () => render();
  $("#ntags").onchange = (e) => touch((x) => { x.tags = e.target.value.split(",").map((t) => t.trim().replace(/^#/, "").toLowerCase()).filter(Boolean); });
  $("#nmod").onchange = (e) => touch((x) => { x.mod = e.target.value || null; });
  $("#nvis").onchange = (e) => { touch((x) => { x.visibility = e.target.value; }); render(); };
  $$("[data-nm]", v).forEach((b) => b.onclick = () => { noteMode = b.dataset.nm; $(".note-ed").dataset.mode = noteMode; $$("[data-nm]", v).forEach((x) => x.setAttribute("aria-pressed", x === b)); });
  $("#ndel").onclick = (e) => { if (!e.target.dataset.sure) { e.target.dataset.sure = 1; e.target.textContent = "Click again to delete"; return; } S.notes = S.notes.filter((x) => x.id !== n.id); save(); toast("Note deleted."); location.hash = "#library"; };
  if (!n.body && n.title === "Untitled") { const t = $("#ntitle"); t.focus(); t.select(); }
}
/* Clicking a dimmed [[link]] creates that note. */
document.addEventListener("click", (e) => { const a = e.target.closest && e.target.closest("a[data-new]"); if (!a) return; e.preventDefault(); const n = noteByTitle(a.dataset.new) || newNote({ title: a.dataset.new }); location.hash = `#library/${n.id}`; });

/* ---- review ---- */
let rv = null; /* { ids: [...], shown: bool, done: n } */
VIEWS.review = (v) => {
  const q = SRS.queue(), byId = Object.fromEntries(q.cards.map((c) => [c.id, c]));
  if (rv && rv.day !== TODAY()) rv = null;
  if (!rv || !rv.ids.length) rv = { day: TODAY(), ids: q.due.map((c) => c.id).concat(q.fresh.map((c) => c.id)), shown: false, done: rv ? rv.done : 0 };
  rv.ids = rv.ids.filter((id) => byId[id]);
  const today = S.revDays[TODAY()] || { n: 0, again: 0 }, ret = SRS.retention();
  const upcoming = Object.entries(S.srs).filter(([id, s]) => !s.off && byId[id] && s.due > TODAY()).map(([, s]) => s.due).sort();
  const card = byId[rv.ids[0]];
  const isNew = card && !S.srs[card.id];
  v.innerHTML = `
  <section class="grid g-4">
    <div class="card kpi"><span class="eyebrow">Due now</span><b>${q.due.length}</b><span class="sub">cards scheduled for today or earlier</span></div>
    <div class="card kpi"><span class="eyebrow">New today</span><b>${q.fresh.length}</b><span class="sub">of ${NEW_PER_DAY} new cards per day</span></div>
    <div class="card kpi"><span class="eyebrow">Reviewed today</span><b>${today.n}</b><span class="sub">${today.again} forgotten</span></div>
    <div class="card kpi"><span class="eyebrow">Retention, 30 days</span><b>${ret == null ? "—" : ret + "%"}</b><span class="sub">target 85–90%</span></div>
  </section>
  <section class="card review">${card ? `
    <div class="row" style="justify-content:space-between"><span class="row" style="gap:6px"><span class="pill ${isNew ? "ember" : "acc"}">${isNew ? "new" : "review"}</span><span class="pill">${esc(card.src)}</span></span><span class="muted num" style="font-size:13px">${rv.ids.length} left</span></div>
    <div class="rv-front md">${md(card.f)}</div>
    ${rv.shown ? `<div class="rv-back md">${md(card.b)}</div>
      <div class="grades">${[[1, "Again"], [2, "Hard"], [3, "Good"], [4, "Easy"]].map(([g, t]) => `<button class="btn g${g}" data-g="${g}"><span>${t}</span><span class="num faint">${SRS.label(SRS.next(S.srs[card.id], g).ivl)}</span><kbd>${g}</kbd></button>`).join("")}</div>`
    : `<div class="row" style="justify-content:center;margin-top:8px"><button class="btn primary" id="show">Show answer <kbd>Space</kbd></button></div><p class="faint" style="text-align:center;font-size:13px">Answer aloud or on paper first. Recall is the training, not reading.</p>`}
    ${card.note ? `<a class="faint" style="font-size:13px" href="#library/${card.note}">Edit in note →</a>` : ""}`
  : `<div class="empty"><b style="color:var(--fg)">All caught up.</b><br>${upcoming.length ? `Next review ${upcoming[0]} · ${upcoming.filter((d) => d === upcoming[0]).length} cards.` : "Add Q:/A: lines to your notes to grow the deck."}${rv.done ? ` You reviewed ${rv.done} cards in this session.` : ""}</div>`}
  </section>
  <details class="card"><summary><b>Deck</b> <span class="muted">· ${q.cards.length} cards · ${Object.keys(S.srs).filter((k) => byId[k]).length} started</span></summary>
    <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Front</th><th>Source</th><th>Due</th><th></th></tr></thead><tbody>${q.cards.map((c) => { const s = S.srs[c.id]; return `<tr><td class="md-inline">${inline(c.f)}</td><td class="muted" style="font-size:13px">${esc(c.src)}</td><td class="num muted">${s ? (s.off ? "suspended" : s.due) : "new"}</td><td><button class="btn small" data-off="${esc(c.id)}">${s && s.off ? "Resume" : "Suspend"}</button></td></tr>`; }).join("")}</tbody></table></div>
  </details>`;
  const show = () => { rv.shown = true; render(); };
  const grade = (g) => { const id = rv.ids.shift(); SRS.grade(id, g); rv.done++; if (g === 1) rv.ids.push(id); rv.shown = false; if (!rv.ids.length) toast(`Session done: ${rv.done} cards.`); render(); };
  const sb = $("#show"); if (sb) sb.onclick = show;
  $$("[data-g]", v).forEach((b) => b.onclick = () => grade(+b.dataset.g));
  $$("[data-off]", v).forEach((b) => b.onclick = () => { const id = b.dataset.off; const s = S.srs[id] || (S.srs[id] = { ease: 2.5, ivl: 0, reps: 0, lapses: 0, intro: TODAY(), due: TODAY() }); s.off = !s.off; save(); rv = null; render(); });
  const key = (e) => {
    if (Palette.isOpen() || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || !card) return;
    if (!rv.shown && (e.key === " " || e.key === "Enter")) { e.preventDefault(); show(); }
    else if (rv.shown && /^[1-4]$/.test(e.key)) { e.preventDefault(); grade(+e.key); }
  };
  document.addEventListener("keydown", key); cleanup.push(() => document.removeEventListener("keydown", key));
};

/* ---- log ---- */
VIEWS.log = (v) => {
  const wk = isoWeek(now()), thisW = weekMin(wk);
  let four = 0; for (let i = 1; i <= 4; i++) four += weekMin(isoWeek(addDays(now(), -7 * i)));
  const total = S.log.reduce((a, e) => a + e.min, 0);
  const rows = S.log.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60);
  const modTime = C.modules.map((m) => [m, modMin(m.id)]).filter(([, x]) => x).sort((a, b) => b[1] - a[1]).slice(0, 8);
  v.innerHTML = `
  <section class="card"><div class="card-h"><h3>Log a session</h3><span class="muted" style="font-size:13px">Focus timers and module buttons log for you. Only deep work counts.</span></div>
    <form id="lf" class="grid lform">
      <label class="field"><span>Date</span><input class="input" type="date" id="l_date" value="${TODAY()}" max="${TODAY()}"></label>
      <label class="field"><span>Minutes</span><input class="input" type="number" min="1" max="720" id="l_min" placeholder="50" required></label>
      <label class="field"><span>Module</span><select class="input" id="l_mod"><option value="">None</option>${C.stages.map((s) => `<optgroup label="${esc(s.t)}">${C.modules.filter((m) => m.stage === s.k).map((m) => `<option value="${m.id}" ${modStatus(m.id) === "active" && m === activeMods()[0] ? "selected" : ""}>${esc(m.t)}</option>`).join("")}</optgroup>`).join("")}</select></label>
      <label class="field"><span>Area</span><select class="input" id="l_area">${C.areas.map((a) => `<option value="${a.k}">${esc(a.t)}</option>`).join("")}</select></label>
      <label class="field" style="grid-column:span 2"><span>What you did</span><input class="input" id="l_note" placeholder="Backprop through BatchNorm by hand, matched autograd"></label>
      <button class="btn primary" type="submit">Log</button>
    </form></section>
  <section class="grid g-4">
    <div class="card kpi ember"><span class="eyebrow">This week</span><b>${fmtH(thisW)}<span class="muted" style="font-size:15px"> / ${C.weeklyHours} h</span></b><div class="progress"><i style="width:${Math.min(100, (thisW / 60 / C.weeklyHours) * 100)}%"></i></div></div>
    <div class="card kpi"><span class="eyebrow">4-week average</span><b>${fmtH(four / 4)}<span class="muted" style="font-size:15px"> h</span></b><span class="sub">per week, previous 4 weeks</span></div>
    <div class="card kpi"><span class="eyebrow">All time</span><b>${fmtH(total)}<span class="muted" style="font-size:15px"> h</span></b><span class="sub">${S.log.length} sessions</span></div>
    <div class="card kpi"><span class="eyebrow">Today</span><b>${fmtH(dayMin(TODAY()))}<span class="muted" style="font-size:15px"> h</span></b><span class="sub">${(() => { const k = S.log.filter((e) => e.date === TODAY()).length; return `${k} session${k === 1 ? "" : "s"}`; })()}</span></div>
  </section>
  <section class="card"><div class="card-h"><h3>Deep work per week, by area</h3><span class="muted" style="font-size:13px">Last 12 weeks · hover a bar</span></div>${S.log.length ? weekStack(12) : `<div class="empty">Log a session or finish a focus timer: your weeks build up here.</div>`}</section>
  <section class="grid g-2">
    <div class="card"><div class="card-h"><h3>Where the hours went</h3></div>${S.log.length ? areaBars(S.log) : `<div class="empty">No sessions yet.</div>`}</div>
    <div class="card"><div class="card-h"><h3>Time per module</h3></div>${modTime.length ? `<div class="next-list">${modTime.map(([m, x]) => `<a class="next-item" href="#path/${m.id}"><span class="dot" style="background:var(--c${areaIdx(stageOf(m).area)})"></span><span>${esc(m.t)}</span><span class="pill num">${fmtH(x)} / ${m.hrs} h</span></a>`).join("")}</div>` : `<div class="empty">Log time against a module to see it here.</div>`}</div>
  </section>
  <section class="card"><div class="card-h"><h3>Sessions</h3><span class="muted" style="font-size:13px">Latest 60</span></div><div class="table-wrap">${rows.length ? `<table><thead><tr><th>Date</th><th>Min</th><th>Area</th><th>Module</th><th>Note</th><th></th></tr></thead><tbody>${rows.map((e) => `<tr><td class="num">${e.date}</td><td class="num">${e.min}</td><td><span class="row" style="gap:6px;flex-wrap:nowrap"><i class="sw" style="background:var(--c${areaIdx(e.area)})"></i>${esc(areaOf(e.area).t)}</span></td><td>${e.mod && modById(e.mod) ? `<a href="#path/${e.mod}">${esc(modById(e.mod).t)}</a>` : '<span class="faint">—</span>'}</td><td class="muted" style="font-size:13px">${esc(e.note)}${e.src === "timer" ? ' <span class="pill">timer</span>' : ""}</td><td><button class="x" data-ldel="${e.id}">Delete</button></td></tr>`).join("")}</tbody></table>` : `<div class="empty">No sessions yet.</div>`}</div></section>`;
  const syncArea = () => { const m = modById($("#l_mod").value); if (m) $("#l_area").value = stageOf(m).area; };
  $("#l_mod").onchange = syncArea; syncArea();
  $("#lf").onsubmit = (e) => { e.preventDefault(); if (addLog({ date: $("#l_date").value || TODAY(), min: $("#l_min").value, mod: $("#l_mod").value, area: $("#l_area").value, note: $("#l_note").value })) { toast("Session logged."); render(); } else toast("Minutes must be a positive number."); };
  $$("[data-ldel]", v).forEach((b) => b.onclick = () => { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "Confirm"; return; } S.log = S.log.filter((e) => e.id !== b.dataset.ldel); save(); render(); });
};

/* ---------------- brain: sources, search, repos, context inspector (needs the Forge Worker) ---------------- */
const VIS = [["private", "Private · never sent to an AI"], ["trusted", "Trusted providers only"], ["ai", "Any AI provider"]];
const visPill = (v) => v === "private" ? `<span class="pill warn" title="Never sent to an AI">private</span>` : v === "ai" ? `<span class="pill acc" title="Any AI provider may read it">ai</span>` : `<span class="pill" title="Only providers marked trusted">trusted</span>`;
const visSel = (v, attr) => `<select class="input small-sel" ${attr} aria-label="AI visibility">${VIS.map(([k, t]) => `<option value="${k}" ${v === k ? "selected" : ""}>${t}</option>`).join("")}</select>`;
async function api(method, path, body) {
  const r = await fetch(path, { method, credentials: "same-origin", headers: body ? { "content-type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  const x = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(x.error || `Server answered ${r.status}`);
  return x;
}
const fail = (e) => toast(e.message || String(e));
const where = (m = {}) => m.path ? `${m.path}${m.lines ? `:${m.lines[0]}–${m.lines[1]}` : ""}${m.symbol && m.symbol !== "(header)" ? ` · ${m.symbol}` : ""}` : [m.page ? `p. ${m.page}` : "", m.heading || "", m.commit ? `commit ${m.commit.slice(0, 10)}` : ""].filter(Boolean).join(" · ");
const snip = (s) => esc(s || "").replace(/\u0001/g, "<mark>").replace(/\u0002/g, "</mark>");
const when = (iso) => iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "never";
const KINDS = { note: "Note", journal: "Journal", course: "Course", file: "File", repo: "Code", commit: "Commit", decision: "Decision", wiki: "Wiki" };
const sourceHref = (r) => r.kind === "note" || r.kind === "journal" ? `#library/${r.source_id || r.id}` : `#sources/${r.source_id || r.id}`;
function needsWorker(v) {
  if (Sync && Sync.enabled) return false;
  v.innerHTML = `<div class="empty"><p style="max-width:56ch;margin:0 auto">The second brain lives on the Forge Worker (D1). Open Forge from <b>forge.matis-codjia.workers.dev</b> and sign in: sources, search and the context inspector appear here.</p></div>`;
  return true;
}

let srcQ = "", srcHits = null, srcSeq = 0;
VIEWS.sources = (v) => {
  if (needsWorker(v)) return;
  const id = routeArg(); if (id) return sourceView(v, id);
  v.innerHTML = `
  <section class="card"><div class="card-h"><h3>Search everything</h3><span class="muted" style="font-size:13px">Notes, courses, code and commits · local full-text search, nothing leaves the database</span></div>
    <input class="input" id="sq" type="search" placeholder="kalman_update, chain rule, attention scaling…" value="${esc(srcQ)}" autocomplete="off">
    <div id="shits" style="margin-top:12px"></div></section>
  <section class="grid g-2">
    <div class="card"><div class="card-h"><h3>Add a course or document</h3></div>
      <form id="up" class="stack" style="gap:10px">
        <label class="field"><span>PDF, slides exported as PDF, Markdown or text</span><input class="input" type="file" id="upf" accept=".pdf,.md,.markdown,.txt" required></label>
        <div class="row"><label class="field" style="flex:1 1 140px"><span>Project</span><input class="input" id="upp" placeholder="cs231n"></label>
        <label class="field" style="flex:1 1 180px"><span>AI visibility</span>${visSel("ai", 'id="upv"')}</label></div>
        <div class="row"><button class="btn primary" type="submit" id="upb">Upload</button><span class="faint" id="ups" style="font-size:13px">Text is extracted in this browser; only the text is sent.</span></div>
      </form></div>
    <div class="card"><div class="card-h"><h3>GitHub repositories</h3><span class="faint" id="ghtok" style="font-size:12px"></span></div>
      <form id="ra" class="row" style="flex-wrap:nowrap"><input class="input" id="rname" placeholder="owner/name or GitHub URL" required style="flex:2"><input class="input" id="rbr" placeholder="main" style="flex:1" aria-label="Branch"><button class="btn" type="submit">Add</button></form>
      <div id="repos" style="margin-top:12px"><div class="faint">Loading…</div></div></div>
  </section>
  <section class="card"><div class="card-h"><h3>Sources</h3><span class="muted" style="font-size:13px">Visibility applies to every chunk of a source. Change notes in the Library.</span></div><div id="slist" class="table-wrap"><div class="faint">Loading…</div></div></section>`;

  const drawHits = () => {
    const el = $("#shits"); if (!el) return;
    if (!srcQ.trim()) { el.innerHTML = ""; return; }
    if (!srcHits) { el.innerHTML = `<div class="faint">Searching…</div>`; return; }
    el.innerHTML = srcHits.length ? `<div class="next-list">${srcHits.map((h) => `<a class="next-item hit" href="${sourceHref(h)}"><span class="stack" style="gap:2px;min-width:0"><span class="row" style="gap:6px"><b>${esc(h.title)}</b><span class="pill">${KINDS[h.kind] || h.kind}</span>${visPill(h.visibility)}</span><span class="faint mono" style="font-size:12px">${esc(where(h.meta))}</span><span class="muted snip">${snip(h.snip)}</span></span></a>`).join("")}</div>` : `<div class="empty">No match.</div>`;
  };
  const runQ = async () => { const q = srcQ, n = ++srcSeq; srcHits = null; drawHits(); if (!q.trim()) return; try { const r = await api("GET", `/api/search?q=${encodeURIComponent(q)}`); if (n === srcSeq) { srcHits = r.results; drawHits(); } } catch (e) { fail(e); } };
  let qt = null; cleanup.push(() => clearTimeout(qt));
  $("#sq").oninput = (e) => { srcQ = e.target.value; clearTimeout(qt); qt = setTimeout(runQ, 220); };
  if (srcQ.trim()) runQ();

  const loadSources = async () => {
    const el = $("#slist"); if (!el) return;
    let rows; try { rows = await api("GET", "/api/sources"); } catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    if (!$("#slist")) return;
    el.innerHTML = rows.length ? `<table><thead><tr><th>Title</th><th>Kind</th><th>Project</th><th>Chunks</th><th>AI visibility</th><th></th></tr></thead><tbody>${rows.map((s) => `<tr><td><a href="${sourceHref(s)}">${esc(s.title || "Untitled")}</a></td><td>${KINDS[s.kind] || s.kind}</td><td class="muted">${esc(s.project || "—")}</td><td class="num">${s.chunks}</td><td>${s.kind === "note" || s.kind === "journal" ? visPill(s.visibility) : visSel(s.visibility, `data-svis="${s.id}"`)}</td><td>${s.kind === "note" || s.kind === "journal" ? "" : `<button class="x" data-sdel="${s.id}">Delete</button>`}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">Nothing yet. Upload a course, add a repository, or write notes in the Library: they sync here as searchable chunks.</div>`;
    $$("[data-svis]", el).forEach((s) => s.onchange = () => api("PATCH", `/api/sources/${s.dataset.svis}`, { visibility: s.value }).then(() => toast(s.value === "private" ? "Private: never sent to an AI." : "Visibility updated."), fail));
    $$("[data-sdel]", el).forEach((b) => b.onclick = () => { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "Confirm"; return; } api("DELETE", `/api/sources/${b.dataset.sdel}`).then(loadSources, fail); });
  };

  const loadRepos = async () => {
    const el = $("#repos"); if (!el) return;
    let rows; try { rows = await api("GET", "/api/repos"); } catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    if (!$("#repos")) return;
    el.innerHTML = rows.length ? `<div class="next-list">${rows.map((r) => `<div class="next-item repo"><span class="stack" style="gap:2px;flex:1 1 240px"><b class="mono" style="overflow-wrap:anywhere">${esc(r.full_name)}<span class="faint"> @${esc(r.branch)}</span></b><span class="faint" style="font-size:12px" data-rst="${r.id}">${r.files} files · ${r.chunks} chunks · synced ${when(r.synced_at)}${r.head_sha ? ` · ${r.head_sha.slice(0, 7)}` : ""}</span></span>${visSel(r.visibility, `data-rvis="${r.id}"`)}<button class="btn small" data-rsync="${r.id}">Sync</button><button class="x" data-rdel="${r.id}">Remove</button></div>`).join("")}</div>`
      : `<div class="faint" style="font-size:13px">Code is chunked by function and class, Markdown by heading. Re-syncing skips unchanged files.</div>`;
    $$("[data-rvis]", el).forEach((s) => s.onchange = () => api("PATCH", `/api/repos/${s.dataset.rvis}`, { visibility: s.value }).then(() => toast("Visibility applied to every file and commit."), fail));
    $$("[data-rdel]", el).forEach((b) => b.onclick = () => { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "Confirm"; return; } api("DELETE", `/api/repos/${b.dataset.rdel}`).then(loadRepos, fail); });
    $$("[data-rsync]", el).forEach((b) => b.onclick = async () => {
      const st = $(`[data-rst="${b.dataset.rsync}"]`); b.disabled = true; let n = 0, c = 0;
      try {
        for (let i = 0; i < 200; i++) {
          const r = await api("POST", `/api/repos/${b.dataset.rsync}/sync`, {});
          n += r.processed.length; c += r.commits;
          if (st) st.textContent = r.done ? "" : `Syncing… ${n} files indexed, ${r.remaining} to go`;
          if (r.done) { toast(n || c ? `Indexed ${n} changed file${n === 1 ? "" : "s"} and ${c} commit${c === 1 ? "" : "s"}.` : "Already up to date."); break; }
        }
      } catch (e) { fail(e); }
      b.disabled = false; loadRepos(); loadSources();
    });
  };

  $("#ra").onsubmit = (e) => { e.preventDefault(); api("POST", "/api/repos", { full_name: $("#rname").value, branch: $("#rbr").value.trim() || "main" }).then(() => { $("#rname").value = ""; loadRepos(); toast("Added. Press Sync to index it."); }, fail); };
  $("#up").onsubmit = async (e) => {
    e.preventDefault();
    const f = $("#upf").files[0]; if (!f) return;
    const st = $("#ups"), btn = $("#upb"); btn.disabled = true;
    try {
      st.textContent = "Extracting text…";
      const parts = /\.pdf$/i.test(f.name) ? await pdfPages(f, (i, n) => { st.textContent = `Reading page ${i}/${n}…`; }) : textParts(await f.text());
      if (!parts.some((p) => p.text.trim())) throw new Error("No text found. Scanned PDFs need OCR first.");
      const { id } = await api("POST", "/api/sources", { kind: "course", title: f.name.replace(/\.[^.]+$/, ""), origin: f.name, project: $("#upp").value.trim() || null, visibility: $("#upv").value });
      for (let i = 0; i < parts.length; i += 20) { st.textContent = `Uploading ${Math.min(parts.length, i + 20)}/${parts.length}…`; await api("POST", `/api/sources/${id}/parts`, { parts: parts.slice(i, i + 20) }); }
      toast(`${f.name}: ${parts.length} part${parts.length === 1 ? "" : "s"} indexed.`); location.hash = `#sources/${id}`;
    } catch (err) { fail(err); st.textContent = "Text is extracted in this browser; only the text is sent."; }
    btn.disabled = false;
  };
  api("GET", "/api/health").then((h) => { const el = $("#ghtok"); if (el) el.textContent = h.github ? "read-only token set" : "public repos only (no GITHUB_TOKEN)"; }, () => {});
  loadRepos(); loadSources();
};

function textParts(t) { const out = []; for (let i = 0; i < t.length; i += 150000) out.push({ text: t.slice(i, i + 150000), meta: {} }); return out.length ? out : [{ text: "", meta: {} }]; }
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
let pdfLib = null;
function loadPdf() {
  if (pdfLib) return pdfLib;
  pdfLib = new Promise((ok, ko) => { const s = document.createElement("script"); s.src = PDFJS + "pdf.min.js"; s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; ok(window.pdfjsLib); }; s.onerror = () => { pdfLib = null; ko(new Error("Couldn't load the PDF reader. Check your connection.")); }; document.head.appendChild(s); });
  return pdfLib;
}
/* One part per page; lines are rebuilt from the text items' vertical positions. */
async function pdfPages(file, onPage) {
  const lib = await loadPdf(), doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise, parts = [];
  for (let p = 1; p <= doc.numPages; p++) {
    onPage(p, doc.numPages);
    const tc = await (await doc.getPage(p)).getTextContent();
    let text = "", y = null;
    for (const it of tc.items) { const iy = it.transform ? it.transform[5] : y; if (y !== null && Math.abs(iy - y) > 2) text += "\n"; else if (text && !text.endsWith(" ")) text += " "; text += it.str; y = iy; if (it.hasEOL) { text += "\n"; y = null; } }
    parts.push({ text: text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(), meta: { page: p } });
  }
  return parts;
}

function sourceView(v, id) {
  v.innerHTML = `<div class="faint">Loading…</div>`;
  api("GET", `/api/sources/${encodeURIComponent(id)}`).then((s) => {
    if (route() !== "sources" || routeArg() !== id) return;
    document.title = `${s.title} · Forge`;
    const locked = s.kind === "note" || s.kind === "journal" || s.kind === "repo" || s.kind === "commit";
    v.innerHTML = `
    <nav class="crumbs"><a href="#sources">Sources</a><span>/</span><span>${esc(s.title)}</span></nav>
    <section class="card"><div class="row" style="justify-content:space-between">
      <div class="stack" style="gap:4px"><h3 style="margin:0">${esc(s.title)}</h3><span class="muted" style="font-size:13px">${KINDS[s.kind] || s.kind}${s.project ? ` · ${esc(s.project)}` : ""}${s.origin ? ` · ${esc(s.origin)}` : ""} · ${s.chunks.length} chunks · updated ${when(s.updated)}</span></div>
      <span class="row">${locked ? `${visPill(s.visibility)}<span class="faint" style="font-size:12px">${s.kind === "repo" || s.kind === "commit" ? "set on the repository" : "set in the Library"}</span>` : visSel(s.visibility, 'id="svis"')}</span></div></section>
    <section class="stack" style="gap:10px">${s.chunks.map((c) => `<article class="card chunk"><div class="row" style="justify-content:space-between"><span class="faint mono" style="font-size:12px">#${c.ord + 1} · ${esc(where(c.meta) || "—")}</span>${c.visibility !== s.visibility ? visPill(c.visibility) : ""}</div><pre>${esc(c.text)}</pre></article>`).join("") || `<div class="empty">No chunks.</div>`}</section>`;
    const sv = $("#svis"); if (sv) sv.onchange = () => api("PATCH", `/api/sources/${id}`, { visibility: sv.value }).then(() => { toast("Visibility applied to every chunk."); render(); }, fail);
  }, (e) => { v.innerHTML = `<div class="empty">${esc(e.message)}</div>`; });
}

VIEWS.context = (v) => {
  if (needsWorker(v)) return;
  v.innerHTML = `
  <section class="card"><div class="card-h"><h3>What the AI saw</h3></div>
    <p class="muted" style="margin:0;max-width:72ch">Every model call goes through one gate. It drops anything <b>private</b>, keeps <b>trusted</b> items for trusted providers only, redacts emails and phone numbers, and records here exactly which items left, to which provider, and why that provider was chosen.</p>
    <div class="row" style="gap:8px;margin-top:12px">${visPill("private")}<span class="faint" style="font-size:12px">never leaves</span>${visPill("trusted")}<span class="faint" style="font-size:12px">trusted providers</span>${visPill("ai")}<span class="faint" style="font-size:12px">any provider</span></div></section>
  <section class="card"><div class="card-h"><h3>Calls</h3><span class="muted" style="font-size:13px">Latest 100</span></div><div id="calls"><div class="faint">Loading…</div></div></section>`;
  api("GET", "/api/audit").then(({ calls }) => {
    const el = $("#calls"); if (!el) return;
    const dec = (d) => !d ? "" : d.action === "switched" ? `<span class="pill warn">switched from ${esc(d.from)}: ${esc(d.because)}</span>` : d.action === "excluded" ? `<span class="pill">${d.excluded.length} item${d.excluded.length === 1 ? "" : "s"} held back</span>` : `<span class="pill good">routed</span>`;
    el.innerHTML = calls.length ? `<div class="next-list">${calls.map((c) => `<details class="call"><summary><span class="num faint">${when(c.at)}</span><b>${esc(c.task)}</b><span class="pill mono">${esc(c.provider)} · ${esc(c.model || "")}</span>${dec(c.decision)}<span class="faint num" style="margin-left:auto;font-size:12px">${c.items.length} items · ${c.tokens_in ?? "?"}→${c.tokens_out ?? "?"} tok</span></summary>
      <div class="next-list" style="margin-top:8px">${c.items.map((it) => it.source_id ? `<a class="next-item ctx" href="${sourceHref(it)}"><span>${esc(it.title || it.id)}</span><span class="pill">${KINDS[it.kind] || it.kind || ""}</span>${visPill(it.visibility)}</a>` : `<div class="next-item ctx faint">${esc(it.id)} · deleted since</div>`).join("") || `<div class="faint">No context items.</div>`}</div></details>`).join("")}</div>`
      : `<div class="empty"><p style="max-width:56ch;margin:0 auto">No AI call yet. When the tutor, grader or wiki agent calls a model, each call appears here with the exact items it was given.</p></div>`;
  }, (e) => { const el = $("#calls"); if (el) el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; });
};

/* ---------------- proof loop: daily questions you can't fake ---------------- */
let proofDue = null; /* nav badge */
const refreshProof = () => { if (!(Sync && Sync.enabled)) return; api("GET", "/api/proof").then((s) => { proofDue = s.due.length; nav(); }, () => {}); };
let pf = null; /* answer in progress: { qid, text, started, typed, last, pasted } */
let pr = null; /* last graded result, shown until "Next" */
const scoreCls = (s) => s >= 70 ? "good" : s >= 50 ? "warn" : "bad";
const dueTxt = (d) => { const n = Math.round((Date.parse(d) - Date.parse(TODAY())) / 864e5); return n <= 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days (${d})`; };
VIEWS.proof = (v) => {
  if (needsWorker(v)) return;
  v.innerHTML = `<div class="faint">Loading…</div>`;
  api("GET", "/api/proof").then((s) => {
    if (route() !== "proof") return;
    proofDue = s.due.length; nav();
    const q = s.due[0];
    const kpis = `<section class="grid g-4">
      <div class="card kpi"><span class="eyebrow">Due today</span><b>${s.due.length}</b><span class="sub">${s.done.length} answered today</span></div>
      <div class="card kpi"><span class="eyebrow">Questions</span><b>${s.totals.questions}</b><span class="sub">one new a day from your sources</span></div>
      <div class="card kpi"><span class="eyebrow">Reviews</span><b>${s.totals.reviews}</b><span class="sub">${s.totals.pasted} pasted · never counted</span></div>
      <div class="card kpi"><span class="eyebrow">Next</span><b style="font-size:22px">${s.upcoming[0] ? esc(dueTxt(s.upcoming[0].due)) : "—"}</b><span class="sub">${s.upcoming[0] ? `${s.upcoming[0].n} question${s.upcoming[0].n === 1 ? "" : "s"}` : "nothing scheduled"}</span></div></section>`;
    let main;
    if (pr) {
      const m = pr.source.meta || {};
      main = `<section class="card review">
        <div class="row" style="justify-content:space-between"><span class="row" style="gap:8px"><span class="score ${scoreCls(pr.score)} num">${pr.score}</span>${pr.pasted ? `<span class="pill warn" title="Graded, but it never counts toward mastery">pasted · not counted</span>` : ""}</span><span class="muted" style="font-size:13px">Back ${esc(dueTxt(pr.due))}</span></div>
        <div class="md" style="margin-top:6px"><b>Question.</b> ${md(pr.prompt)}</div>
        <p style="margin:0"><b>Fix:</b> ${esc(pr.fix)}</p>
        <details open><summary class="eyebrow" style="cursor:pointer">Rubric</summary><div class="md">${md(pr.rubric)}</div></details>
        <div class="card chunk"><div class="row" style="justify-content:space-between"><b style="font-size:14px">${esc(pr.source.title || "Source")}</b>${pr.source.source_id ? `<a class="faint" style="font-size:13px" href="${sourceHref({ kind: pr.source.kind, source_id: pr.source.source_id })}">Open source →</a>` : ""}</div>
          ${pr.source.kind === "repo" || m.path ? `<pre>${esc(pr.source.text)}</pre>` : `<div class="md" style="margin-top:8px">${md(pr.source.text)}</div>`}</div>
        <div class="row" style="justify-content:flex-end"><button class="btn primary" id="pnext">${s.due.length ? `Next question (${s.due.length} left)` : "Done"} <kbd>Enter</kbd></button></div></section>`;
    } else if (q) {
      if (!pf || pf.qid !== q.id) pf = { qid: q.id, text: "", started: Date.now(), typed: 0, last: 0, pasted: false };
      main = `<section class="card review">
        <div class="row" style="justify-content:space-between"><span class="row" style="gap:6px"><span class="pill ${q.reps ? "acc" : "ember"}">${q.reps ? "review" : "new"}</span>${q.concept ? `<span class="pill">${esc(q.concept)}</span>` : ""}${q.project ? `<span class="pill">${esc(q.project)}</span>` : ""}</span><span class="muted num" id="ptimer" style="font-size:13px">00:00</span></div>
        <div class="rv-front md">${md(q.prompt)}</div>
        <textarea class="input proof-ans" id="pans" placeholder="Answer from memory. No notes, no search: this is the proof." spellcheck="true">${esc(pf.text)}</textarea>
        <div class="row" style="justify-content:space-between"><span class="faint" id="pflag" style="font-size:12px">${pf.pasted ? "Paste detected: it will be graded but won't count." : "Typing time is measured; pasted answers never count toward mastery."}</span>
          <span class="row"><button class="x" id="pret" title="Bad question? Remove it">Retire</button><button class="btn primary" id="psend">Grade <kbd>⌘ Enter</kbd></button></span></div></section>`;
    } else {
      main = `<section class="card"><div class="empty"><b style="color:var(--fg)">${s.done.length ? `Done for today: ${s.done.length} answered.` : "Nothing due."}</b><br>
        ${!s.ready ? "No AI provider is available on this deployment." : s.createdToday ? (s.canCreate ? "Today's question is answered. You can ask for another one." : "") : "Today's question hasn't been generated yet (the cron runs at 5:00)."}
        ${s.ready && s.canCreate ? `<div class="row" style="justify-content:center;margin-top:12px"><button class="btn ${s.createdToday ? "" : "primary"}" id="pgen">${s.createdToday ? "One more question" : "Generate today's question"}</button></div>` : ""}</div></section>`;
    }
    const hist = s.done.length ? `<section class="card"><div class="card-h"><h3>Today</h3></div><div class="next-list">${s.done.map((d) => `<div class="next-item ctx"><span class="score sm ${scoreCls(d.score)} num">${d.score}</span><span style="flex:1;min-width:0" class="md-inline">${inline(d.prompt.slice(0, 140))}</span>${d.pasted ? `<span class="pill warn">pasted</span>` : ""}<span class="faint" style="font-size:12px">${esc(dueTxt(d.due))}</span></div>`).join("")}</div></section>` : "";
    v.innerHTML = kpis + main + hist + `<section class="card" id="pmast"><div class="faint">Loading mastery…</div></section>`;
    math(v);
    masteryCard($("#pmast"));

    const nx = $("#pnext"); if (nx) { nx.onclick = () => { pr = null; render(); }; nx.focus({ preventScroll: true }); }
    const gen = $("#pgen"); if (gen) gen.onclick = () => { gen.disabled = true; gen.textContent = "Writing a question…"; api("POST", "/api/proof/generate", {}).then(() => render(), (e) => { fail(e); render(); }); };
    const ta = $("#pans");
    if (ta) {
      const tick = setInterval(() => { const t = $("#ptimer"); if (t) t.textContent = fmtClock(Date.now() - pf.started); }, 1000); cleanup.push(() => clearInterval(tick));
      const flag = () => { pf.pasted = true; $("#pflag").textContent = "Paste detected: it will be graded but won't count."; $("#pflag").className = "warn-txt"; };
      ta.addEventListener("paste", flag); ta.addEventListener("drop", flag);
      ta.addEventListener("beforeinput", (e) => { if (/^insertFrom(Paste|Drop)/.test(e.inputType || "")) flag(); });
      ta.addEventListener("input", () => { const t = Date.now(); if (pf.last) pf.typed += Math.min(2000, t - pf.last); pf.last = t; pf.text = ta.value; });
      const send = () => {
        if (!ta.value.trim()) return toast("Write an answer first.");
        const b = $("#psend"); b.disabled = true; b.textContent = "Grading…"; ta.readOnly = true;
        api("POST", `/api/proof/${q.id}/answer`, { answer: ta.value, typed_ms: pf.typed, elapsed_ms: Date.now() - pf.started, pasted: pf.pasted })
          .then((r) => { pr = { ...r, prompt: q.prompt }; pf = null; render(); }, (e) => { fail(e); b.disabled = false; b.textContent = "Grade"; ta.readOnly = false; if (e.message && /retired/.test(e.message)) { pf = null; render(); } });
      };
      $("#psend").onclick = send;
      ta.onkeydown = (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } };
      $("#pret").onclick = (e) => { if (!e.target.dataset.sure) { e.target.dataset.sure = 1; e.target.textContent = "Confirm retire"; return; } api("POST", `/api/proof/${q.id}/retire`, {}).then(() => { pf = null; render(); }, fail); };
      if (!pf.text) ta.focus();
    }
    const key = (e) => { if (pr && e.key === "Enter" && document.activeElement.tagName !== "TEXTAREA") { e.preventDefault(); pr = null; render(); } };
    document.addEventListener("keydown", key); cleanup.push(() => document.removeEventListener("keydown", key));
  }, (e) => { v.innerHTML = `<div class="empty">${esc(e.message)}</div>`; });
};

const TRACK_NAME = Object.fromEntries(C.tracks.map((t) => [t.k, t.t]));
/** Mastery from reviews only: last non-pasted score × probability of recall today. */
function masteryCard(el, { compare = false } = {}) {
  if (!el) return;
  api("GET", "/api/proof/mastery").then((m) => {
    if (!el.isConnected) return;
    const bar = (x) => x == null ? `<span class="faint">unproven</span>` : `<span class="row" style="gap:8px;flex-wrap:nowrap"><span class="progress" style="width:110px"><i style="width:${x}%"></i></span><span class="num">${x}%</span></span>`;
    if (compare) {
      const rows = C.tracks.map((t) => { const g = m.tracks.find((x) => x.key === t.k), self = Math.round(((S.skills[t.k] || 0) / 5) * 100); const gap = g && g.mastery != null && g.proven >= 2 ? self - g.mastery : null; return { t, g, self, gap }; });
      el.innerHTML = `<div class="card-h"><h3>Measured vs self-rated</h3><span class="muted" style="font-size:13px">Measured = Proof reviews only (pasted answers excluded). Gaps of 35+ points are flagged.</span></div>
        <div class="table-wrap"><table><thead><tr><th>Track</th><th>Self-rated</th><th>Measured</th><th>Proven</th><th></th></tr></thead><tbody>${rows.map(({ t, g, self, gap }) => `<tr${gap != null && Math.abs(gap) >= 35 ? ' class="gap"' : ""}><td>${esc(t.t)}</td><td>${bar(self)}</td><td>${bar(g ? g.mastery : null)}</td><td class="num muted">${g ? `${g.proven}/${g.questions}` : "0"}</td><td>${gap == null ? "" : gap >= 35 ? `<span class="pill warn">overrated by ${gap}</span>` : gap <= -35 ? `<span class="pill good">underrated by ${-gap}</span>` : ""}</td></tr>`).join("")}</tbody></table></div>`;
      return;
    }
    if (!m.questions.length) { el.innerHTML = `<div class="card-h"><h3>Mastery</h3></div><div class="empty">Answer your first question: mastery per concept and project is built only from reviews.</div>`; return; }
    const tbl = (rows, name) => `<table><thead><tr><th>${name}</th><th>Mastery</th><th>Proven</th></tr></thead><tbody>${rows.map((g) => `<tr><td>${esc(name === "Track" ? TRACK_NAME[g.key] || g.key : g.key)}</td><td>${bar(g.mastery)}</td><td class="num muted">${g.proven}/${g.questions}${g.pasted ? ` · ${g.pasted} pasted` : ""}</td></tr>`).join("")}</tbody></table>`;
    el.innerHTML = `<div class="card-h"><h3>Mastery</h3><span class="muted" style="font-size:13px">Last honest score × chance you still remember it today</span></div>
      <div class="grid g-2"><div class="table-wrap">${tbl(m.concepts.slice(0, 15), "Concept")}</div><div class="table-wrap">${tbl(m.projects, "Project")}${tbl(m.tracks, "Track")}</div></div>`;
  }, (e) => { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; });
}

/* ---------------- command palette (⌘K / Ctrl K / "/") ---------------- */
const Palette = {
  el: null, sel: 0, list: [],
  isOpen() { return !!this.el; },
  items() {
    const go = (h) => () => { location.hash = h; };
    return [].concat(
      ROUTES.map(([k, t, g]) => ({ t, sub: g || "Page", run: go("#" + k) })),
      [{ t: "New note", sub: "Action", run: () => { const n = newNote(); location.hash = `#library/${n.id}`; } },
       { t: "Log a session", sub: "Action", run: go("#log") },
       { t: "Journal entry", sub: "Action · private", run: () => { const n = newNote({ kind: "journal", title: `Journal ${TODAY()}`, tags: ["journal"], visibility: "private" }); location.hash = `#library/${n.id}`; } },
       { t: "Search the second brain", sub: "Action", run: go("#sources") },
       { t: "Review due cards", sub: "Action", run: go("#review") },
       { t: "Answer today's proof questions", sub: "Action", run: go("#proof") },
       { t: "Export backup", sub: "Action", run: () => $("#exportBtn").click() },
       { t: "Import backup", sub: "Action", run: () => $("#importFile").click() },
       { t: "Switch theme", sub: "Action", run: () => $("#themeBtn").click() }],
      C.modules.map((m) => ({ t: m.t, sub: `Path · ${stageOf(m).t}`, run: go(`#path/${m.id}`) })),
      S.notes.map((n) => ({ t: n.title || "Untitled", sub: `Note${(n.tags || []).length ? " · #" + n.tags.join(" #") : ""}`, body: n.body, run: go(`#library/${n.id}`) })),
      C.problems.map((p) => ({ t: p.pattern, sub: `Arena · ${p.fn}()`, run: () => { S.sel = p.id; save(); location.hash = "#arena"; if (route() === "arena") render(); } })),
      C.modules.flatMap((m) => m.res.filter((r) => /^https?:/.test(r[2])).map((r) => ({ t: r[1], sub: `${KIND[r[0]] || r[0]} · ${m.t}`, run: () => window.open(r[2], "_blank", "noopener") })))
    );
  },
  open(q = "") {
    if (this.el) return;
    this.el = document.createElement("div"); this.el.className = "pal-back";
    this.el.innerHTML = `<div class="pal" role="dialog" aria-modal="true" aria-label="Search"><div class="pal-in">${icon("search")}<input id="palq" placeholder="Search pages, modules, notes, papers…" autocomplete="off" spellcheck="false"><kbd>esc</kbd></div><div class="pal-list" id="pall" role="listbox"></div></div>`;
    document.body.appendChild(this.el);
    const inp = $("#palq"); inp.value = q; inp.focus();
    const all = this.items();
    const draw = () => {
      const s = inp.value.trim().toLowerCase(), toks = s.split(/\s+/).filter(Boolean);
      this.list = (toks.length ? all.filter((it) => { const h = (it.t + " " + it.sub + " " + (it.body || "")).toLowerCase(); return toks.every((t) => h.includes(t)); }).sort((a, b) => (b.t.toLowerCase().startsWith(s) - a.t.toLowerCase().startsWith(s)) || (b.t.toLowerCase().includes(s) - a.t.toLowerCase().includes(s))) : all.slice(0, ROUTES.length + 4)).slice(0, 40);
      this.sel = Math.min(this.sel, Math.max(0, this.list.length - 1));
      $("#pall").innerHTML = this.list.length ? this.list.map((it, i) => `<button class="pal-it" role="option" data-i="${i}" aria-selected="${i === this.sel}"><span>${esc(it.t)}</span><span class="faint">${esc(it.sub)}</span></button>`).join("") : `<div class="faint" style="padding:14px">No match.</div>`;
      const a = $(".pal-it[aria-selected=true]"); a && a.scrollIntoView({ block: "nearest" });
    };
    inp.oninput = () => { this.sel = 0; draw(); };
    inp.onkeydown = (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); this.sel = Math.min(this.list.length - 1, this.sel + 1); draw(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); this.sel = Math.max(0, this.sel - 1); draw(); }
      else if (e.key === "Enter") { e.preventDefault(); this.pick(this.sel); }
      else if (e.key === "Escape") { e.preventDefault(); this.close(); }
    };
    this.el.onclick = (e) => { const b = e.target.closest(".pal-it"); if (b) this.pick(+b.dataset.i); else if (e.target === this.el) this.close(); };
    draw();
  },
  pick(i) { const it = this.list[i]; this.close(); if (it) it.run(); },
  close() { if (this.el) { this.el.remove(); this.el = null; } }
};
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); Palette.isOpen() ? Palette.close() : Palette.open(""); return; }
  const a = document.activeElement;
  if (e.key === "/" && !Palette.isOpen() && !(a && (/INPUT|TEXTAREA|SELECT/.test(a.tagName) || a.isContentEditable || a.closest(".CodeMirror")))) { e.preventDefault(); Palette.open(""); }
});

/* ---------------- boot ---------------- */
applyTheme();
render();
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}
if (Sync) {
  Sync.detect().then((ok) => { if (ok) { Sync.sync(); refreshProof(); if (["sources", "context", "proof", "skills"].includes(route())) render(); } });
  setInterval(() => { if (!document.hidden && Sync.status !== "local") Sync.sync(); }, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) Sync.sync(); });
  window.addEventListener("online", () => Sync.sync());
}
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
document.addEventListener("visibilitychange", () => { if (!document.hidden && ["dashboard", "today"].includes(route())) render(); });
})();
