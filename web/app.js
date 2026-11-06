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
  ["now", "Now", ""], ["today", "Today", ""],
  ["path", "Path", "Learn"], ["library", "Library", "Learn"], ["review", "Review", "Learn"], ["proof", "Proof", "Learn"],
  ["arena", "Arena", "Practice"], ["diagnostic", "Diagnostic", "Practice"],
  ["log", "Log", "Track"], ["skills", "Skills", "Track"], ["scorecard", "Scorecard", "Track"], ["pipeline", "Pipeline", "Track"], ["rules", "Rules", "Track"],
  ["sources", "Sources", "Brain"], ["context", "Context", "Brain"]
];
const TOP = ["now", "path", "arena", "proof", "review", "library", "skills", "log"];
const MOBILE = ["now", "arena", "proof", "review"];
const NB = () => C.blocks.length; /* blocks per day */
const BANK = 3;                  /* observed blocks needed to bank a day */

/* ---------------- state ---------------- */
const KEY = "forge.v1";
const blank = () => ({ v: 2, days: {}, weeks: {}, practice: {}, code: {}, drills: {}, activity: {}, ctx: null, tutor: {}, mocks: [], theory: [], skills: {}, pipeline: [], mock: null, theoryRun: null, sel: "two-sum", drillSel: null, arenaCol: "ml", theme: null,
  path: {}, notes: [], srs: {}, revDays: {}, log: [], lastExport: null });
