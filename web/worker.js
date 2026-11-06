/* Forge runner: executes Python solutions with Pyodide, off the main thread. */
importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

let runFn = null;
const ready = (async () => {
  const py = await loadPyodide();
  const src = await (await fetch("harness.py")).text();
  py.FS.writeFile("/home/pyodide/harness.py", src);
  py.runPython("import sys; sys.path.insert(0, '/home/pyodide'); import harness");
  runFn = py.pyimport("harness").run;
})();

ready.then(() => postMessage({ type: "ready" }), (e) => postMessage({ type: "fatal", error: String(e) }));

onmessage = async (e) => {
  const { id, code, fn, cases, cmp } = e.data;
  try {
    await ready;
    const out = runFn(code, fn, JSON.stringify(cases), cmp);
    postMessage({ type: "result", id, data: JSON.parse(out) });
  } catch (err) {
    postMessage({ type: "result", id, data: { error: String(err) } });
  }
};
