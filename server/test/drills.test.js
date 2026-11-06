// Arena drills: every reference solution passes all its tests in Pyodide + numpy (the browser runtime),
// every starter fails, and a loop-based attention is caught by the vectorization test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { SOLUTIONS } from "../src/drills.js";

const R = new URL("../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, R), "utf8");
const ctx = { window: {} }; vm.runInNewContext(read("web/drills.js"), ctx);
const DRILLS = ctx.window.DRILLS;

let run;
async function harness() {
  if (run) return run;
  const { loadPyodide } = createRequire(import.meta.url)("pyodide");
  const py = await loadPyodide(); await py.loadPackage("numpy");
  py.FS.writeFile("/home/pyodide/harness.py", read("web/harness.py"));
  py.runPython("import sys; sys.path.insert(0, '/home/pyodide'); import harness");
  const fn = py.pyimport("harness").run_drill, pre = read("web/drill_prelude.py");
  return (run = (code, d) => JSON.parse(fn(code, JSON.stringify(d.fns), d.tests, pre)));
}

test("drill catalogue is well formed", () => {
  assert.ok(DRILLS.length >= 12);
  assert.equal(new Set(DRILLS.map((d) => d.id)).size, DRILLS.length);
  for (const d of DRILLS) {
    assert.ok(SOLUTIONS[d.id], `solution for ${d.id}`);
    assert.ok(d.fns.length && d.title && d.desc && d.starter && /def test_/.test(d.tests), d.id);
    const body = SOLUTIONS[d.id].split("\n").map((l) => l.trim()).filter((l) => l.length > 12 && !/^(?:(?:def|class|import|from)\b|self\.\w+ = )/.test(l));
    const starter = new Set(d.starter.split("\n").map((l) => l.trim()));
    assert.deepEqual(body.filter((l) => starter.has(l)), [], `${d.id}: starter leaks solution lines`);
  }
});

test("references pass, starters fail", { timeout: 180000 }, async () => {
  const r = await harness();
  for (const d of DRILLS) {
    const sol = r(SOLUTIONS[d.id], d), st = r(d.starter, d);
    assert.ok(sol.results, `${d.id}: ${sol.error}`);
    assert.deepEqual(sol.results.filter((x) => !x.ok).map((x) => `${x.label}: ${x.msg}`), [], d.id);
    assert.ok(st.error || st.results.some((x) => !x.ok), `${d.id}: the starter passes everything`);
  }
});

test("a loop over T fails the vectorization test, nothing else", { timeout: 180000 }, async () => {
  const r = await harness(), d = DRILLS.find((x) => x.id === "attention");
  const loop = `import numpy as np
def attention(q, k, v):
    B, T, d = q.shape
    out = np.zeros_like(q)
    for b in range(B):
        for t in range(T):
            s = q[b, t] @ k[b, : t + 1].T / np.sqrt(d)
            w = np.exp(s - s.max()); w /= w.sum()
            out[b, t] = w @ v[b, : t + 1]
    return out
`;
  assert.deepEqual(r(loop, d).results.filter((x) => !x.ok).map((x) => x.name), ["test_vectorized"]);
});
