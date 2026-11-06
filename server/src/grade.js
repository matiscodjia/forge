// Grading that the model cannot make up. The model only judges each rubric point (full / partial / missing) and must
// quote the exact words of Matis's answer that cover it; the code checks every quote against the answer, drops what it
// cannot find, subtracts verified factual errors, and computes the score itself. Temperature 0: same answer, same grade.
// A contested grade is re-graded by independent examiners; with a large disagreement, the median of three is kept.
import { ask, parseJSON } from "./proof.js";

const bad = (m, status = 400) => Object.assign(new Error(m), { status });
const cut = (s, n) => String(s ?? "").slice(0, n);
export const CREDIT = { full: 1, partial: 0.5, missing: 0 };
export const ERROR_PENALTY = 10, MAX_PENALTY = 30;

const BASE = `You grade Matis's answer to an exam question, point by point against the numbered rubric. The source holds the question, the rubric and the original material; his answer follows the sources.
For EACH rubric point, decide:
- "full": stated correctly and specifically in his answer;
- "partial": present but vague, incomplete or partly wrong;
- "missing": not in his answer. Never credit what is not written, even if he probably knows it.
For "full" and "partial", copy the exact words of his answer that cover the point (verbatim, 3 to 30 words), in "quote".
Also list up to 3 factual errors: statements in his answer that are wrong, quoted verbatim, with a short reason.
Judge content, not style or language. Restating the question or listing buzzwords covers nothing.
Reply with JSON only:
{"points": [{"i": 1, "verdict": "full", "quote": "..."}, {"i": 2, "verdict": "missing", "quote": ""}], "errors": [{"quote": "...", "why": "..."}], "fix": "<one line: the most important missing or wrong point, or 'Nothing to fix.'>"}`;
export const EXAMINERS = [
  BASE,
  `You are a second, independent examiner: the first grade of this answer was contested and may be wrong in either direction. Re-read his answer from scratch.\n${BASE}`,
  `You are a third examiner settling a disagreement between two grades. Be exact: credit precisely what is written, nothing more, nothing less.\n${BASE}`
];

/** "- a\n- b" (stored rubric) or ["a", "b"] → ["a", "b"] */
export function rubricList(r) {
  const xs = Array.isArray(r) ? r : String(r || "").split("\n");
  return xs.map((x) => String(x).replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim()).filter(Boolean).slice(0, 8);
}
const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
/** Is this quote really in the answer? Exact after normalisation, or ≥ 80% of its words present (light paraphrase of punctuation/order). */
export function found(quote, answer) {
  const q = norm(quote), a = norm(answer);
  if (q.length < 3) return false;
  if (a.includes(q)) return true;
  const words = q.split(" ").filter((w) => w.length >= 3); if (words.length < 2) return false;
  const have = new Set(a.split(" "));
  return words.filter((w) => have.has(w)).length / words.length >= 0.8;
}

/** The score, computed here from the verdicts: mean credit over the rubric, minus verified errors. */
export function scoreFrom(points, reply, answer) {
  const v = Array.isArray(reply?.points) ? reply.points : [];
  const rows = points.map((text, i) => {
    const r = v.find((x) => Number(x?.i) === i + 1) || v[i] || {};
    const said = Object.hasOwn(CREDIT, r.verdict) ? r.verdict : "missing", quote = cut(r.quote, 400).trim();
    const ok = said === "missing" || found(quote, answer);
    return { text, verdict: ok ? said : "missing", claimed: said, quote: said === "missing" ? "" : quote, verified: said !== "missing" && ok };
  });
  const errors = (Array.isArray(reply?.errors) ? reply.errors : []).slice(0, 3).map((e) => ({ quote: cut(e?.quote, 300).trim(), why: cut(e?.why, 200).trim() })).filter((e) => e.quote && found(e.quote, answer));
  const credit = rows.reduce((a, r) => a + CREDIT[r.verdict], 0);
  const penalty = Math.min(MAX_PENALTY, errors.length * ERROR_PENALTY);
  const score = points.length ? Math.max(0, Math.min(100, Math.round((100 * credit) / points.length) - penalty)) : 0;
  return { score, points: rows, errors, penalty };
}

/** Grade one answer. → { score, fix, detail: { points, errors, penalty, examiner } } */
export async function gradeAnswer(db, env, { id, kind = "question", title = "", question, rubric, material = "", answer }, { now = new Date(), fetch: f, examiner = 0 } = {}) {
  const points = rubricList(rubric);
  if (!points.length) throw bad("This question has no rubric to grade against.", 409);
  const item = { id: id || "grade:item", kind, visibility: "ai", title: cut(title, 200),
    text: `Question:\n${question}\n\nRubric:\n${points.map((p, i) => `${i + 1}. ${p}`).join("\n")}${material ? `\n\nSource material:\n${cut(material, 6000)}` : ""}` };
  const { text } = await ask(db, env, "grading", [item], EXAMINERS[examiner] || BASE, `Answer:\n${answer}`, { now, fetch: f, maxTokens: 900, temperature: 0 });
  const x = parseJSON(text);
  if (!x || !Array.isArray(x.points)) throw bad("The grader did not return a point-by-point grade. Try again.", 502);
  const s = scoreFrom(points, x, answer);
  return { score: s.score, fix: cut(x.fix, 600).trim() || (s.score >= 90 ? "Nothing to fix." : "Cover the missing rubric points."), detail: { points: s.points, errors: s.errors, penalty: s.penalty, examiner } };
}

/** Contested grade: an independent examiner; if it disagrees by more than 15, a third one and the median wins. */
export async function regrade(db, env, args, first, opts = {}) {
  const second = await gradeAnswer(db, env, args, { ...opts, examiner: 1 });
  if (Math.abs(second.score - first) <= 15) { const score = Math.round((first + second.score) / 2); return { ...second, score, grades: [first, second.score], rule: "mean of two" }; }
  const third = await gradeAnswer(db, env, args, { ...opts, examiner: 2 });
  const all = [first, second.score, third.score], med = [...all].sort((a, b) => a - b)[1];
  const pick = med === third.score ? third : med === second.score ? second : third;
  return { ...pick, score: med, grades: all, rule: "median of three" };
}
