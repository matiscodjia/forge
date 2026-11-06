# Forge server — second brain

One Cloudflare Worker serves the app (`web/`) and the API (`/api/*`), with D1 (SQL + FTS5) as the source of truth.
Later milestones add Vectorize, Workers AI embeddings and cron triggers.

## Run and deploy
```sh
npm test          # 15 tests: context gate, Access JWT, sync end to end (no dependencies)
npm run dev       # local D1 + wrangler dev on http://localhost:8787 (AUTH=dev from .dev.vars, localhost only)
npm run deploy    # remote migrations + deploy
```
Sync: the browser keeps working from localStorage (offline-first) and syncs with `/api/state` after each save,
on focus, when the network returns and every minute. Keys merge when two devices changed them (records unioned by id);
notes are last-writer-wins on `updated`, deletions travel as tombstones. Notes are stored in `sources` with their AI visibility.

The API refuses every request unless a valid Cloudflare Access JWT is present (`ACCESS_TEAM`, `ACCESS_AUD`, optional
`ACCESS_EMAIL` in `wrangler.jsonc`); with those unset it answers 503. Static files carry no personal data.

```
browser (Forge) ──► Cloudflare Access (only Matis) ──► Worker /api/*
                                                     ├─ D1: sources, chunks, chunks_fts, wiki, questions, reviews, ai_audit
                                                     ├─ Vectorize: embeddings of non-private chunks only
                                                     ├─ Workers AI: bge-m3 embeddings
                                                     └─ contextGate ─► callLLM ─► provider (cheap | trusted)
```

## Guarantee: one choke point
- `src/gate.js` · `contextGate(items, provider, {task, decision})` drops every item above the provider's clearance (and every `private` item, always), redacts emails and phone numbers, and builds the `ai_audit` row. It returns a frozen, branded `GatedContext`.
- `src/llm.js` · `callLLM` is the only code that calls a provider, and it **refuses anything that isn't a GatedContext**: no code path can hand raw rows to `fetch`. The audit row is written even when the call fails.
- `src/router.js` · `resolveRoute(task, items, config)` switches provider only when the route declares a `fallback`; otherwise items are excluded. The decision (`route` · `switched` · `excluded`) is stored in `ai_audit.decision`.
- Unknown visibility values are dropped (fail closed); SQL `CHECK`s reject them at write time.

`npm test` (Node ≥ 22, no dependencies) runs the M7 acceptance tests against a mock provider.

## Config (Worker vars + secrets)
```json
{
  "providers": {
    "cheap":   { "clearance": "ai",      "baseUrl": "https://api.deepseek.com/v1", "model": "deepseek-chat", "keyEnv": "CHEAP_KEY" },
    "trusted": { "clearance": "trusted", "baseUrl": "https://api.mistral.ai/v1",    "model": "mistral-large-latest", "keyEnv": "TRUSTED_KEY" }
  },
  "routes": {
    "question_gen": "cheap", "grading": "cheap",
    "wiki":  { "provider": "cheap", "fallback": "trusted" },
    "agent": "trusted"
  }
}
```
Any OpenAI-compatible `/chat/completions` endpoint works. API keys are Worker secrets (`wrangler secret put CHEAP_KEY`), never in the repo.

## Milestones
| | Status | Done when |
|---|---|---|
| M7 Context flows | **gate, router, audit, schema + tests done.** Per-note visibility toggle done. Remaining: Context inspector view, vector deletion on → private | mixed items: only allowed ones reach the mock provider; audit lists exactly those ids ✅ |
| M0 Backend base | **built and tested locally**; deploy needs the Cloudflare account | Worker deployed behind Access; local data (notes, log, reviews) syncs to D1 |
| M8 Ingestion | | ROUILLE sync → one chunk per function with path + lines; re-sync creates nothing |
| M11 Proof loop | | a week of simulated reviews gives correct due dates; pasted answers never raise mastery |
| M9 Hybrid + agentic RAG | | "Why const generics in ROUILLE?" cites real chunks; private journal → "not available to the AI" |
| M10 LLM Wiki | | a SENTINEL commit changing the Kalman update yields a cited proposal on `kalman-filter` |
| M12 Life context | | brief and weekly review cite sources; audit shows no private item used |

M11 comes before M9/M10: it only needs chunks + one cheap model, and it is the part that turns reading into proof.
