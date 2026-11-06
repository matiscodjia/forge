/* Forge runner: executes Python with Pyodide off the main thread.
   kind "problem": interview pattern (fn + cases). kind "drill": ML from scratch (numpy + test_* functions). */
importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

let H = null, prelude = "";
const ready = (async () => {
  const py = await loadPyodide();
  const [src, pre] = await Promise.all([fetch("harness.py").then((r) => r.text()), fetch("drill_prelude.py").then((r) => r.text())]);
  py.FS.writeFile("/home/pyodide/harness.py", src);
  py.runPython("import sys; sys.path.insert(0, '/home/pyodide'); import harness");
  H = py.pyimport("harness"); prelude = pre;
  postMessage({ type: "ready" });
  await py.loadPackage("numpy");
  postMessage({ type: "numpy" });
  return py;
})();
ready.catch((e) => postMessage({ type: "fatal", error: String(e) }));

onmessage = async (e) => {
  const { id, kind, code } = e.data;
  try {
    await ready;
    const out = kind === "drill"
      ? H.run_drill(code, JSON.stringify(e.data.fns || []), e.data.tests, prelude)
      : H.run(code, e.data.fn, JSON.stringify(e.data.cases), e.data.cmp);
    postMessage({ type: "result", id, data: JSON.parse(out) });
  } catch (err) {
    postMessage({ type: "result", id, data: { error: String(err) } });
  }
};
