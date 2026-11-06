// "I don't know": explanation + references from the brain; a Proof question explained this way is a failed review
// that comes back soon (and lowers mastery honestly). Every call asks for English and $LaTeX$.
import { test } from "node:test";
import assert from "node:assert/strict";
import { explainCard, giveUp, related } from "../src/explain.js";
import { mastery } from "../src/proof.js";
import { createSource, appendParts } from "../src/sources.js";
import { fakeD1, setup } from "./helpers/env.js";

const LESSON = "**Intuition.** A matrix is a function on vectors.\n\n**Precisely.** $(AB)_{ij} = \\sum_k A_{ik} B_{kj}$ [src:explain:item]\n\n**Example.** …\n\n**Check yourself.** Why is $AB \\neq BA$?";
const AI = () => { const calls = []; return { calls, run: async (m, { messages }) => { calls.push({ sys: messages[0].content, user: messages[1].content }); return { response: LESSON }; } }; };
async function brain(db) {
  const { id } = await createSource(db, { kind: "course", title: "MIT 18.06 — matrix multiplication", origin: "1806.pdf" });
  await appendParts(db, id, { parts: [{ text: "Matrix multiplication is composition of linear maps: column j of AB is A times column j of B. ".repeat(4) }, { text: "Unrelated: Kalman filters predict then update. ".repeat(6) }] });
  return id;
}

test("a card is explained with brain references; the note itself is not cited back", async () => {
  const db = fakeD1(), ai = AI(); const sid = await brain(db);
  const r = await explainCard(db, { AI: ai }, { front: "Why is the matrix product a composition of linear maps?", back: "Apply B then A.", note: { id: "n1", title: "Linear algebra notes", body: "Q: Why is the matrix product…\nA: Apply B then A." } });
  assert.match(r.text, /^\*\*Intuition\.\*\*/); assert.ok(!r.text.includes("[src:"), "citation markers stripped");
  assert.equal(r.refs[0].source_id, sid); assert.equal(r.refs[0].title, "MIT 18.06 — matrix multiplication");
  assert.match(ai.calls[0].user, /matrix multiplication is composition/i);
  assert.match(ai.calls[0].sys, /Always write in English/); assert.match(ai.calls[0].sys, /LaTeX between \$\.\.\.\$/);
  assert.deepEqual(await related(db, "zzzz qqqq"), []);
  await assert.rejects(explainCard(db, { AI: ai }, { front: " " }), (e) => e.status === 400);
  await assert.rejects(explainCard(db, {}, { front: "x" }), (e) => e.status === 503);
});

test("giving up on a Proof question: explained, scored 0, due tomorrow, counts against mastery", async () => {
  const db = fakeD1(), ai = AI(); await brain(db);
  await db.prepare(`INSERT INTO questions (id, chunk_id, source_id, kind, project, track, concept, prompt, rubric, source_title, source_text, source_meta, visibility, created, day, due)
    VALUES ('q1', 'c', 's', 'course', NULL, 'math', 'matrix product', 'Show that AB is the composition of the maps.', '- apply B then A', 'Notes', 'AB x = A(Bx)', '{}', 'ai', 'x', '2026-11-06', '2026-11-06')`).run();
  const now = new Date("2026-11-06T10:00:00+01:00");
  const r = await giveUp(db, { AI: ai }, "q1", { now });
  assert.equal(r.score, 0); assert.equal(r.gaveUp, true); assert.equal(r.due, "2026-11-07"); assert.match(r.explain.text, /Check yourself/);
  await assert.rejects(giveUp(db, { AI: ai }, "q1", { now }), (e) => e.status === 409, "once a day");
  const m = await mastery(db, { AI: ai }, { now });
  assert.equal(m.tracks.find((t) => t.key === "math").mastery, 0);
});

test("routes", async () => {
  const { call } = setup({ AI: AI() });
  assert.match((await call("POST", "/api/explain", { front: "What is a linear map?" })).text, /Intuition/);
  await assert.rejects(call("POST", "/api/proof/nope/giveup", {}), (e) => e.status === 404);
});

test("references are study material that shares the topic, never code that merely mentions a word", async () => {
  const db = fakeD1();
  const repo = await createSource(db, { kind: "course", title: "sentinel/sentinel-sim/pyproject.toml", origin: "github" });
  await appendParts(db, repo.id, { parts: [{ text: '[project]\nname = "sentinel-sim"\ndependencies = ["numpy", "matplotlib", "scipy"]\n'.repeat(4) }] });
  await db.prepare("UPDATE sources SET kind = 'repo' WHERE id = ?").bind(repo.id).run(); // repos come from the GitHub sync
  const once = await createSource(db, { kind: "course", title: "Plotting notes", origin: "manual" });
  await appendParts(db, once.id, { parts: [{ text: "I plot the trajectories with matplotlib and numpy arrays, nothing about reductions. ".repeat(3) }] });
  const good = await createSource(db, { kind: "course", title: "NumPy broadcasting and reductions", origin: "numpy.pdf" });
  await appendParts(db, good.id, { parts: [{ text: "A reduction over an axis removes that axis; keepdims keeps it with size one so the result broadcasts back. ".repeat(3) }] });
  const r = await related(db, "numpy axis keepdims");
  assert.deepEqual(r.map((x) => x.title), ["NumPy broadcasting and reductions"]);
});