const hydrate = (d) => { const x = Object.assign(blank(), d || {}); ["notes", "log", "mocks", "theory", "pipeline"].forEach((k) => { if (!Array.isArray(x[k])) x[k] = []; }); ["path", "srs", "revDays", "days", "weeks", "practice", "code", "skills", "drills", "activity"].forEach((k) => { if (!x[k] || typeof x[k] !== "object" || Array.isArray(x[k])) x[k] = {}; }); x.v = 2; return x; };
let S;
try { S = hydrate(JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { S = blank(); }
let saveT = null;
const flush = () => { clearTimeout(saveT); saveT = null; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("Couldn't save: browser storage is full or blocked. Export a backup now."); } schedSync(); };

/* Cloud sync (only when served by the Forge Worker; on any other host Forge stays local-only). */
let syncT = null;
const schedSync = (ms = 1500) => { if (!Sync || !Sync.enabled) return; clearTimeout(syncT); syncT = setTimeout(() => { syncT = null; Sync.sync(); }, ms); };
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
/* Observed day: every block is detected from what happened, never ticked by hand. */
const ACT = (d = TODAY()) => S.activity[d] || (S.activity[d] = { pass: 0, min: {}, recall: 0, cleared: false, checks: 0 });
let commitDays = {}; try { commitDays = JSON.parse(localStorage.getItem("forge.commits") || "{}"); } catch (e) {}
let checkProofs = {}, todayPlan = null;
const modFocusMin = (d) => { const a = S.activity[d]; return a ? Object.entries(a.min || {}).reduce((x, [k, v]) => x + (k.startsWith("mod:") ? v : 0), 0) : 0; };
function observed(d) { const a = S.activity[d] || {}; return { code: (a.pass || 0) > 0, fund: modFocusMin(d) >= 25 || (a.checks || 0) > 0, ship: (commitDays[d] || 0) > 0, recall: (a.recall || 0) > 0 && !!a.cleared }; }
const dayCount = (k) => { const o = observed(k); return C.blocks.filter((b) => o[b.k]).length; };
function streak() { let n = 0, d = now(); if (dayCount(ymd(d)) < BANK) d = addDays(d, -1); while (dayCount(ymd(d)) >= BANK) { n++; d = addDays(d, -1); } return n; }
const patLevel = (pid) => { const p = S.practice[pid]; if (!p) return 0; if (p.timed) return 3; if (p.solved) return 2; return p.attempts ? 1 : 0; };
const lastMock = () => S.mocks[S.mocks.length - 1];
const daysLeft = () => { const t = new Date(C.start + "T00:00:00"); const d = new Date(TODAY() + "T00:00:00"); return Math.max(0, Math.round((t - d) / 864e5)); };
const theoryBest = (id) => { const xs = S.theory.filter((t) => t.part === id).map((t) => t.score); return xs.length ? Math.max(...xs) : null; };
const theoryLast = (id) => { const xs = S.theory.filter((t) => t.part === id); return xs.length ? xs[xs.length - 1].score : null; };

/* ---------------- shell ---------------- */
function nav() {
  const r = route(), rq = SRS.queue(), due = rq.due.length + rq.fresh.length;
  const badge = { review: due ? String(due) : "", proof: proofDue ? String(proofDue) : "" };
  const name = (k) => ROUTES.find((x) => x[0] === k)[1];
  $("#nav").innerHTML = TOP.map((k) => `<a href="#${k}" ${k === r ? 'aria-current="page"' : ""}>${name(k)}${badge[k] ? `<span class="badge">${badge[k]}</span>` : ""}</a>`).join("")
    + (TOP.includes(r) ? "" : `<a href="#${r}" aria-current="page">${name(r)}</a>`);
  $("#bottombar").innerHTML = MOBILE.map((k) => `<a href="#${k}" ${k === r ? 'aria-current="page"' : ""}><span>${name(k)}${badge[k] ? ` ${badge[k]}` : ""}</span></a>`).join("") + `<button type="button" id="moreBtn" ${MOBILE.includes(r) ? "" : 'aria-current="page"'}><span>More</span></button>`;
  $("#moreBtn").onclick = () => Palette.open("");
  $("#sideStreak").textContent = streak();
  $("#heatStrip").innerHTML = heatStrip(56);
  const n = dayCount(TODAY()); $("#todayNote").innerHTML = `today <b>${n} / ${NB()}</b>`;
  if (n >= NB()) dayDone();
  const be = $("#backupNote"); if (be) { const d = S.lastExport ? Math.floor((Date.now() - S.lastExport) / 864e5) : null; const hasData = S.notes.length || S.log.length || Object.keys(S.days).length; const synced = Sync && Sync.enabled; be.textContent = synced ? "" : d == null ? (hasData ? "no backup yet" : "") : d === 0 ? "backed up today" : `last backup ${d}d ago`; be.className = "backup-note " + (!synced && ((d == null && hasData) || d > 7) ? "stale" : ""); }
}
const parseHash = () => { let [h, ...rest] = (location.hash || "#now").slice(1).split("/"); if (h === "dashboard") h = "now"; return { r: ROUTES.some((x) => x[0] === h) ? h : "now", arg: rest.length ? decodeURIComponent(rest.join("/")) : null }; };
const route = () => parseHash().r;
const routeArg = () => parseHash().arg;
let cleanup = [];
function render() {
  cleanup.forEach((f) => f()); cleanup = [];
  const r = route();
  $("#pageTitle").textContent = ROUTES.find((x) => x[0] === r)[1];
  document.title = `${ROUTES.find((x) => x[0] === r)[1]} · Forge`;
  $("#pageDate").textContent = `${now().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · ${daysLeft()} days to March`;
  $("#topAction").innerHTML = "";
  document.body.classList.toggle("fullbleed", r === "now" || r === "arena");
  document.body.classList.toggle("is-now", r === "now");
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
function applyTheme() { if (S.theme) document.documentElement.setAttribute("data-theme", S.theme); else document.documentElement.removeAttribute("data-theme"); $("#themeBtn").textContent = S.theme ? `theme: ${S.theme}` : "theme: system"; const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#0F0E0C"; }
window.addEventListener("scroll", () => $("#top").classList.toggle("scrolled", scrollY > 4), { passive: true });
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
function lineChart(points, { h = 200, target = 80 } = {}) {
  const W = 640, H = h, L = 34, R = 14, T = 16, B = 26;
  if (!points.length) return "";
  const x = (i) => L + (points.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (points.length - 1));
  const y = (v) => T + ((100 - v) * (H - T - B)) / 100;
  let g = "";
  [0, 25, 50, 75, 100].forEach((v) => { g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`; });
  g += `<line x1="${L}" x2="${W - R}" y1="${y(target)}" y2="${y(target)}" stroke="var(--mute)" stroke-width="1" stroke-dasharray="3 4"/><text x="${W - R}" y="${y(target) - 6}" text-anchor="end">target ${target}</text>`;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.v)}`).join(" ");
  const step = Math.max(1, Math.ceil(points.length / 8));
  const labels = points.map((p, i) => (i % step === 0 || i === points.length - 1) ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${esc(p.l)}</text>` : "").join("");
  const last = points[points.length - 1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Score over time">${g}<path d="${line}" fill="none" stroke="var(--fg)" stroke-width="2" stroke-linejoin="round"/>${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.v)}" r="4" fill="var(--fg)" stroke="var(--bg)" stroke-width="2"/><circle cx="${x(i)}" cy="${y(p.v)}" r="12" fill="transparent" data-tip="${esc(`${p.l}\n${p.v}/100`)}"/>`).join("")}<text x="${x(points.length - 1)}" y="${y(last.v) - 12}" text-anchor="middle" style="fill:var(--fg)">${last.v}</text>${labels}</svg>`;
}
/* Consistency heat: the only orange in Forge. Same levels everywhere (grid on Now, strip in the status bar). */
const heatLv = (n) => n <= 0 ? 0 : Math.min(5, 1 + Math.round(((n - 1) / Math.max(1, NB() - 1)) * 4));
const heatTip = (k) => `${k}\n${dayCount(k)}/${NB()} blocks · ${fmtH(dayMin(k))} h logged`;
function heatGrid(weeks = 26, cell = 9, gap = 3) {
  const end = now(), start = addDays(end, -((weeks - 1) * 7 + ((end.getDay() + 6) % 7))); let g = "", i = 0;
  for (let d = new Date(start); d <= end; d = addDays(d, 1), i++) {
    const k = ymd(d), x = Math.floor(i / 7) * (cell + gap), y = (i % 7) * (cell + gap);
    g += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="1.5" fill="var(--h${heatLv(dayCount(k))})" data-tip="${esc(heatTip(k))}"/>`;
    if (k === TODAY()) g += `<rect x="${x - 2}" y="${y - 2}" width="${cell + 4}" height="${cell + 4}" rx="2.5" fill="none" stroke="var(--fg)" stroke-width="1"/>`;
  }
  return `<svg width="${weeks * (cell + gap)}" height="${7 * (cell + gap)}" role="img" aria-label="Blocks done per day, last ${weeks} weeks">${g}</svg>`;
}
function heatStrip(n = 56, w = 4, gap = 1.5, h = 10) {
  let g = ""; for (let i = 0; i < n; i++) { const k = ymd(addDays(now(), i - n + 1)); g += `<rect x="${i * (w + gap)}" y="0" width="${w}" height="${h}" rx="1" fill="var(--h${heatLv(dayCount(k))})" data-tip="${esc(heatTip(k))}"/>`; }
  return `<svg width="${n * (w + gap)}" height="${h}">${g}</svg>`;
}

/* ---------------- knowledge helpers ---------------- */
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const fmtH = (min) => { const h = min / 60; return h >= 10 ? String(Math.round(h)) : h.toFixed(1).replace(/\.0$/, ""); };
const noteById = (id) => S.notes.find((n) => n.id === id);
const noteByTitle = (t) => { const k = String(t).trim().toLowerCase(); return S.notes.find((n) => (n.title || "").trim().toLowerCase() === k); };
const newNote = (o = {}) => { const n = Object.assign({ id: uid(), title: "Untitled", body: "", tags: [], mod: null, visibility: "ai", created: Date.now(), updated: Date.now() }, o); S.notes.unshift(n); save(); return n; };
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
    S.srs[id] = this.next(S.srs[id], g); ACT().recall++;
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
/* A module's state comes from evidence: its exit checks proven in Proof, a proof link, time spent on it. */
const ckey = (m, i) => `${m.id}#${i}`;
const checkProven = (m, i) => !!(checkProofs[ckey(m, i)] && checkProofs[ckey(m, i)].proven);
const modProvenN = (m) => m.checks.filter((_, i) => checkProven(m, i)).length;
const modStatus = (id) => { const m = C.modules.find((x) => x.id === id); if (!m) return "todo"; const p = S.path[id] || {}; if (modProvenN(m) === m.checks.length && p.proof) return "done"; return modMin(id) > 0 || modProvenN(m) || p.proof ? "active" : "todo"; };
const modsDone = () => C.modules.filter((m) => modStatus(m.id) === "done").length;
const modProgress = (m) => (modProvenN(m) + (S.path[m.id] && S.path[m.id].proof ? 1 : 0)) / (m.checks.length + 1);
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

/* One thing at a time: the most important open block of the day, J skips, Enter goes. */
const DR = window.DRILLS || [];
const drillSt = (id) => (S.drills && S.drills[id]) || null;
const DRILL_MIN = { 1: 10, 2: 15, 3: 25, 4: 40 };
function nextDrill() {
  const open = DR.filter((d) => !(drillSt(d.id) || {}).solved);
  const touched = open.filter((d) => drillSt(d.id)).sort((a, b) => String(drillSt(b.id).last || "").localeCompare(String(drillSt(a.id).last || "")));
  return touched[0] || open[0] || null;
}
function nowItems() {
  const d = S.days[TODAY()] || {}, out = [], q = SRS.queue(), due = q.due.length + q.fresh.length;
  const o = observed(TODAY()), planDrill = todayPlan && DR.find((x) => x.id === todayPlan.drill && !(drillSt(x.id) || {}).solved), planMod = todayPlan && modById(todayPlan.module);
  if (!o.code) {
    const dr = planDrill || nextDrill();
    if (dr) { const st = drillSt(dr.id); out.push({ href: `#arena/${dr.id}`, kick: `Arena · ML from scratch · ${pad(DR.indexOf(dr) + 1)} / ${DR.length}`, h: `${esc(dr.title)}, <em>from a blank file.</em>`, meta: ["numpy", `~${DRILL_MIN[dr.lvl]} min`, st && st.attempts ? `last try ${st.best || 0} / ${st.total || "?"} tests` : "not tried yet"], go: "Start coding", later: [dr.title, `arena · ~${DRILL_MIN[dr.lvl]} min`] }); }
  }
  if (!o.fund) {
    const m = planMod && modStatus(planMod.id) !== "done" ? planMod : nextMod();
    if (m) { const stg = stageOf(m); out.push({ href: `#path/${m.id}`, kick: `Path · stage ${C.stages.indexOf(stg)} · ${areaOf(stg.area).t}`, h: `${esc(m.t)}, <em>rebuilt from a blank file.</em>`, meta: [`~${m.hrs} h`, `${fmtH(modMin(m.id))} h logged`, `${Math.round(modProgress(m) * 100)}% done`], go: modStatus(m.id) === "active" ? "Continue" : "Start", later: [m.t, `path · ${fmtH(modMin(m.id))} / ${m.hrs} h`] }); }
  }
  if (proofDue) out.push({ href: "#proof", kick: `Proof · ${proofDue} due`, h: `${proofDue} question${proofDue === 1 ? "" : "s"} from your own sources, <em>answered from memory.</em>`, meta: ["~3 min each", "pasted answers never count"], go: "Answer", later: [`${proofDue} proof question${proofDue === 1 ? "" : "s"}`, "proof · ~3 min each"] });
  if (due) out.push({ href: "#review", kick: `Review · ${due} cards`, h: `${due} card${due === 1 ? "" : "s"}, <em>recall before you read.</em>`, meta: [`${q.due.length} due`, `${q.fresh.length} new`], go: "Review", later: [`${due} card${due === 1 ? "" : "s"} to review`, "review"] });
  if (!o.ship) out.push({ href: "#sources", kick: "Ship · no commit today", h: `One real commit, <em>pushed to a synced repository.</em>`, meta: ["ROUILLE, SENTINEL or the ISBI work", "detected from GitHub"], go: "Repositories", later: ["Ship a commit", "detected from GitHub"] });
  return out;
}
let nowSkip = 0;
VIEWS.now = (v) => {
  const items = nowItems(), n = dayCount(TODAY()), d = observed(TODAY());
  if (nowSkip >= items.length) nowSkip = 0;
  const cur = items[nowSkip], rest = items.filter((_, i) => i !== nowSkip).slice(0, 4);
  const main = cur ? `<section>
      <div class="kicker eyebrow">${esc(cur.kick)}</div>
      <h2>${cur.h}</h2>
      <div class="meta m">${cur.meta.map((x) => `<span>${esc(x)}</span>`).join("")}</div>
      ${todayPlan && todayPlan.why && nowSkip === 0 ? `<p class="m muted" style="margin-top:18px;max-width:62ch">planner · ${esc(todayPlan.why)}</p>` : ""}
      <div class="go"><a class="btn primary big" href="${cur.href}" id="nowGo">${cur.go} <kbd>↵</kbd></a>${items.length > 1 ? `<span class="m muted">or <kbd>J</kbd> skip to the next thing</span>` : ""}</div></section>`
    : `<section><div class="kicker eyebrow">Today · ${n} / ${NB()} blocks</div><h2>${n >= BANK ? "Today is banked, <em>rest is part of the plan.</em>" : "Nothing pressing, <em>pick a block or rest.</em>"}</h2><div class="go"><a class="btn big" href="#today" id="nowGo">Today's blocks <kbd>↵</kbd></a></div></section>`;
  const later = rest.length ? `<aside class="later m"><h4>LATER TODAY</h4>${rest.map((x) => `<a href="${x.href}"><b>${esc(x.later[0])}</b><span>${esc(x.later[1])}</span></a>`).join("")}</aside>` : "<aside></aside>";
  v.innerHTML = `<div class="now"><div class="now-main">${main}${later}</div>
    <footer class="now-foot"><div class="streak">${streak()}<small>day streak</small></div><div class="heatwrap">${heatGrid(26)}</div><div></div>
      <a href="#today" style="text-decoration:none"><div class="m muted" style="text-align:right;margin-bottom:9px">today ${n} / ${NB()} blocks</div><div class="dayblocks">${C.blocks.map((b) => `<i class="${d[b.k] ? "on" : ""}" data-tip="${esc(b.t)}${d[b.k] ? "\ndone" : ""}"></i>`).join("")}</div></a></footer></div>`;
  const key = (e) => {
    if (Palette.isOpen() || e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (e.key === "Enter") { e.preventDefault(); location.hash = $("#nowGo").getAttribute("href"); }
    else if ((e.key === "j" || e.key === "J") && items.length > 1) { e.preventDefault(); nowSkip = (nowSkip + 1) % items.length; render(); }
  };
  document.addEventListener("keydown", key); cleanup.push(() => document.removeEventListener("keydown", key));
};

/* ---- today: what Forge saw happen ---- */
function blockEvidence(k, d) {
  const a = S.activity[d] || {};
  if (k === "code") return a.pass ? `${a.pass} full pass${a.pass === 1 ? "" : "es"} in the Arena` : "no exercise fully passing yet";
  if (k === "fund") { const mn = Math.round(modFocusMin(d)); return a.checks ? `${a.checks} exit check${a.checks === 1 ? "" : "s"} proven · ${mn} min on modules` : `${mn} / 25 active min on a module`; }
  if (k === "ship") return commitDays[d] ? `${commitDays[d]} commit${commitDays[d] === 1 ? "" : "s"}` : Sync && Sync.enabled ? "no commit seen yet (repositories sync on open)" : "needs the Forge Worker (GitHub sync)";
  if (k === "recall") return `${a.recall || 0} answered${a.cleared ? " · nothing left due" : (a.recall ? " · still due" : "")}`;
  return "";
}
VIEWS.today = (v) => {
  const t = TODAY(), o = observed(t), n = dayCount(t), act = S.activity[t] || { min: {} };
  const mins = Object.entries(act.min || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  v.innerHTML = `
  <section><div class="eyebrow">${n} / ${NB()} blocks · ${n >= BANK ? "day banked" : `${BANK - n} more to bank the day`} · ${streak()}-day streak</div>
    <p class="muted" style="margin-top:8px;max-width:70ch">Nothing to tick: each block is detected from what you did. Arena runs, time on a module and its notes, proven exit checks, GitHub commits, Proof and Review answers.</p></section>
  <section class="blocks">${C.blocks.map((b) => `<div class="block ${o[b.k] ? "done" : ""}"><span class="tick"></span><span class="meta">${o[b.k] ? "done" : "open"}</span><h3>${esc(b.t)}</h3><p>${esc(b.d)}</p><span class="meta">${esc(blockEvidence(b.k, t))}</span></div>`).join("")}</section>
  <section class="card"><div class="card-h"><h3>Active time today</h3><span class="muted">counted while Forge is in front and you type, scroll or click</span></div>
    ${mins.length ? `<div class="next-list">${mins.map(([k, m]) => `<div class="next-item"><span class="dot"></span><span>${esc(timeLabel(k))}</span><span class="pill num">${Math.round(m)} min</span></div>`).join("")}</div>` : `<div class="empty">No active time yet today.</div>`}</section>`;
};
const timeLabel = (k) => { const [kind, id] = k.split(":"); if (kind === "mod") return `Path · ${(modById(id) || { t: id }).t}`; if (kind === "drill") return `Arena · ${(DR.find((d) => d.id === id) || { title: id }).title}`; if (kind === "pat") return `Arena · ${(C.problems.find((p) => p.id === id) || { pattern: id }).pattern}`; return { proof: "Proof questions", review: "Review cards", notes: "Notes", diag: "Diagnostic" }[kind] || k; };

/* ---- runner (Pyodide in a worker) ---- */
let TESTS = null;
const testsReady = fetch("tests.json").then((r) => r.json()).then((d) => { TESTS = Object.fromEntries(d.map((p) => [p.id, p])); return TESTS; }).catch(() => null);
const Runner = {
  w: null, ready: false, np: false, pending: new Map(), seq: 0, status: "idle", onStatus: null,
  set(s) { this.status = s; this.onStatus && this.onStatus(); },
  boot() {
    if (this.w) return;
    this.set("loading");
    this.w = new Worker("worker.js");
    this.w.onmessage = (e) => {
      const m = e.data;
      if (m.type === "ready") { this.ready = true; this.set("numpy"); }
      else if (m.type === "numpy") { this.np = true; this.set("ready"); }
      else if (m.type === "fatal") this.set("failed");
      else if (m.type === "result") { const p = this.pending.get(m.id); if (p) { clearTimeout(p.t); this.pending.delete(m.id); p.res(m.data); } }
    };
    this.w.onerror = () => this.set("failed");
  },
  run(payload) {
    this.boot();
    return new Promise((res) => {
      const id = ++this.seq, limit = payload.kind === "drill" ? 20000 : 10000;
      const arm = () => setTimeout(() => { this.pending.delete(id); this.w.terminate(); this.w = null; this.ready = this.np = false; this.set("idle"); res({ error: `Time limit exceeded (${limit / 1000} s). Check for an infinite loop or a Python loop over a big axis.` }); }, limit);
      const entry = { res, t: null }; this.pending.set(id, entry);
      const go = () => payload.kind === "drill" ? this.np : this.ready;
      const start = () => { entry.t = arm(); this.w.postMessage(Object.assign({ id }, payload)); };
      if (go()) start(); else { const wait = setInterval(() => { if (go()) { clearInterval(wait); start(); } else if (this.status === "failed") { clearInterval(wait); this.pending.delete(id); res({ error: "Python couldn't load. Check your connection and reload the page." }); } }, 100); }
    });
  }
};
const RUNNER_TXT = { idle: "python loads on first run", loading: "loading python…", numpy: "loading numpy…", ready: "python 3.12 ready", failed: "python failed to load" };

/* ---- arena: one exercise, one editor, tests on the left, output below, a tutor that never gives the answer ---- */
let cm = null, pickOpen = false, pickCol = null, tutorOpen = false;
const lastRun = {};
/* Tutor conversations persist (synced) so they survive reloads; the server keeps them per day for the planner. */
const tutorOf = (id) => { const T = S.tutor = S.tutor || {}; return (T[id] = T[id] || []); };
const parseTests = (src) => [...String(src).matchAll(/^def (test_\w+)\(u\):[ \t]*\n[ \t]*(?:"""([^"]*)""")?/gm)].map((m) => ({ name: m[1], label: (m[2] || m[1].slice(5).replace(/_/g, " ")).trim().split("\n")[0] }));
function starter(p) { return `${p.sig}\n    # 1. Restate the problem. 2. Brute force + complexity. 3. Optimise.\n    pass\n`; }
function examplesFor(p) {
  if (!TESTS || !TESTS[p.id]) return "";
  return TESTS[p.id].cases.slice(0, 2).map((c) => `<div class="ex">in   ${esc(JSON.stringify(c.args).slice(1, -1))}\nout  ${esc(JSON.stringify(c.expected))}</div>`).join("");
}
/** The exercise on screen: a drill (ML from scratch) or an interview pattern. */
function arenaItem() {
  const arg = routeArg();
  if (S.mock) { const list = C.problems.filter((p) => S.mock.ids.includes(p.id)); if (arg && S.mock.ids.includes(arg)) S.sel = arg; if (!S.mock.ids.includes(S.sel)) S.sel = list[0].id; return { col: "patterns", list, p: C.problems.find((x) => x.id === S.sel) }; }
  if (arg && DR.some((d) => d.id === arg)) { S.arenaCol = "ml"; S.drillSel = arg; }
  else if (arg && C.problems.some((p) => p.id === arg)) { S.arenaCol = "patterns"; S.sel = arg; }
  if (S.arenaCol === "patterns") return { col: "patterns", list: C.problems, p: C.problems.find((x) => x.id === S.sel) || C.problems[0] };
  const d = DR.find((x) => x.id === S.drillSel) || nextDrill() || DR[0];
  return { col: "ml", list: DR, d };
}
const itemId = (it) => it.col === "ml" ? it.d.id : it.p.id;
const codeKey = (it) => it.col === "ml" ? `d:${it.d.id}` : it.p.id;
const starterOf = (it) => it.col === "ml" ? it.d.starter : starter(it.p);
const progOf = (it) => it.col === "ml" ? (S.drills[it.d.id] = Object.assign({ attempts: 0, solved: false, best: 0, total: 0, hints: 0 }, S.drills[it.d.id])) : (S.practice[it.p.id] = Object.assign({ attempts: 0, solved: false, timed: false, hints: 0 }, S.practice[it.p.id]));
const drillMark = (id) => { const s = drillSt(id); return !s || !s.attempts ? ["", "·"] : s.solved ? ["solved", "✓"] : ["tried", "◦"]; };
const patMark = (id) => [["", "·"], ["tried", "◦"], ["solved", "✓"], ["timed", "✓"]][patLevel(id)];

function testsHtml(it) {
  const r = lastRun[itemId(it)];
  if (it.col === "ml") {
    const by = r && r.results ? Object.fromEntries(r.results.map((x) => [x.name, x])) : {};
    return parseTests(it.d.tests).map((t) => { const x = by[t.name]; return `<div class="${x ? "y" : ""}"><span class="${x ? (x.ok ? "ok" : "ko") : ""}">${x ? (x.ok ? "✓" : "✗") : "·"}</span>${esc(t.label)}</div>`; }).join("");
  }
  const n = TESTS && TESTS[it.p.id] ? TESTS[it.p.id].cases.length : null;
  if (!r || !r.results) return `<div><span>·</span>${n || "several"} hidden tests: examples, edge cases, one large input</div>`;
  const pass = r.results.filter((x) => x.ok).length;
  return `<div class="y"><span class="${pass === r.results.length ? "ok" : "ko"}">${pass === r.results.length ? "✓" : "✗"}</span>${pass} / ${r.results.length} tests pass</div>`;
}
function footHtml(it) {
  const st = it.col === "ml" ? drillSt(it.d.id) || {} : S.practice[it.p.id] || {};
  const best = it.col === "ml" ? (st.total ? `${st.best} / ${st.total}` : "—") : st.timed ? "solved under time" : st.solved ? "solved" : "—";
  return `${it.col === "ml" ? "python 3.12 · numpy · in your browser" : "python 3.12 · in your browser"}<br>best <b>${best}</b> · attempts <b>${st.attempts || 0}</b> · hints used <b>${st.hints || 0}</b>`;
}
function outHtml(it) {
  const r = lastRun[itemId(it)];
  if (!r) return `<div class="line">Run the tests with <kbd>⌘↵</kbd>. ${it.col === "ml" ? "Real numpy, checked against a reference and numerical gradients." : "Real Python against hidden tests."}</div>`;
  if (r.running) return `<div class="line">${esc(r.running)}</div>`;
  const so = r.stdout ? `<pre style="margin-top:6px">${esc(r.stdout)}</pre>` : "";
  if (r.error) return `<div class="line ko">✗ error</div><pre>${esc(r.error)}</pre>${so}`;
  const pass = r.results.filter((x) => x.ok).length, tot = r.results.length, ms = r.results.reduce((a, x) => a + (x.ms || 0), 0);
  if (pass === tot) return `<div class="line ok">✓ ${pass} / ${tot} tests pass · ${ms.toFixed(0)} ms</div><div class="line">${S.mock ? "Next problem when ready." : "Now explain it aloud in English in under two minutes, with its complexity."}</div>${so}`;
  if (it.col === "ml") { const f = r.results.find((x) => !x.ok); return `<div class="line ko">✗ ${esc(f.label)}</div><div class="line">${esc(f.msg)}</div><div class="line faint">${pass} / ${tot} tests pass</div>${so}`; }
  return `<div class="line ko">✗ ${pass} / ${tot} tests pass</div>${r.results.filter((x) => !x.ok).slice(0, 3).map((x) => `<div class="line">in ${esc(x.input)} → ${x.error ? `<span class="ko">${esc(x.error)}</span>` : `got ${esc(x.got)}`}, expected ${esc(x.expected)}</div>`).join("")}${so}`;
}
const runText = (it) => { const r = lastRun[itemId(it)]; if (!r || r.running) return ""; if (r.error) return `Error: ${r.error}\n${r.stdout || ""}`; return r.results.map((x) => `${x.ok ? "PASS" : "FAIL"} ${x.label || `test`}${x.ok ? "" : `: ${x.msg || x.error || `in ${x.input} got ${x.got} expected ${x.expected}`}`}`).join("\n") + (r.stdout ? `\nprint output:\n${r.stdout}` : ""); };

function pickerHtml(it) {
  const col = S.mock ? "patterns" : pickCol || it.col;
  const rows = col === "ml"
    ? DR.map((d, i) => { const [c, m] = drillMark(d.id); return `<button class="pitem" data-go="${d.id}" aria-current="${it.col === "ml" && it.d.id === d.id}"><span class="st ${c}">${m}</span><span style="min-width:0"><span class="nm">${pad(i + 1)} · ${esc(d.title)}</span><span class="pt">${esc(d.fns.join(", "))}()</span></span><span class="lvl">L${d.lvl}</span></button>`; })
    : (S.mock ? C.problems.filter((p) => S.mock.ids.includes(p.id)) : C.problems).map((p) => { const [c, m] = patMark(p.id); return `<button class="pitem" data-go="${p.id}" aria-current="${it.col === "patterns" && it.p.id === p.id}"><span class="st ${c}">${m}</span><span style="min-width:0"><span class="nm">${esc(p.pattern)}</span><span class="pt">${esc(p.fn)}()</span></span><span class="lvl">${p.level.toLowerCase()}</span></button>`; });
  return `<div class="row" style="justify-content:space-between">${S.mock ? `<span class="eyebrow">Timed mock</span>` : `<div class="tabs"><button data-col="ml" aria-pressed="${col === "ml"}">ML from scratch</button><button data-col="patterns" aria-pressed="${col === "patterns"}">Interview patterns</button></div>`}<button class="x" id="pclose">esc</button></div>
    <div class="plist">${rows.join("")}</div>
    <div class="m faint">✓ solved · ◦ tried · · not started${col === "patterns" ? " · a timed mock solve counts most" : ""}</div>
    ${col === "patterns" && !S.mock ? `<div><button class="btn" id="mstartA">Start a 55-minute timed mock</button></div>` : ""}`;
}
function tutorHtml(it) {
  if (!tutorOpen) return `<button class="ask" id="askBtn" type="button"><i></i>Stuck? Ask the tutor <kbd>⌘I</kbd></button>`;
  const msgs = (S.tutor && S.tutor[itemId(it)]) || [];
  return `<div class="tutor" role="dialog" aria-label="Tutor"><header><b>Tutor</b><button type="button" id="tclose">hints only · <kbd>esc</kbd></button></header>
    <div class="msgs" id="tmsgs">${msgs.length ? msgs.map((m) => m.role === "me" ? `<div class="me">${esc(m.text)}</div>` : `<div class="ai"><span class="who">tutor${m.guarded ? " · rephrased to keep the answer yours" : ""}</span>${inline(m.text)}</div>`).join("") : `<div class="hello">Say what you tried and where it breaks. The tutor points at the idea and asks a question back; it never writes the fix. Each reply counts as a hint.</div>`}</div>
    <div class="ctx"><span class="bare">sees</span><span>exercise</span><span>your code</span><span>last run</span><span class="bare" style="margin-left:auto">never the solution</span></div>
    <form id="tform"><textarea id="tin" rows="1" placeholder="Ask about your code…"></textarea><kbd>↵</kbd></form></div>`;
}

VIEWS.arena = (v) => {
  const it = arenaItem(), id = itemId(it), mock = S.mock, list = it.list, idx = list.indexOf(it.col === "ml" ? it.d : it.p);
  const title = it.col === "ml" ? it.d.title : it.p.fn;
  const desc = it.col === "ml" ? `<p>${it.d.desc}</p>` : `<p>${it.p.text}</p><div class="examples" id="examples">${examplesFor(it.p)}</div>`;
  document.title = `${title} · Arena · Forge`;
  v.innerHTML = `<div class="ws">
    <div class="brief">
      ${mock ? `<div class="mockbar"><span class="clock" id="mclock">00:00</span><span>timed mock · ${mock.ids.length} problems · 55 min</span><span style="flex:1"></span><button class="btn primary small" id="mfinish">Finish & score</button><button class="x" id="mabort">abandon</button></div>` : ""}
      <button class="kick" id="kick" type="button" aria-expanded="${pickOpen}">${it.col === "ml" ? "ML from scratch" : mock ? "Mock" : "Interview patterns"} · ${pad(idx + 1)} / ${pad(list.length)} <span>▾</span></button>
      <h2>${esc(title)}</h2>
      <div class="desc">${desc}</div>
      <div class="tests" id="atests">${testsHtml(it)}</div>
      <div class="foot" id="afoot">${footHtml(it)}</div>
      <div class="picker" id="picker" ${pickOpen ? "" : "hidden"}>${pickOpen ? pickerHtml(it) : ""}</div>
    </div>
    <div class="work">
      <textarea id="code"></textarea>
      <div class="out" id="aout"><div class="actions"><span class="m muted" id="rstatus"></span><button class="btn small" id="resetCode" type="button">Reset</button><button class="btn primary small" id="runBtn" type="button">Run tests <kbd>⌘↵</kbd></button></div><div id="aoutBody">${outHtml(it)}</div></div>
      <div id="tutorBox" style="display:contents">${tutorHtml(it)}</div>
    </div></div>`;
  testsReady.then(() => { const ex = $("#examples"); if (ex && !ex.innerHTML && it.col === "patterns") ex.innerHTML = examplesFor(it.p); const t = $("#atests"); if (t && it.col === "patterns" && !lastRun[id]) t.innerHTML = testsHtml(it); });
  const ta = $("#code"); ta.value = S.code[codeKey(it)] || starterOf(it);
  const run = () => runArena(it);
  cm = CodeMirror.fromTextArea(ta, { mode: "python", lineNumbers: true, styleActiveLine: true, indentUnit: 4, tabSize: 4, matchBrackets: true, autoCloseBrackets: true, extraKeys: { Tab: (c) => c.replaceSelection("    "), "Ctrl-Enter": run, "Cmd-Enter": run, "Cmd-I": () => toggleTutor(it, true), "Ctrl-I": () => toggleTutor(it, true) } });
  cm.on("change", () => { S.code[codeKey(it)] = cm.getValue(); save(); });
  const rs = () => { const el = $("#rstatus"); if (el) el.textContent = RUNNER_TXT[Runner.status]; };
  Runner.onStatus = rs; rs(); Runner.boot();
  $("#runBtn").onclick = run;
  $("#resetCode").onclick = (e) => { if (!e.target.dataset.sure) { e.target.dataset.sure = 1; e.target.textContent = "Reset to the starter?"; return; } cm.setValue(starterOf(it)); e.target.textContent = "Reset"; delete e.target.dataset.sure; };
  $("#kick").onclick = () => { pickOpen = !pickOpen; pickCol = null; drawPicker(it); };
  wirePicker(it); wireTutor(it);
  if (!pickOpen && !tutorOpen) setTimeout(() => cm && cm.focus(), 0);
  const key = (e) => {
    if (Palette.isOpen()) return;
    if (e.key === "Escape" && (pickOpen || tutorOpen)) { e.preventDefault(); if (tutorOpen) toggleTutor(it, false); else { pickOpen = false; drawPicker(it); } }
    else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(); }
    else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") { e.preventDefault(); toggleTutor(it, !tutorOpen); }
  };
  document.addEventListener("keydown", key); cleanup.push(() => document.removeEventListener("keydown", key));
  if (mock) {
    const tick = () => { const el = $("#mclock"); if (!el) return; const ms = Date.now() - mock.start; el.textContent = fmtClock(ms); el.classList.toggle("over", ms > 55 * 60000); };
    tick(); const iv = setInterval(tick, 1000); cleanup.push(() => clearInterval(iv));
    $("#mfinish").onclick = finishMock;
    $("#mabort").onclick = (e) => { if (!e.target.dataset.sure) { e.target.dataset.sure = 1; e.target.textContent = "click again: nothing is saved"; return; } S.mock = null; save(); render(); };
  }
};
function drawPicker(it) { const p = $("#picker"); if (!p) return; p.hidden = !pickOpen; p.innerHTML = pickOpen ? pickerHtml(it) : ""; $("#kick").setAttribute("aria-expanded", pickOpen); wirePicker(it); if (!pickOpen && cm) cm.focus(); }
function wirePicker(it) {
  $$("#picker [data-go]").forEach((b) => b.onclick = () => { pickOpen = false; const h = `#arena/${b.dataset.go}`; if (location.hash === h) render(); else location.hash = h; });
  $$("#picker [data-col]").forEach((b) => b.onclick = () => { pickCol = b.dataset.col; drawPicker(it); });
  const c = $("#pclose"); if (c) c.onclick = () => { pickOpen = false; drawPicker(it); };
  const m = $("#mstartA"); if (m) m.onclick = () => { pickOpen = false; startMock(); };
}
function toggleTutor(it, open) { tutorOpen = open; $("#tutorBox").innerHTML = tutorHtml(it); wireTutor(it); if (!open && cm) cm.focus(); }
function wireTutor(it) {
  const a = $("#askBtn"); if (a) { a.onclick = () => toggleTutor(it, true); return; }
  const id = itemId(it), box = $("#tmsgs"), inp = $("#tin"); if (!inp) return;
  box.scrollTop = box.scrollHeight; inp.focus();
  $("#tclose").onclick = () => toggleTutor(it, false);
  inp.oninput = () => { inp.style.height = "auto"; inp.style.height = Math.min(120, inp.scrollHeight) + "px"; };
  inp.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#tform").requestSubmit(); } };
  $("#tform").onsubmit = async (e) => {
    e.preventDefault(); const text = inp.value.trim(); if (!text) return;
    if (!(Sync && Sync.enabled)) return toast("The tutor runs on the Forge Worker: open Forge from its workers.dev address.");
    const msgs = tutorOf(id), day = TODAY(); msgs.push({ role: "me", text, day });
    if (msgs.length > 40) msgs.splice(0, msgs.length - 40);
    inp.value = ""; toggleTutor(it, true); const b = $("#tmsgs"); b.insertAdjacentHTML("beforeend", `<div class="ai faint" id="tthink"><span class="who">tutor</span>thinking…</div>`); b.scrollTop = b.scrollHeight;
    try {
      const r = await api("POST", "/api/tutor", { kind: it.col === "ml" ? "drill" : "problem", id, title: it.col === "ml" ? it.d.title : `${it.p.pattern}: ${it.p.fn}`, desc: it.col === "ml" ? it.d.desc : it.p.text, tests: it.col === "ml" ? parseTests(it.d.tests).map((t) => t.label) : [], code: cm ? cm.getValue() : "", run: runText(it), messages: msgs.filter((m) => m.day === day && !m.error).map(({ role, text }) => ({ role, text })) });
      msgs.push({ role: "tutor", text: r.reply, guarded: r.guarded, day }); progOf(it).hints++; save();
    } catch (err) { msgs.push({ role: "tutor", text: `Couldn't reach the tutor: ${err.message}`, day, error: true }); }
    if (route() === "arena" && itemId(arenaItem()) === id) { toggleTutor(it, true); const f = $("#afoot"); if (f) f.innerHTML = footHtml(it); }
  };
}
async function runArena(it) {
  const btn = $("#runBtn"); if (!btn || btn.disabled) return;
  const id = itemId(it), code = cm.getValue(), paint = () => { const o = $("#aoutBody"); if (o && itemId(arenaItem()) === id) { o.innerHTML = outHtml(it); $("#atests").innerHTML = testsHtml(it); $("#afoot").innerHTML = footHtml(it); } };
  let r;
  btn.disabled = true; lastRun[id] = { running: Runner.status === "ready" ? "Running…" : "Loading Python and numpy (first run takes a few seconds)…" }; paint();
  if (it.col === "ml") r = await Runner.run({ kind: "drill", code, fns: it.d.fns, tests: it.d.tests });
  else {
    await testsReady; if (!TESTS) { lastRun[id] = { error: "Test cases couldn't load. Reload the page." }; btn.disabled = false; return paint(); }
    const t = TESTS[it.p.id]; r = await Runner.run({ code, fn: it.p.fn, cases: t.cases, cmp: t.cmp });
    if (r.results) r.results.forEach((x, i) => { x.label = `test ${i + 1}`; });
  }
  btn.disabled = false; lastRun[id] = r;
  const pr = progOf(it); pr.attempts++; pr.last = TODAY();
  const pass = r.results ? r.results.filter((x) => x.ok).length : 0, tot = r.results ? r.results.length : (it.col === "patterns" && TESTS[it.p.id] ? TESTS[it.p.id].cases.length : 0), all = !!r.results && pass === tot;
  if (it.col === "ml") { pr.best = Math.max(pr.best || 0, pass); pr.total = r.results ? tot : pr.total; }
  if (all) { const before = dayCount(TODAY()); ACT().pass++; if (before < BANK && dayCount(TODAY()) >= BANK) toast("Day banked."); }
  if (all && !pr.solved) { pr.solvedAt = TODAY(); toast(it.col === "ml" ? `${it.d.title}: all tests pass.` : "Solved."); }
  if (all) pr.solved = true;
  if (S.mock && it.col === "patterns") { S.mock.last[id] = { pass, total: tot }; if (all && Date.now() - S.mock.start <= 55 * 60000) pr.timed = true; }
  save(); nav(); paint();
}
function startMock() {

  const pick = (lvl) => { const pool = C.problems.filter((p) => p.level === lvl); const fresh = pool.filter((p) => patLevel(p.id) < 3); const src = fresh.length ? fresh : pool; return src.sort(() => Math.random() - 0.5); };
  const easy = pick("Easy")[0], meds = pick("Medium").slice(0, 2);
  const ids = S.mocks.length ? [easy.id, meds[0].id, meds[1].id] : ["two-sum", "longest-unique", "merge-intervals"];
  S.mock = { ids, start: Date.now(), last: {} }; S.sel = ids[0]; S.arenaCol = "patterns"; save(); const h = `#arena/${ids[0]}`; if (location.hash === h) render(); else location.hash = h;
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
    body.innerHTML = `<div class="row" style="justify-content:space-between;align-items:flex-start"><div style="max-width:62ch"><div class="eyebrow">${part.n} · ${part.min} minutes</div><h2 style="font-size:22px;margin-top:6px">${esc(part.h)}</h2><p class="muted" style="margin-top:8px">${part.qs.length} questions. Answer in English, in your own words, with formulas where useful. When you submit, the model grades each answer against the key points.</p></div><button class="btn primary" id="tstart">${icon("play")} Start ${part.min}:00</button></div>`;
    $("#tstart").onclick = () => { S.theoryRun = { part: part.id, start: Date.now(), answers: {}, ticks: {}, done: false }; save(); render(); };
    return;
  }
  body.innerHTML = `
    <div class="row" style="justify-content:space-between"><div><div class="eyebrow">${part.n} · ${run.done ? "self-grading" : "running"}</div><h2 style="font-size:22px;margin-top:6px">${esc(part.h)}</h2></div>
      <div class="row">${run.done ? `<span class="pill">${run.elapsedMin} min used</span>` : `<span class="clock num" id="tclock" style="font:700 26px var(--display)">00:00</span>`}
      ${run.done ? (run.grades ? `<button class="btn primary" id="tsave">Save ${run.grades.score}/100</button>` : `<button class="btn primary" id="tgrade">Grade</button>`) : `<button class="btn primary" id="tsubmit">Submit</button>`}<button class="btn small" id="tabort">${run.done ? "Discard" : "Abandon"}</button></div></div>
    <div style="margin-top:12px">${part.qs.map((q, i) => `<div class="q"><div class="row" style="justify-content:space-between"><b>Question ${i + 1}</b></div><div class="qt math">${q.q}</div>
      <textarea class="input" data-q="${i}" ${run.done ? "readonly" : ""} placeholder="Your answer…">${esc(run.answers[i] || "")}</textarea>
      ${run.grades ? `<div class="row" style="gap:12px;align-items:baseline"><span class="score sm ${scoreCls(run.grades.scores[i].score)} num">${run.grades.scores[i].score}</span><span class="muted" style="font-size:14px">${esc(run.grades.scores[i].fix)}</span></div><div class="keys"><span class="eyebrow">Key points</span>${q.keys.map((k) => `<div class="math muted" style="font-size:14px">· ${k}</div>`).join("")}</div>` : ""}</div>`).join("")}</div>`;
  $$("textarea[data-q]", body).forEach((t) => t.oninput = () => { run.answers[t.dataset.q] = t.value; save(); });
  $("#tabort").onclick = (e) => { if (!e.target.dataset.sure) { e.target.dataset.sure = 1; e.target.textContent = "Click again to confirm"; return; } S.theoryRun = null; save(); render(); };
  if (!run.done) {
    const tick = () => { const el = $("#tclock"); if (!el) return; const ms = Date.now() - run.start; el.textContent = fmtClock(ms); el.style.color = ms > part.min * 60000 ? "var(--bad)" : ""; };
    tick(); const iv = setInterval(tick, 1000); cleanup.push(() => clearInterval(iv));
    $("#tsubmit").onclick = () => { run.done = true; run.elapsedMin = Math.round((Date.now() - run.start) / 60000); save(); render(); };
  } else {
    const g = $("#tgrade");
    if (g) g.onclick = () => {
      if (!(Sync && Sync.enabled)) return toast("Grading runs on the Forge Worker.");
      g.disabled = true; g.textContent = "Grading…";
      api("POST", "/api/diagnostic/grade", { part: part.id, questions: part.qs.map((q, i) => ({ q: q.q, keys: q.keys, answer: run.answers[i] || "" })) })
        .then((r) => { run.grades = r; save(); render(); }, (e) => { fail(e); g.disabled = false; g.textContent = "Grade"; });
    };
    const sv = $("#tsave");
    if (sv) sv.onclick = () => {
      S.theory.push({ part: part.id, date: TODAY(), score: run.grades.score, elapsedMin: run.elapsedMin, answers: run.answers, graded: "ai" });
      S.theoryRun = null; save(); toast(`${part.n} scored ${run.grades.score}/100.`); render();
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

/* ---- skills: the shape, from evidence ---- */
const HOW = { coding: "measured by interview patterns and timed mocks", ml: "measured by Arena drills, Proof and ML exit checks", math: "measured by Proof, math exit checks and the Part 3 diagnostic", sys: "measured by systems drills, exit checks and the Part 4 diagnostic", ship: "measured by days with commits and module proof links" };
VIEWS.skills = (v) => {
  const draw = () => {
    const ev = ForgeShape.evidence({ S, C, drills: DR, mastery: masteryCache, commits: commitDays, today: TODAY(), isDone: (id) => modStatus(id) === "done" });
    const rows = ForgeShape.compute(C.tracks, ev);
    const f1 = (x) => x.toFixed(1);
    v.innerHTML = `
    <section class="skills">
      <div>${ForgeShape.svg(rows)}
        <div class="shape-legend"><span><i></i>measured</span><span><i class="est-d"></i>toward a track not measured yet</span><span><i class="dot"></i>not measured</span><span><i class="tgt"></i>March target</span></div></div>
      <div class="srows">${rows.map((r) => `<div class="srow">
        <h4>${esc(r.t)}</h4>
        <div class="vals">${r.est == null ? "not measured" : `<b>${f1(r.est)}</b> ± ${f1(r.unc)}`} → ${r.target}</div>
        <div class="ev">${r.est == null ? esc(HOW[r.k] || "no evidence yet") : `${r.n} piece${r.n === 1 ? "" : "s"} · ${esc(r.top.join(" · "))}`}</div></div>`).join("")}</div>
    </section>
    <p class="m muted" style="max-width:90ch">Level = weighted mean of the evidence, 0 to 5; ± shrinks as evidence accumulates (confidence 1 − e<sup>−W/4</sup>), and evidence fades over ~90 days. Nothing here is self-reported: Proof reviews (pasted answers never count), proven exit checks, Arena drills (fewer points with hints), interview patterns, mocks, AI-graded diagnostics, finished modules and days with commits.</p>
    <section class="card"><div class="card-h"><h3>Coding patterns</h3><span class="muted">tried · solved · solved in a timed mock</span></div>
      <div class="patgrid">${C.problems.map((p) => { const l = patLevel(p.id); return `<a class="pat" href="#arena/${p.id}"><span>${esc(p.pattern)}</span><span class="pips">${[1, 2, 3].map((i) => `<i class="${i <= l ? "on" : ""}"></i>`).join("")}</span></a>`; }).join("")}</div></section>`;
  };
  draw();
  refreshMastery().then((m) => { if (m && route() === "skills" && v.isConnected) draw(); });
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
  const p = S.path[m.id] || {}, st = modStatus(m.id), stg = stageOf(m), si = C.stages.indexOf(stg);
  const idx = C.modules.indexOf(m), prev = C.modules[idx - 1], next = C.modules[idx + 1];
  const notes = S.notes.filter((n) => n.mod === m.id), proven = modProvenN(m);
  $("#pageTitle").textContent = "Path"; document.title = `${m.t} · Forge`;
  const ck = (i) => checkProofs[ckey(m, i)];
  v.innerHTML = `
  <nav class="crumbs"><a href="#path">Path</a><span>/</span><span>Stage ${si} · ${esc(stg.t)}</span></nav>
  <section>
    <div class="eyebrow">${esc(areaOf(stg.area).t)} · ~${m.hrs} h · ${fmtH(modMin(m.id))} h measured · ${st}</div>
    <h2 style="font-size:44px;margin-top:10px">${esc(m.t)}</h2><p class="muted" style="margin-top:10px;max-width:68ch">${esc(m.why)}</p>
    <div class="progress" style="margin-top:18px;max-width:680px"><i style="width:${modProgress(m) * 100}%"></i></div>
    <p class="m muted" style="margin-top:8px">${proven} / ${m.checks.length} exit checks proven · proof link ${p.proof ? "set" : "missing"} · done when both are complete</p>
  </section>
  <section class="grid g-main">
    <div style="display:grid;gap:20px;min-width:0">
      <div class="card"><div class="card-h"><h3>Exit checks</h3><span class="muted">proven by a Proof answer of 70 or more, written from memory</span></div>
        <div class="tests" style="font-size:13px">${m.checks.map((c, i) => { const x = ck(i); return `<div class="${x ? "y" : ""}" style="grid-template-columns:18px minmax(0,1fr) auto;gap:10px;align-items:baseline"><span class="${x ? (x.proven ? "ok" : "ko") : ""}">${x ? (x.proven ? "✓" : "✗") : "·"}</span><span class="math" style="font-family:var(--body);font-size:14px">${c}</span>${x && x.proven ? `<span class="faint">${x.score}</span>` : `<button class="btn small" data-test="${i}" type="button">${x ? "Retry" : "Test me"}</button>`}</div>`; }).join("")}</div>
        <p class="m faint" style="margin-top:12px">The planner also picks one or two of these for you each night.</p></div>
      <div class="card"><div class="card-h"><h3>Build from scratch</h3></div>
        <p>${esc(m.build)}</p>
        <label class="field" style="margin-top:14px"><span>Proof: repository, commit, notebook or post</span><div class="row" style="flex-wrap:nowrap"><input class="input" id="proof" placeholder="https://github.com/…" value="${esc(p.proof || "")}">${p.proof && /^https?:/.test(p.proof) ? `<a class="btn" href="${esc(p.proof)}" target="_blank" rel="noopener noreferrer">Open</a>` : ""}</div></label></div>
      <div class="card"><div class="card-h"><h3>Learn</h3><span class="muted">a reading list: what counts is the checks above</span></div>
        <div class="reslist">${m.res.map(([k, t, u], i) => `<div class="resitem" style="grid-template-columns:64px minmax(0,1fr) auto;align-items:center"><span class="pill">${KIND[k] || k}</span><a href="${esc(u)}"${ext(u)}>${esc(t)}</a>${!importable(k, u) ? "<span></span>" : brainOrigins && brainOrigins.has(u) ? `<span class="m faint">in brain</span>` : `<button class="btn small" data-brain="${i}" type="button">Add to brain</button>`}</div>`).join("")}</div>
        <p class="m faint" style="margin-top:12px">Add a paper or post when you start reading it: its text then feeds your Proof questions and the tutor.</p></div>
    </div>
    <div style="display:grid;gap:20px;min-width:0">
      <div class="card"><div class="card-h"><h3>Time</h3><span class="pill num">${fmtH(modMin(m.id))} / ${m.hrs} h</span></div>
        <p class="muted" style="font-size:14px">Measured while this page or the module's notes are in front and you're active. Video or paper time away from Forge can be added in the Log.</p></div>
      <div class="card"><div class="card-h"><h3>Notes</h3><button class="btn small" id="mnew">New note</button></div>
        ${notes.length ? `<div class="next-list">${notes.map((n) => `<a class="next-item" href="#library/${n.id}"><span class="dot"></span><span>${esc(n.title || "Untitled")}</span><span class="pill">${noteCards(n).length} cards</span></a>`).join("")}</div>` : `<p class="muted" style="font-size:14px">Write what you rebuilt, the bugs you hit and a few Q:/A: cards. Time spent in them counts for this module.</p>`}</div>
      <div class="row" style="justify-content:space-between">${prev ? `<a class="btn small" href="#path/${prev.id}">← ${esc(prev.t)}</a>` : "<span></span>"}${next ? `<a class="btn small" href="#path/${next.id}">${esc(next.t)} →</a>` : ""}</div>
    </div>
  </section>`;
  $("#proof").onchange = (e) => { const q = PS(m.id); q.proof = e.target.value.trim(); save(); updateCtx(); render(); };
  $$("[data-test]", v).forEach((b) => b.onclick = () => {
    if (!(Sync && Sync.enabled)) return toast("Exit checks are proven through Proof, on the Forge Worker.");
    const i = +b.dataset.test; b.disabled = true; b.textContent = "Writing a question…";
    api("POST", "/api/proof/check", { key: ckey(m, i), title: m.t, check: m.checks[i], track: TRACK_OF_AREA[stg.area] }).then(() => { location.hash = "#proof"; }, (e) => { fail(e); b.disabled = false; b.textContent = "Test me"; });
  });
  $$("[data-brain]", v).forEach((btn) => btn.onclick = () => {
    if (!(Sync && Sync.enabled)) return toast("The brain lives on the Forge Worker.");
    const [, t, u] = m.res[+btn.dataset.brain]; btn.disabled = true; btn.textContent = "Reading…";
    api("POST", "/api/reading", { url: u, title: t, mod: m.id }).then((r) => { (brainOrigins = brainOrigins || new Set()).add(u); toast(r.existing ? "Already in the brain." : `${t}: ${r.chunks} passages added to the brain.`); if (route() === "path" && routeArg() === m.id) render(); },
      (e) => { fail(e); btn.disabled = false; btn.textContent = "Add to brain"; });
  });
  if (!brainOrigins && !brainTried && Sync && Sync.enabled) { brainTried = true; api("GET", "/api/sources").then((r) => { brainOrigins = new Set(r.map((x) => x.origin).filter(Boolean)); if (route() === "path" && routeArg() === m.id) render(); }, () => {}); }
  $("#mnew").onclick = () => { const n = newNote({ title: `${m.t} — notes`, mod: m.id, tags: [stg.area], body: `## What I rebuilt\n\n\n## Bugs I hit\n\n\n## Cards\nQ: \nA: \n` }); location.hash = `#library/${n.id}`; };
}
let brainOrigins = null, brainTried = false;
/** Papers and posts the Worker can read: arXiv links (HTML rendering) and web pages, not other PDFs. */
const importable = (k, u) => (k === "paper" || k === "blog") && (/arxiv\.org\/(abs|pdf)\//.test(u) || !/\.pdf($|[?#])/i.test(u));
const TRACK_OF_AREA = { math: "math", dl: "ml", llm: "ml", sys: "sys", res: "ship", code: "coding", eng: "ml" };

/* ---- library ---- */
let libQ = "", libTag = "";
VIEWS.library = (v) => {
  const id = routeArg(); if (id && noteById(id)) return noteView(v, noteById(id));
  $("#topAction").innerHTML = `<button class="btn small" id="njour" title="Private: never sent to an AI">Journal entry</button><button class="btn primary small" id="nnew">${icon("plus")} New note</button>`;
  $("#nnew").onclick = () => { const n = newNote(); location.hash = `#library/${n.id}`; };
  $("#njour").onclick = () => { const n = newNote({ kind: "journal", title: `Journal ${TODAY()}`, tags: ["journal"] }); location.hash = `#library/${n.id}`; };
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
    : list.length ? `<div class="notes">${list.map((n) => { const c = noteCards(n).length, m = n.mod && modById(n.mod); const snip = (n.body || "").replace(/[#*`>$\[\]]/g, "").replace(/\s+/g, " ").trim().slice(0, 150); return `<a class="note-card" href="#library/${n.id}"><b>${esc(n.title || "Untitled")}</b><p>${esc(snip) || '<span class="faint">Empty</span>'}</p><div class="row" style="gap:6px">${m ? `<span class="pill acc">${esc(m.t)}</span>` : ""}${(n.tags || []).map((t) => `<span class="pill">#${esc(t)}</span>`).join("")}${c ? `<span class="pill ember">${c} cards</span>` : ""}<span class="faint num" style="margin-left:auto;font-size:12px">${ymd(new Date(n.updated))}</span></div></a>`; }).join("")}</div>`
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
  const grade = (g) => { const id = rv.ids.shift(); SRS.grade(id, g); rv.done++; if (g === 1) rv.ids.push(id); rv.shown = false; if (!rv.ids.length) toast(`Session done: ${rv.done} cards.`); markCleared(); render(); };
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
  <details class="card"><summary><b>Add off-screen work</b> <span class="muted">· time in Forge is measured automatically; add only videos, papers or code away from it</span></summary><div style="margin-top:14px">
    <form id="lf" class="grid lform">
      <label class="field"><span>Date</span><input class="input" type="date" id="l_date" value="${TODAY()}" max="${TODAY()}"></label>
      <label class="field"><span>Minutes</span><input class="input" type="number" min="1" max="720" id="l_min" placeholder="50" required></label>
      <label class="field"><span>Module</span><select class="input" id="l_mod"><option value="">None</option>${C.stages.map((s) => `<optgroup label="${esc(s.t)}">${C.modules.filter((m) => m.stage === s.k).map((m) => `<option value="${m.id}" ${modStatus(m.id) === "active" && m === activeMods()[0] ? "selected" : ""}>${esc(m.t)}</option>`).join("")}</optgroup>`).join("")}</select></label>
      <label class="field"><span>Area</span><select class="input" id="l_area">${C.areas.map((a) => `<option value="${a.k}">${esc(a.t)}</option>`).join("")}</select></label>
      <label class="field" style="grid-column:span 2"><span>What you did</span><input class="input" id="l_note" placeholder="Backprop through BatchNorm by hand, matched autograd"></label>
      <button class="btn primary" type="submit">Log</button>
    </form></div></details>
  <section class="grid g-4">
    <div class="card kpi ember"><span class="eyebrow">This week</span><b>${fmtH(thisW)}<span class="muted" style="font-size:15px"> / ${C.weeklyHours} h</span></b><div class="progress"><i style="width:${Math.min(100, (thisW / 60 / C.weeklyHours) * 100)}%"></i></div></div>
    <div class="card kpi"><span class="eyebrow">4-week average</span><b>${fmtH(four / 4)}<span class="muted" style="font-size:15px"> h</span></b><span class="sub">per week, previous 4 weeks</span></div>
    <div class="card kpi"><span class="eyebrow">All time</span><b>${fmtH(total)}<span class="muted" style="font-size:15px"> h</span></b><span class="sub">${S.log.length} sessions</span></div>
    <div class="card kpi"><span class="eyebrow">Today</span><b>${fmtH(dayMin(TODAY()))}<span class="muted" style="font-size:15px"> h</span></b><span class="sub">${(() => { const k = S.log.filter((e) => e.date === TODAY()).length; return `${k} session${k === 1 ? "" : "s"}`; })()}</span></div>
  </section>
  <section class="card"><div class="card-h"><h3>Deep work per week, by area</h3><span class="muted" style="font-size:13px">Last 12 weeks · hover a bar</span></div>${S.log.length ? weekStack(12) : `<div class="empty">Active time in Forge builds up here, week by week.</div>`}</section>
  <section class="grid g-2">
    <div class="card"><div class="card-h"><h3>Where the hours went</h3></div>${S.log.length ? areaBars(S.log) : `<div class="empty">No sessions yet.</div>`}</div>
    <div class="card"><div class="card-h"><h3>Time per module</h3></div>${modTime.length ? `<div class="next-list">${modTime.map(([m, x]) => `<a class="next-item" href="#path/${m.id}"><span class="dot" style="background:var(--c${areaIdx(stageOf(m).area)})"></span><span>${esc(m.t)}</span><span class="pill num">${fmtH(x)} / ${m.hrs} h</span></a>`).join("")}</div>` : `<div class="empty">Log time against a module to see it here.</div>`}</div>
  </section>
  <section class="card"><div class="card-h"><h3>Sessions</h3><span class="muted" style="font-size:13px">Latest 60</span></div><div class="table-wrap">${rows.length ? `<table><thead><tr><th>Date</th><th>Min</th><th>Area</th><th>Module</th><th>Note</th><th></th></tr></thead><tbody>${rows.map((e) => `<tr><td class="num">${e.date}</td><td class="num">${Math.round(e.min)}</td><td><span class="row" style="gap:6px;flex-wrap:nowrap"><i class="sw" style="background:var(--c${areaIdx(e.area)})"></i>${esc(areaOf(e.area).t)}</span></td><td>${e.mod && modById(e.mod) ? `<a href="#path/${e.mod}">${esc(modById(e.mod).t)}</a>` : '<span class="faint">—</span>'}</td><td class="muted" style="font-size:13px">${esc(e.note)}${e.src === "auto" ? ' <span class="pill">measured</span>' : e.src === "timer" ? ' <span class="pill">timer</span>' : ""}</td><td><button class="x" data-ldel="${e.id}">Delete</button></td></tr>`).join("")}</tbody></table>` : `<div class="empty">No sessions yet.</div>`}</div></section>`;
  const syncArea = () => { const m = modById($("#l_mod").value); if (m) $("#l_area").value = stageOf(m).area; };
  $("#l_mod").onchange = syncArea; syncArea();
  $("#lf").onsubmit = (e) => { e.preventDefault(); if (addLog({ date: $("#l_date").value || TODAY(), min: $("#l_min").value, mod: $("#l_mod").value, area: $("#l_area").value, note: $("#l_note").value })) { toast("Session logged."); render(); } else toast("Minutes must be a positive number."); };
  $$("[data-ldel]", v).forEach((b) => b.onclick = () => { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "Confirm"; return; } S.log = S.log.filter((e) => e.id !== b.dataset.ldel); save(); render(); });
};

/* ---------------- brain: sources, search, repos, context inspector (needs the Forge Worker) ---------------- */
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
        <div class="row"><label class="field" style="flex:1 1 140px"><span>Project</span><input class="input" id="upp" placeholder="cs231n"></label></div>
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
    el.innerHTML = srcHits.length ? `<div class="next-list">${srcHits.map((h) => `<a class="next-item hit" href="${sourceHref(h)}"><span class="stack" style="gap:2px;min-width:0"><span class="row" style="gap:6px"><b>${esc(h.title)}</b><span class="pill">${KINDS[h.kind] || h.kind}</span></span><span class="faint mono" style="font-size:12px">${esc(where(h.meta))}</span><span class="muted snip">${snip(h.snip)}</span></span></a>`).join("")}</div>` : `<div class="empty">No match.</div>`;
  };
  const runQ = async () => { const q = srcQ, n = ++srcSeq; srcHits = null; drawHits(); if (!q.trim()) return; try { const r = await api("GET", `/api/search?q=${encodeURIComponent(q)}`); if (n === srcSeq) { srcHits = r.results; drawHits(); } } catch (e) { fail(e); } };
  let qt = null; cleanup.push(() => clearTimeout(qt));
  $("#sq").oninput = (e) => { srcQ = e.target.value; clearTimeout(qt); qt = setTimeout(runQ, 220); };
  if (srcQ.trim()) runQ();

  const loadSources = async () => {
    const el = $("#slist"); if (!el) return;
    let rows; try { rows = await api("GET", "/api/sources"); } catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    if (!$("#slist")) return;
    el.innerHTML = rows.length ? `<table><thead><tr><th>Title</th><th>Kind</th><th>Project</th><th>Chunks</th><th></th></tr></thead><tbody>${rows.map((s) => `<tr><td><a href="${sourceHref(s)}">${esc(s.title || "Untitled")}</a></td><td>${KINDS[s.kind] || s.kind}</td><td class="muted">${esc(s.project || "—")}</td><td class="num">${s.chunks}</td><td>${s.kind === "note" || s.kind === "journal" ? "" : `<button class="x" data-sdel="${s.id}">Delete</button>`}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">Nothing yet. Upload a course, add a repository, or write notes in the Library: they sync here as searchable chunks.</div>`;
    $$("[data-sdel]", el).forEach((b) => b.onclick = () => { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "Confirm"; return; } api("DELETE", `/api/sources/${b.dataset.sdel}`).then(loadSources, fail); });
  };

  const loadRepos = async () => {
    const el = $("#repos"); if (!el) return;
    let rows; try { rows = await api("GET", "/api/repos"); } catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    if (!$("#repos")) return;
    el.innerHTML = rows.length ? `<div class="next-list">${rows.map((r) => `<div class="next-item repo"><span class="stack" style="gap:2px;flex:1 1 240px"><b class="mono" style="overflow-wrap:anywhere">${esc(r.full_name)}<span class="faint"> @${esc(r.branch)}</span></b><span class="faint" style="font-size:12px" data-rst="${r.id}">${r.files} files · ${r.chunks} chunks · synced ${when(r.synced_at)}${r.head_sha ? ` · ${r.head_sha.slice(0, 7)}` : ""}</span></span><button class="btn small" data-rsync="${r.id}">Sync</button><button class="x" data-rdel="${r.id}">Remove</button></div>`).join("")}</div>`
      : `<div class="faint" style="font-size:13px">Code is chunked by function and class, Markdown by heading. Re-syncing skips unchanged files.</div>`;
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
      const { id } = await api("POST", "/api/sources", { kind: "course", title: f.name.replace(/\.[^.]+$/, ""), origin: f.name, project: $("#upp").value.trim() || null });
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
    v.innerHTML = `
    <nav class="crumbs"><a href="#sources">Sources</a><span>/</span><span>${esc(s.title)}</span></nav>
    <section class="card"><div class="row" style="justify-content:space-between">
      <div class="stack" style="gap:4px"><h3 style="margin:0">${esc(s.title)}</h3><span class="muted" style="font-size:13px">${KINDS[s.kind] || s.kind}${s.project ? ` · ${esc(s.project)}` : ""}${s.origin ? ` · ${esc(s.origin)}` : ""} · ${s.chunks.length} chunks · updated ${when(s.updated)}</span></div>
</div></section>
    <section class="stack" style="gap:10px">${s.chunks.map((c) => `<article class="card chunk"><div class="row" style="justify-content:space-between"><span class="faint mono" style="font-size:12px">#${c.ord + 1} · ${esc(where(c.meta) || "—")}</span></div><pre>${esc(c.text)}</pre></article>`).join("") || `<div class="empty">No chunks.</div>`}</section>`;
  }, (e) => { v.innerHTML = `<div class="empty">${esc(e.message)}</div>`; });
}

VIEWS.context = (v) => {
  if (needsWorker(v)) return;
  v.innerHTML = `
  <section class="card"><div class="card-h"><h3>What the AI saw</h3></div>
    <p class="muted" style="margin:0;max-width:72ch">The assistant reads everything in Forge: notes, journal, sources, code, your evidence. Keep what is truly private off Forge. Every call still goes through one gate that redacts emails and phone numbers and records here exactly which items were sent, to which provider.</p></section>
  <section class="card"><div class="card-h"><h3>Calls</h3><span class="muted" style="font-size:13px">Latest 100</span></div><div id="calls"><div class="faint">Loading…</div></div></section>`;
  api("GET", "/api/audit").then(({ calls }) => {
    const el = $("#calls"); if (!el) return;
    const dec = (d) => !d ? "" : d.action === "switched" ? `<span class="pill warn">switched from ${esc(d.from)}: ${esc(d.because)}</span>` : d.action === "excluded" ? `<span class="pill">${d.excluded.length} item${d.excluded.length === 1 ? "" : "s"} held back</span>` : `<span class="pill good">routed</span>`;
    el.innerHTML = calls.length ? `<div class="next-list">${calls.map((c) => `<details class="call"><summary><span class="num faint">${when(c.at)}</span><b>${esc(c.task)}</b><span class="pill mono">${esc(c.provider)} · ${esc(c.model || "")}</span>${dec(c.decision)}<span class="faint num" style="margin-left:auto;font-size:12px">${c.items.length} items · ${c.tokens_in ?? "?"}→${c.tokens_out ?? "?"} tok</span></summary>
      <div class="next-list" style="margin-top:8px">${c.items.map((it) => it.source_id ? `<a class="next-item ctx" href="${sourceHref(it)}"><span>${esc(it.title || it.id)}</span><span class="pill">${KINDS[it.kind] || it.kind || ""}</span></a>` : /^(exercise|code|run):/.test(it.id) ? `<div class="next-item ctx faint">${esc(it.id)} · sent with this call only, not stored</div>` : `<div class="next-item ctx faint">${esc(it.id)} · deleted since</div>`).join("") || `<div class="faint">No context items.</div>`}</div></details>`).join("")}</div>`
      : `<div class="empty"><p style="max-width:56ch;margin:0 auto">No AI call yet. When the tutor, grader or wiki agent calls a model, each call appears here with the exact items it was given.</p></div>`;
  }, (e) => { const el = $("#calls"); if (el) el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; });
};

/* ---------------- proof loop: daily questions you can't fake ---------------- */
let proofDue = null; /* nav badge */
const refreshProof = () => { if (!(Sync && Sync.enabled)) return; api("GET", "/api/proof").then((s) => { proofDue = s.due.length; markCleared(); nav(); if (route() === "now") render(); }, () => {}); };
/* Recall is cleared when something was answered today and nothing is due in Review or Proof. */
function markCleared() { const a = ACT(), q = SRS.queue(); if (a.recall > 0 && !a.cleared && !q.due.length && !q.fresh.length && !proofDue) { a.cleared = true; save(); nav(); } }
let masteryCache = null;
const refreshMastery = () => { if (!(Sync && Sync.enabled)) return Promise.resolve(null); return api("GET", "/api/proof/mastery").then((m) => { masteryCache = m; checkProofs = m.checks || {}; return m; }, () => null); };
let pf = null; /* answer in progress: { qid, text, started, typed, last, pasted } */
let pr = null; /* last graded result, shown until "Next" */
const scoreCls = (s) => s >= 70 ? "good" : s >= 50 ? "warn" : "bad";
const dueTxt = (d) => { const n = Math.round((Date.parse(d) - Date.parse(TODAY())) / 864e5); return n <= 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days (${d})`; };
VIEWS.proof = (v) => {
  if (needsWorker(v)) return;
  v.innerHTML = `<div class="faint">Loading…</div>`;
  api("GET", "/api/proof").then((s) => {
    if (route() !== "proof") return;
    proofDue = s.due.length; markCleared(); nav();
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
          .then((r) => { pr = { ...r, prompt: q.prompt }; pf = null; ACT().recall++; if (r.check_key && r.score >= 70 && !r.pasted) { ACT().checks++; checkProofs[r.check_key] = { proven: true, score: r.score }; } save(); refreshMastery(); render(); }, (e) => { fail(e); b.disabled = false; b.textContent = "Grade"; ta.readOnly = false; if (e.message && /retired/.test(e.message)) { pf = null; render(); } });
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
function masteryCard(el) {
  if (!el) return;
  api("GET", "/api/proof/mastery").then((m) => {
    if (!el.isConnected) return;
    const bar = (x) => x == null ? `<span class="faint">unproven</span>` : `<span class="row" style="gap:8px;flex-wrap:nowrap"><span class="progress" style="width:110px"><i style="width:${x}%"></i></span><span class="num">${x}%</span></span>`;
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
      (window.DRILLS || []).map((d) => ({ t: d.title, sub: `Arena · ML from scratch`, run: go(`#arena/${d.id}`) })),
      [{ t: "New note", sub: "Action", run: () => { const n = newNote(); location.hash = `#library/${n.id}`; } },
       { t: "Log a session", sub: "Action", run: go("#log") },
       { t: "Write a thought", sub: "Action · the assistant files it", run: () => openCapture() },
       { t: "Journal entry", sub: "Action", run: () => { const n = newNote({ kind: "journal", title: `Journal ${TODAY()}`, tags: ["journal"] }); location.hash = `#library/${n.id}`; } },
       { t: "Search the second brain", sub: "Action", run: go("#sources") },
       { t: "Review due cards", sub: "Action", run: go("#review") },
       { t: "Answer today's proof questions", sub: "Action", run: go("#proof") },
       { t: "Export backup", sub: "Action", run: () => $("#exportBtn").click() },
       { t: "Import backup", sub: "Action", run: () => $("#importFile").click() },
       { t: "Switch theme", sub: "Action", run: () => $("#themeBtn").click() }],
      C.modules.map((m) => ({ t: m.t, sub: `Path · ${stageOf(m).t}`, run: go(`#path/${m.id}`) })),
      S.notes.map((n) => ({ t: n.title || "Untitled", sub: `Note${(n.tags || []).length ? " · #" + n.tags.join(" #") : ""}`, body: n.body, run: go(`#library/${n.id}`) })),
      C.problems.map((p) => ({ t: p.pattern, sub: `Arena · ${p.fn}()`, run: go(`#arena/${p.id}`) })),
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
  const typing = a && (/INPUT|TEXTAREA|SELECT/.test(a.tagName) || a.isContentEditable || a.closest(".CodeMirror"));
  if (e.key === "/" && !Palette.isOpen() && !typing) { e.preventDefault(); Palette.open(""); }
  if ((e.key === "n" || e.key === "N") && !e.metaKey && !e.ctrlKey && !e.altKey && !Palette.isOpen() && !typing) { e.preventDefault(); openCapture(); }
});

/* ---------------- capture: a thought from anywhere, filed by the assistant ---------------- */
const DRAFT = "forge.capDraft";
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
function captureWhere() {
  const a = attribution(), r = route();
  if (a && a.note) return { label: a.note, mod: a.mod || null };
  if (r === "library" && routeArg()) { const n = noteById(routeArg()); if (n) return { label: `Notes · ${n.title}`, mod: n.mod || null }; }
  return { label: (ROUTES.find((x) => x[0] === r) || [r, r])[1], mod: (todayPlan && todayPlan.module) || null };
}
function fileLocally(d, text) {
  let n = null;
  if (d.note === "inbox") n = S.notes.find((x) => !x.deleted && (x.tags || []).includes("inbox"));
  else if (d.note !== "new") n = noteById(d.note);
  if (!n) n = d.note === "inbox" ? newNote({ title: "Inbox", tags: ["inbox"] }) : newNote({ title: d.title || text.trim().split(/\s+/).slice(0, 7).join(" "), mod: d.mod, tags: d.tags });
  const stamp = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const cards = (d.cards || []).map((c) => `Q: ${c.q}\nA: ${c.a}`).join("\n\n");
  n.body = `${(n.body || "").trimEnd()}\n\n## ${stamp} · ${d.heading || "Thought"}\n\n${text.trim()}\n${cards ? `\n${cards}\n` : ""}`.replace(/^\s+/, "");
  if (!n.mod && d.mod) n.mod = d.mod;
  n.tags = [...new Set([...(n.tags || []), ...(d.tags || [])])];
  n.updated = Date.now(); save();
  return n;
}
function openCapture() {
  if ($("#cap")) { $("#capText") && $("#capText").focus(); return; }
  const where = captureWhere(), el = document.createElement("div");
  el.className = "cap-back"; el.id = "cap";
  const close = () => { el.remove(); document.removeEventListener("keydown", esc_); };
  const esc_ = (e) => { if (e.key === "Escape") { e.preventDefault(); close(); } };
  const form = () => {
    el.innerHTML = `<div class="cap" role="dialog" aria-modal="true" aria-label="Write a thought">
      <div class="cap-h"><span class="eyebrow">A thought</span><span class="faint m">from ${esc(where.label)}</span><button class="x" id="capX" type="button">Esc</button></div>
      <textarea id="capText" class="cap-t" placeholder="What clicked, what is still fuzzy, an idea to try, a doubt… Write freely: the assistant files it in the right note, makes review cards from it and tells you what to push next."></textarea>
      <div class="cap-f"><span class="faint m">⌘↵ to file it</span><button class="btn primary" id="capGo" type="button">File it</button></div></div>`;
    const ta = $("#capText", el); ta.value = lsGet(DRAFT) || ""; ta.focus();
    ta.oninput = () => lsSet(DRAFT, ta.value || null);
    ta.onkeydown = (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); go(); } };
    $("#capX", el).onclick = close; $("#capGo", el).onclick = go;
  };
  const done = (n, d) => {
    const m = n.mod && modById(n.mod);
    el.innerHTML = `<div class="cap" role="dialog" aria-modal="true" aria-label="Thought filed">
      <div class="cap-h"><span class="eyebrow">Filed</span><span class="grow"></span><button class="x" id="capX" type="button">Esc</button></div>
      <div class="cap-done"><a class="cap-dest" href="#library/${n.id}">${esc(n.title)}</a><span class="faint m">${m ? `${esc(m.t)} · ` : ""}${(d.cards || []).length ? `${d.cards.length} review card${d.cards.length === 1 ? "" : "s"} · ` : ""}${d.fallback ? "inbox: the assistant was unavailable" : "filed by the assistant"}</span>
      ${d.nudge ? `<p class="nudge">${esc(d.nudge)}</p>` : ""}</div>
      <div class="cap-f"><button class="btn" id="capMore" type="button">Another thought</button><button class="btn primary" id="capClose" type="button">Done</button></div></div>`;
    $("#capX", el).onclick = close; $("#capClose", el).onclick = close; $("#capMore", el).onclick = form;
    $(".cap-dest", el).onclick = close; $("#capClose", el).focus();
  };
  async function go() {
    const ta = $("#capText", el), text = ta.value.trim(); if (!text) return ta.focus();
    const b = $("#capGo", el); b.disabled = true; b.textContent = "Filing…"; ta.readOnly = true;
    let d;
    if (Sync && Sync.enabled) {
      try { d = await api("POST", "/api/capture", { text, where, notes: S.notes.filter((n) => !n.deleted).slice(0, 60).map((n) => ({ id: n.id, title: n.title, mod: n.mod || null })), modules: C.modules.map((m) => ({ id: m.id, t: m.t })) }); }
      catch (e) { d = { note: "inbox", mod: where.mod, tags: [], cards: [], fallback: true }; }
    } else d = { note: "inbox", mod: where.mod, tags: [], cards: [], fallback: true };
    const n = fileLocally(d, text); lsSet(DRAFT, null); done(n, d);
    if (route() === "library") render();
  }
  el.onclick = (e) => { if (e.target === el) close(); };
  document.addEventListener("keydown", esc_);
  document.body.appendChild(el); form();
}

