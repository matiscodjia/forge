// Skill shape robustness: no self-rating at all; a track without evidence is "not measured" (never zero, never
// guessed); evidence accumulates into confidence; old evidence fades; hints count less; checks and commits count.
import { test } from "node:test";
import assert from "node:assert/strict";
import "../../web/shape.js";
const { evidence, compute, isoMonday } = globalThis.ForgeShape;

const tracks = [{ k: "coding", t: "Coding", target: 4 }, { k: "ml", t: "ML", target: 4 }, { k: "math", t: "Math", target: 4 }, { k: "ship", t: "Shipped", target: 4 }];
const drills = [{ id: "softmax", track: "ml", lvl: 1, title: "Softmax" }, { id: "attention", track: "ml", lvl: 3, title: "Attention" }, { id: "micrograd", track: "ml", lvl: 4, title: "micrograd" }];
const C = { problems: [{ id: "two-sum", pattern: "Hash map" }], modules: [{ id: "m1", stage: "s0", t: "Linear algebra" }], stages: [{ k: "s0", area: "math" }] };
const blank = () => ({ drills: {}, practice: {}, mocks: [], theory: [], path: {}, log: [], weeks: {}, skills: { ml: 5 } });
const today = "2026-11-06";
const row = (rows, k) => rows.find((r) => r.k === k);
const shape = (S, extra = {}) => compute(tracks, evidence({ S, C, drills, today, ...extra }));

test("no evidence: not measured, whatever the old self-rating said", () => {
  const r = row(shape(blank()), "ml");
  assert.equal(r.est, null); assert.equal(r.unc, null); assert.equal(r.conf, 0);
});

test("evidence sets the level; more evidence → more confidence, less uncertainty", () => {
  const S = blank();
  S.drills.softmax = { attempts: 1, solved: true, solvedAt: today, hints: 0 };
  const one = row(shape(S), "ml");
  assert.equal(one.est, 2.25);
  S.drills.attention = { attempts: 3, solved: true, solvedAt: today, hints: 0 };
  S.drills.micrograd = { attempts: 2, solved: true, solvedAt: today, hints: 0 };
  const three = row(shape(S), "ml");
  assert.ok(Math.abs(three.est - (2.25 + 3.75 + 4.5) / 3) < 1e-9);
  assert.ok(one.conf < three.conf && three.unc < one.unc);
});

test("Proof mastery and proven exit checks are evidence", () => {
  const r = row(shape(blank(), { mastery: { tracks: [{ key: "math", mastery: 40, proven: 12 }], checks: { "m1#0": { proven: true, score: 85 }, "m1#1": { proven: false, score: 30 } } } }), "math");
  assert.equal(r.n, 2); assert.ok(r.est > 2 && r.est < 3.5); assert.ok(r.conf > 0.95);
});

test("hints lower a solved drill; old evidence fades; tried-but-unsolved counts little", () => {
  const at = (st) => row(shape(Object.assign(blank(), { drills: { attention: st } })), "ml");
  const clean = at({ attempts: 1, solved: true, solvedAt: today, hints: 0 }), hinted = at({ attempts: 1, solved: true, solvedAt: today, hints: 3 });
  assert.ok(hinted.est < clean.est - 1);
  assert.ok(at({ attempts: 1, solved: true, solvedAt: "2026-02-06", hints: 0 }).W < clean.W * 0.1, "nine months old weighs < 10%");
  const tried = at({ attempts: 4, solved: false, last: today });
  assert.ok(tried.W < clean.W && tried.est === 1);
});

test("patterns, mocks, diagnostics, modules and commit days all count", () => {
  const S = blank();
  S.practice["two-sum"] = { attempts: 2, solved: true, timed: true, solvedAt: today };
  S.mocks.push({ date: today, score: 80 });
  S.theory.push({ part: "math", date: today, score: 60 });
  S.path.m1 = { status: "done", finished: today, proof: "https://github.com/x/y" };
  const ev = evidence({ S, C, drills, today, commits: { "2026-11-05": 3, "2026-11-04": 1, "2026-10-01": 2 } });
  assert.deepEqual([...new Set(ev.map((e) => e.track))].sort(), ["coding", "math", "ship"]);
  const c = ev.filter((e) => e.kind === "commits");
  assert.equal(c.length, 2); assert.equal(c.find((e) => /this week/.test(e.label)).v, 2);
  assert.equal(isoMonday("2026-W45"), "2026-11-02");
});
