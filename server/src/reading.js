// Reading importer: one click on a Path paper or blog post puts its text in the brain (visibility "ai"), linked to
// the module, so Proof questions and the tutor can use what you are actually reading. arXiv links are read from
// arXiv's HTML version (or ar5iv for older papers); other pages are read as HTML. PDFs outside arXiv are refused:
// they go through Sources, where the browser extracts them.
import { chunkMarkdown, toRows, insertChunks } from "./chunk.js";

const bad = (m, status = 400) => Object.assign(new Error(m), { status });
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID().replace(/-/g, "").slice(0, 20);
const MAX_BYTES = 6_000_000, MAX_TEXT = 400_000, MAX_CHUNKS = 400;

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", times: "×", minus: "−" };
export const decode = (s) => String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === "#") { const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; }
  return ENT[e.toLowerCase()] ?? m;
});
const strip = (s) => decode(String(s).replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

/** Readable Markdown from an article page: main content only, headings kept, math as $LaTeX$, references dropped. */
export function htmlToMarkdown(html) {
  let s = String(html);
  const title = strip((s.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
  const pick = (tag) => (s.match(new RegExp(`<${tag}[\\s>][\\s\\S]*</${tag}>`, "i")) || [])[0];
  s = pick("article") || pick("main") || pick("body") || s;
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<math\b[^>]*?alttext="([^"]*)"[^>]*>[\s\S]*?<\/math>/gi, (m, a) => ` $${decode(a).replace(/\s+/g, " ").trim()}$ `);
  s = s.replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|button|select|iframe|template)\b[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (m, n, t) => `\n\n${"#".repeat(Math.min(4, +n))} ${strip(t)}\n\n`);
  s = s.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (m, t) => `\n\n\`\`\`\n${decode(t.replace(/<[^>]+>/g, ""))}\n\`\`\`\n\n`);
  s = s.replace(/<li\b[^>]*>/gi, "\n- ").replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|section|li|ul|ol|tr|table|blockquote|figcaption|dd|dt)>/gi, "\n\n");
  s = s.replace(/<[^>]+>/g, "");
  let inCode = false;
  s = decode(s).split("\n").map((l) => { if (/^```/.test(l)) { inCode = !inCode; return l; } return inCode ? l : l.replace(/[ \t ]+/g, " ").trim(); }).join("\n");
  s = s.replace(/\n{3,}/g, "\n\n").trim();
  const ref = s.search(/^#{1,4} *(?:[\dA-Z.]+ *)?(References|Bibliography)\s*$/im);
  if (ref > 2000) s = s.slice(0, ref).trim();
  return { title, text: s.slice(0, MAX_TEXT) };
}

/** Where to read a URL from: arXiv abstract/PDF links become their HTML renderings. */
export function candidates(url) {
  const m = url.match(/^https?:\/\/(?:www\.)?arxiv\.org\/(?:abs|pdf|html)\/([\w.\/-]+?)(?:v\d+)?(?:\.pdf)?\/?$/i);
  if (m) return [`https://arxiv.org/html/${m[1]}`, `https://ar5iv.labs.arxiv.org/html/${m[1]}`];
  return [url];
}

function checkUrl(raw) {
  let u; try { u = new URL(String(raw || "")); } catch (e) { throw bad("A valid URL is required"); }
  if (!/^https?:$/.test(u.protocol)) throw bad("Only http(s) links can be read");
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(u.hostname) || /^[\d.]+$|:/.test(u.hostname)) throw bad("This host can't be read");
  return u.href;
}

async function read(url, f) {
  const r = await f(url, { headers: { accept: "text/html,text/plain;q=0.9", "user-agent": "Forge reading importer (personal study app)" }, redirect: "follow" });
  if (!r.ok) return { status: r.status };
  const type = (r.headers.get("content-type") || "").toLowerCase();
  if (type.includes("pdf")) return { pdf: true };
  const len = +(r.headers.get("content-length") || 0); if (len > MAX_BYTES) return { status: 413 };
  const body = await r.text(); if (body.length > MAX_BYTES) return { status: 413 };
  return type.includes("html") || /^\s*</.test(body) ? htmlToMarkdown(body) : { title: "", text: body.slice(0, MAX_TEXT) };
}

/** POST /api/reading { url, title?, mod? } → { id, chunks, existing } */
export async function importReading(db, b, { fetch: f = fetch } = {}) {
  const url = checkUrl(b?.url);
  const dup = await db.prepare("SELECT id, (SELECT count(*) FROM chunks c WHERE c.source_id = s.id) AS n FROM sources s WHERE origin = ? AND deleted = 0").bind(url).first();
  if (dup) return { id: dup.id, chunks: dup.n, existing: true };
  let got = null, pdf = false;
  for (const c of candidates(url)) {
    const r = await read(c, f);
    if (r.pdf) { pdf = true; continue; }
    if (r.text && r.text.length >= 800) { got = r; break; }
  }
  if (!got) throw bad(pdf ? "This link is a PDF: download it and add it from Sources, where it is extracted in your browser." : "No readable text found at this link.", 422);
  const title = String(b.title || got.title || url).trim().slice(0, 300);
  const mod = b.mod ? String(b.mod).slice(0, 60) : null;
  const id = uid(), t = now();
  const parts = chunkMarkdown(got.text, { url, ...(mod ? { mod } : {}) }).filter((c) => c.text.replace(/^#.*$/gm, "").trim().length >= 60);
  const rows = (await toRows(id, "ai", parts)).slice(0, MAX_CHUNKS);
  await db.batch([
    db.prepare("INSERT INTO sources (id, kind, title, project, visibility, origin, created, updated, rev) VALUES (?, 'course', ?, NULL, 'ai', ?, ?, ?, 0)").bind(id, title, url, t, t),
    ...insertChunks(db, rows)
  ]);
  return { id, chunks: rows.length, existing: false };
}
