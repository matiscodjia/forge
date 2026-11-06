// Chunking: code by function/class/impl (with doc comments and attributes), Markdown by heading, plain text by window.
// Every chunk: { text, meta: { path?, lines: [first, last] (1-based, inclusive), symbol?, heading?, page?, lang } }.

const EXT = {
  rs: "rust", py: "python", js: "js", mjs: "js", cjs: "js", jsx: "js", ts: "js", tsx: "js", go: "go", lua: "lua",
  c: "c", h: "c", cc: "c", cpp: "c", cxx: "c", hpp: "c", hh: "c", cu: "c", cuh: "c", java: "c", kt: "c", swift: "c",
  md: "md", markdown: "md", mdx: "md", rst: "text", txt: "text", toml: "text", yaml: "text", yml: "text", json: "text", sh: "text", cfg: "text", ini: "text", sql: "text"
};
export const langOf = (path) => EXT[(String(path).split(".").pop() || "").toLowerCase()] || null;

const DECL = {
  rust: /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:(?:async|const|unsafe|extern\s+"[^"]*")\s+)*fn\s+(\w+)|^\s*(?:pub(?:\([^)]*\))?\s+)?(?:struct|enum|trait|union|mod)\s+(\w+)|^\s*(?:unsafe\s+)?impl\b\s*(?:<[^{]*?>\s*)?([^{]*?)\s*(?:\{.*)?$|^\s*macro_rules!\s*(\w+)/,
  python: /^\s*(?:async\s+)?def\s+(\w+)|^\s*class\s+(\w+)/,
  js: /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\*?\s*(\w*)|^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)|^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|\w+\s*=>)/,
  go: /^func\s+(?:\([^)]*\)\s*)?(\w+)|^type\s+(\w+)\s+(?:struct|interface)/,
  lua: /^\s*(?:local\s+)?function\s+([\w.:]+)/,
  c: /^(?!(?:if|for|while|switch|return|else|do|case|typedef|#)\b)[A-Za-z_][\w\s*&:<>,~]*?\b(~?\w+)\s*\([^;]*\)\s*(?:const\s*)?(?:noexcept\s*)?(?:override\s*)?\{?\s*$|^(?:class|struct)\s+(\w+)[^;]*$/
};
// Lines that belong to the declaration below them: doc comments, attributes, decorators.
const LEAD = /^\s*(?:\/\/\/|\/\/!|\/\*\*|\*(?!\/)|\*\/|#\[|#!\[|@\w|\/\/|#(?!\[)\s)/;
const MAX_LINES = 150, WINDOW = 120;

function windows(lines, from, to, base) {
  const out = [];
  for (let a = from; a < to; a += WINDOW) out.push({ a, b: Math.min(to, a + WINDOW), ...base });
  return out;
}
const trimRange = (lines, a, b) => { while (b > a && !lines[b - 1].trim()) b--; while (a < b && !lines[a].trim()) a++; return [a, b]; };

/** Split source code into one chunk per top-level item (functions, methods, types, impl blocks). */
export function chunkCode(path, text) {
  const lang = langOf(path);
  if (lang === "md") return chunkMarkdown(text, { path });
  const lines = String(text).replace(/\r/g, "").split("\n"), re = DECL[lang];
  if (!re) return chunkText(text, { path, lang: lang || "text" });
  const starts = [];
  let inBlockComment = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (inBlockComment) { if (l.includes("*/")) inBlockComment = false; continue; }
    if (/^\s*\/\*/.test(l) && !l.includes("*/")) { inBlockComment = !/^\s*\/\*\*/.test(l) ? true : inBlockComment; if (inBlockComment) continue; }
    if (lang === "c" && /^\s/.test(l)) continue; // C-like: only column-0 declarations
    const m = l.match(re);
    if (!m) continue;
    let s = i; while (s > 0 && LEAD.test(lines[s - 1]) && !(starts.length && s - 1 <= starts[starts.length - 1].line)) s--;
    starts.push({ line: i, from: s, symbol: (m.slice(1).find((x) => x && x.trim()) || "").trim().replace(/\s+/g, " ").slice(0, 80) });
  }
  const parts = [];
  if (!starts.length) return chunkText(text, { path, lang });
  if (starts[0].from > 0) parts.push({ a: 0, b: starts[0].from, symbol: "(header)" });
  starts.forEach((st, k) => parts.push({ a: st.from, b: k + 1 < starts.length ? starts[k + 1].from : lines.length, symbol: st.symbol }));
  const out = [];
  for (const p of parts) {
    const [a, b] = trimRange(lines, p.a, p.b);
    if (b <= a) continue;
    const pieces = b - a > MAX_LINES ? windows(lines, a, b, { symbol: p.symbol }) : [{ a, b, symbol: p.symbol }];
    for (const q of pieces) out.push({ text: lines.slice(q.a, q.b).join("\n"), meta: { path, lines: [q.a + 1, q.b], symbol: q.symbol, lang } });
  }
  return out;
}

/** Markdown by heading; long sections split by paragraphs (~1500 chars). */
export function chunkMarkdown(text, base = {}) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const secs = []; let cur = { a: 0, heading: null }, inCode = false;
  lines.forEach((l, i) => {
    if (/^\s*```/.test(l)) inCode = !inCode;
    const m = !inCode && l.match(/^(#{1,4})\s+(.*)/);
    if (m && i > cur.a) { secs.push({ ...cur, b: i }); cur = { a: i, heading: m[2].trim() }; }
    else if (m) cur.heading = m[2].trim();
  });
  secs.push({ ...cur, b: lines.length });
  const out = [];
  for (const s of secs) {
    const [a, b] = trimRange(lines, s.a, s.b);
    if (b <= a) continue;
    let start = a, size = 0;
    for (let i = a; i <= b; i++) {
      const end = i === b, len = end ? 0 : lines[i].length + 1;
      if (end || (size + len > 1500 && !lines[i].trim() && i > start)) {
        const [x, y] = trimRange(lines, start, i);
        if (y > x) out.push({ text: lines.slice(x, y).join("\n"), meta: { ...base, lines: [x + 1, y], heading: s.heading, lang: "md" } });
        start = i; size = 0;
      }
      size += len;
    }
  }
  return out;
}

export function chunkText(text, base = {}) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  return windows(lines, 0, lines.length, {}).map((w) => { const [a, b] = trimRange(lines, w.a, w.b); return b > a ? { text: lines.slice(a, b).join("\n"), meta: { ...base, lines: [a + 1, b] } } : null; }).filter(Boolean);
}

export async function sha256(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Chunks → rows for the chunks table. Identical texts in one source collapse to one row. */
export async function toRows(sourceId, visibility, chunks) {
  const seen = new Set(), rows = [];
  for (const c of chunks) {
    const hash = await sha256(c.text);
    if (seen.has(hash)) continue; seen.add(hash);
    rows.push({ id: `${sourceId}:${hash.slice(0, 24)}`, source_id: sourceId, ord: rows.length, text: c.text, meta: JSON.stringify(c.meta || {}), visibility, hash });
  }
  return rows;
}

/** One INSERT per ≤1.5 MB of rows (D1 counts statements, not rows). Existing ids keep their text; order and meta are refreshed. */
export function insertChunks(db, rows) {
  const stmts = []; let batch = [], size = 0;
  const flush = () => { if (!batch.length) return; stmts.push(db.prepare(
    `INSERT INTO chunks (id, source_id, ord, text, meta, visibility, hash)
     SELECT json_extract(j.value, '$.id'), json_extract(j.value, '$.source_id'), json_extract(j.value, '$.ord'), json_extract(j.value, '$.text'),
            json_extract(j.value, '$.meta'), json_extract(j.value, '$.visibility'), json_extract(j.value, '$.hash')
     FROM json_each(?1) j WHERE true
     ON CONFLICT(id) DO UPDATE SET ord = excluded.ord, meta = excluded.meta, visibility = excluded.visibility`).bind(JSON.stringify(batch))); batch = []; size = 0; };
  for (const r of rows) { const n = r.text.length + r.meta.length + 200; if (size + n > 1_500_000) flush(); batch.push(r); size += n; }
  flush();
  return stmts;
}