/* ---------------- the day is done: a short, satisfying moment, once per day ---------------- */
function dayDone() {
  const d = TODAY(); if (lsGet("forge.done") === d) return; lsSet("forge.done", d);
  setTimeout(celebrate, 350);
}
function celebrate() {
  const el = document.createElement("div"); el.className = "done-fx"; el.setAttribute("aria-hidden", "true");
  const N = 30;
  el.innerHTML = `<div class="done-burst">${Array.from({ length: N }, (_, i) => `<i style="--a:${(i * 360) / N + ((i * 37) % 11)}deg;--d:${130 + ((i * 53) % 110)}px;--h:var(--h${2 + (i % 4)});--t:${780 + (i % 6) * 35}ms"></i>`).join("")}</div>
    <div class="done-card"><div class="done-bars">${"<i></i>".repeat(NB())}</div><h2>Day complete<em>.</em></h2><p class="m">${NB()} / ${NB()} blocks · ${streak()}-day streak</p></div>`;
  document.body.appendChild(el); toast("Daily work complete.");
  setTimeout(() => el.remove(), 3200);
}
globalThis.ForgeFx = { celebrate };

/* ---------------- observation: active time, attributed to what is on screen ---------------- */
let lastInput = 0;
["keydown", "pointerdown", "wheel", "input"].forEach((e) => document.addEventListener(e, () => { lastInput = Date.now(); }, { passive: true, capture: true }));
document.addEventListener("scroll", () => { lastInput = Date.now(); }, { passive: true, capture: true });
function attribution() {
  const r = route(), arg = routeArg();
  if (r === "arena") { const it = arenaItem(); return it.col === "ml" ? { key: `drill:${it.d.id}`, area: it.d.track === "ml" ? "dl" : it.d.track, note: `Arena · ${it.d.title}` } : { key: `pat:${it.p.id}`, area: "code", note: `Arena · ${it.p.pattern}` }; }
  if (r === "path" && arg && modById(arg)) { const m = modById(arg); return { key: `mod:${m.id}`, area: stageOf(m).area, mod: m.id, note: `Path · ${m.t}` }; }
  if (r === "library" && arg) { const n = noteById(arg); if (!n) return null; const m = n.mod && modById(n.mod); return m ? { key: `mod:${m.id}`, area: stageOf(m).area, mod: m.id, note: `Notes · ${m.t}` } : { key: "notes" }; }
  if (r === "proof" || r === "review") return { key: r };
  if (r === "diagnostic") return { key: "diag" };
  return null;
}
const TICK = 15000;
setInterval(() => {
  if (document.hidden || !document.hasFocus() || Date.now() - lastInput > 60000) return;
  const a = attribution(); if (!a) return;
  const before = dayCount(TODAY()), act = ACT(), inc = TICK / 60000;
  act.min[a.key] = Math.round(((act.min[a.key] || 0) + inc) * 100) / 100;
  if (a.area) {
    let e = S.log.find((x) => x.src === "auto" && x.date === TODAY() && x.key === a.key);
    if (!e) { e = { id: uid(), date: TODAY(), min: 0, area: a.area, mod: a.mod || null, note: a.note, src: "auto", key: a.key }; S.log.push(e); }
    e.min = Math.round((e.min + inc) * 100) / 100;
  }
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  if (!syncT) schedSync(60000);
  if (dayCount(TODAY()) !== before) { nav(); if (dayCount(TODAY()) >= BANK && before < BANK) toast("Day banked."); }
}, TICK);

