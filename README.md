# Forge

A personal training system for going deep in ML engineering, from first principles to GPUs, while staying interview-ready.

**Learn**
- **Path**: 28 modules in 6 stages (foundations → Karpathy's Zero to Hero → deep-learning depth → LLMs → systems/CUDA/Triton/llm.c → research craft). Each module has curated resources, a from-scratch deliverable with a proof link, and exit checks. "Copy quiz prompt" turns the checks into an examiner prompt for Claude.
- **Library**: your knowledge base. Markdown with `$math$`, code blocks, `[[wikilinks]]` with backlinks, tags, and a link to a Path module.
- **Review**: spaced repetition (SM-2 style). A seed deck of key facts, plus every `Q:`/`A:` pair or `term :: definition` line in your notes. Keys: Space shows the answer, 1–4 grade it.

**Practice**: **Arena** (15 patterns, real Python via Pyodide against hidden tests, timed mocks) and **Diagnostic** (coding plus ML, math and systems parts).

**Track**: **Log** (deep-work sessions by area and module; focus timers and module buttons log for you), **Skills**, **Scorecard**, **Pipeline**.

Search everything with **⌘K / Ctrl K** or `/`.

All data stays in your browser (localStorage, with persistent storage requested). Open tabs stay in sync. Use **Export** regularly: the sidebar shows how old your last backup is.

Static site: open `index.html` through any web server (`python3 -m http.server`), or GitHub Pages. Curriculum and seed cards live in `path.js`; daily blocks, problems and diagnostics in `content.js`.
