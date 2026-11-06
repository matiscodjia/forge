// Skill shape robustness: self-rating alone can't inflate a track, evidence moves it, old evidence fades,
// hints and pasted work count less (or not at all), and the shape never collapses on tracks without evidence.
import { test } from "node:test";
import assert from "node:assert/strict";
import "../../web/shape.js";
const { evidence, compute, isoMonday } = globalThis.ForgeShape;

const tracks = [{ k: "coding", t: "Coding", target: 4 }, { k: "ml", t: "ML", target: 4 }, { k: "math", t: "Math", target: 4 }, { k: "eng", t: "English", target: 4 }, { k: "reach", t: "Visibility", target: 4 }];
const drills = [{ id: "softmax", track: "ml", lvl: 1, title: "Softmax" }, { id: "attention", track: "ml", lvl: 3, title: "Attention" }, { id: "micrograd", track: "ml", lvl: 4, title: "micrograd" }];
const C = { problems: [{ id: "two-sum", pattern: "Hash map" }], modules: [{ id: "m1", stage: "s0", t: "Linear algebra" }], stages: [{ k: "s0", area: "math" }] };
const blank = () => ({ drills: {}, practice: {}, mocks: [], theory: [], path: {}, log: [], weeks: {} });
const today = "2026-11-06";
const row = (rows, k) => rows.find((r) => r.k === k);

test("no evidence: the estimate is the self-rating minus one level, flagged unmeasured", () => {
  const r = compute(tracks, { ml: 5, coding: 0 }, evidence({ S: blank(), C, drills, today }));
  assert.equal(row(r, "ml").est, 4); assert.equal(row(r, "ml").measured, null); assert.equal(row(r, "ml").conf, 0);
  assert.equal(row(r, "coding").est, 0, "never negative");
});

test("evidence pulls the estimate toward what was measured, more as it accumulates", () => {
  const S = blank();
  S.drills.softmax = { attempts: 1, solved: true, solvedAt: today, hints: 0 };
  const one = row(compute(tracks, { ml: 5 }, evidence({ S, C, drills, today })), "ml");
  S.drills.attention = { attempts: 3, solved: true, solvedAt: today, hints: 0 };
  S.drills.micrograd = { attempts: 2, solved: true, solvedAt: today, hints: 0 };
  const three = row(compute(tracks, { ml: 5 }, evidence({ S, C, drills, today })), "ml");
  assert.ok(one.conf < three.conf && three.unc < one.unc, "more evidence → more confident");
  assert.ok(Math.abs(three.measured - (2.25 + 3.75 + 4.5) / 3) < 1e-9);
  assert.ok(three.est < 4 && three.est > three.measured, "self-rating 5 only nudges it");
  assert.equal(one.gap, null, "one drill (conf 0.22) is too little to call a gap");
  assert.ok(three.conf > 0.5 && Math.abs(three.gap - (5 - three.measured)) < 1e-9, "three drills: the gap is shown");
});

test("Proof mastery is evidence; many honest reviews dominate the self-rating", () => {
  const mastery = { tracks: [{ key: "math", mastery: 40, proven: 12 }] };
  const r = row(compute(tracks, { math: 5 }, evidence({ S: blank(), C, drills, mastery, today })), "math");
  assert.ok(r.conf > 0.95); assert.ok(Math.abs(r.est - 2) < 0.2, `est ${r.est}`);
  assert.ok(r.gap > 2.9, "self-rated 5, measured 2: flagged");
});

test("hints lower a solved drill; old evidence fades; tried-but-unsolved counts little", () => {
  const S = blank(), at = (st) => row(compute(tracks, {}, evidence({ S: Object.assign(blank(), { drills: { attention: st } }), C, drills, today })), "ml");
  const clean = at({ attempts: 1, solved: true, solvedAt: today, hints: 0 }), hinted = at({ attempts: 1, solved: true, solvedAt: today, hints: 3 });
  assert.ok(hinted.measured < clean.measured - 1);
  const old = at({ attempts: 1, solved: true, solvedAt: "2026-02-06", hints: 0 });
  assert.ok(old.W < clean.W * 0.1, "nine months old weighs < 10%");
  const tried = at({ attempts: 4, solved: false, last: today });
  assert.ok(tried.W < clean.W && tried.measured === 1);
});

test("patterns, mocks, diagnostics, modules, English minutes and the scorecard all count", () => {
  const S = blank();
  S.practice["two-sum"] = { attempts: 2, solved: true, timed: true, solvedAt: today };
  S.mocks.push({ date: today, score: 80 });
  S.theory.push({ part: "math", date: today, score: 60 });
  S.path.m1 = { status: "done", finished: today, proof: "https://github.com/x/y" };
  S.log.push({ date: today, area: "eng", min: 90 });
  S.weeks["2026-W45"] = { week: "2026-W45", sent: 10, replies: 2, interviews: 0 };
  const ev = evidence({ S, C, drills, today });
  assert.deepEqual([...new Set(ev.map((e) => e.track))].sort(), ["coding", "eng", "math", "reach", "ship"]);
  assert.equal(ev.find((e) => e.kind === "log").v, 3);
  assert.equal(ev.find((e) => e.kind === "week").v, 3.5);
  assert.equal(isoMonday("2026-W45"), "2026-11-02");
});