/* What the planner agent needs to know about the curriculum, synced with the state (only when it changes). */
function updateCtx() {
  const strip = (x) => String(x).replace(/<[^>]+>/g, "").replace(/\$/g, "");
  const act = C.modules.filter((m) => modStatus(m.id) === "active"), open = C.modules.filter((m) => modStatus(m.id) === "todo").slice(0, 2);
  const ctx = { drills: DR.map((d) => ({ id: d.id, title: d.title, lvl: d.lvl, track: d.track })),
    modules: act.concat(open).slice(0, 5).map((m) => ({ id: m.id, t: m.t, status: modStatus(m.id), track: TRACK_OF_AREA[stageOf(m).area], checks: m.checks.map(strip) })) };
  if (JSON.stringify(ctx) !== JSON.stringify(S.ctx)) { S.ctx = ctx; save(); }
}
/* Once a day: sync every repository (commits feed the "ship" block), then read commits per day. */
async function dailyWorker() {
  if (!(Sync && Sync.enabled)) return;
  const [p] = await Promise.all([api("GET", "/api/plan").catch(() => null), refreshMastery()]);
  todayPlan = p && p.plan; updateCtx();
  try {
    if (localStorage.getItem("forge.repoSync") !== TODAY()) {
      const repos = await api("GET", "/api/repos");
      for (const r of repos) for (let i = 0; i < 60; i++) { const x = await api("POST", `/api/repos/${r.id}/sync`, {}); if (x.done) break; }
      localStorage.setItem("forge.repoSync", TODAY());
    }
  } catch (e) {}
  try { const a = await api("GET", "/api/activity"); commitDays = a.commits || {}; localStorage.setItem("forge.commits", JSON.stringify(commitDays)); } catch (e) {}
  nav(); if (["now", "today", "path", "skills"].includes(route())) render();
}

/* ---------------- boot ---------------- */
applyTheme();
render();
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}
if (Sync) {
  updateCtx();
  if (S.notes.some((n) => n.visibility !== "ai")) { S.notes.forEach((n) => { n.visibility = "ai"; }); save(); }
  $("#capBtn").onclick = () => openCapture();
  Sync.detect().then((ok) => { if (ok) { Sync.sync(); refreshProof(); dailyWorker(); if (["sources", "context", "proof", "skills"].includes(route())) render(); } });
  setInterval(() => { if (!document.hidden && Sync.status !== "local") Sync.sync(); }, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) Sync.sync(); });
  window.addEventListener("online", () => Sync.sync());
}
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
document.addEventListener("visibilitychange", () => { if (!document.hidden && ["now", "today"].includes(route())) render(); });
})();
