// Capture: the assistant files a thought (existing note or new one, module, tags, cards, a nudge); invented ids are
// dropped; without a model it goes to Inbox.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileThought, validateFiling } from "../src/capture.js";
import { fakeD1, setup } from "./helpers/env.js";

const notes = [{ id: "n1", title: "Attention — notes", mod: "gpt" }, { id: "n2", title: "Kalman", mod: null }];
const modules = [{ id: "gpt", t: "GPT from scratch" }, { id: "linalg", t: "Linear algebra" }];
const AIwith = (reply) => { const calls = []; return { calls, run: async (m, { messages }) => { calls.push(messages); return { response: reply }; } }; };

test("a thought is filed into the right note, with cards and a nudge; the model sees everything", async () => {
  const AI = AIwith('```json\n{"note": "n1", "title": "ignored", "mod": "gpt", "tags": ["#Attention", "Mask"], "heading": "Mask before softmax", "cards": [{"q": "Where does the causal mask go?", "a": "On the scores, before the softmax."}, {"q": "x"}, {"q": "a", "a": "b"}, {"q": "c", "a": "d"}], "nudge": "Now derive why −∞ and not 0."}\n```');
  const r = await fileThought(fakeD1(), { AI }, { text: "Le masque se met avant le softmax.", where: { label: "Arena · Causal self-attention", mod: "gpt" }, notes, modules });
  assert.equal(r.note, "n1"); assert.equal(r.title, ""); assert.equal(r.mod, "gpt");
  assert.deepEqual(r.tags, ["attention", "mask"]); assert.equal(r.cards.length, 2); assert.equal(r.cards[0].a, "On the scores, before the softmax.");
  assert.match(r.nudge, /−∞/);
  assert.match(AI.calls[0][0].content, /Always write in English, even when/, "one language for every call");
  const user = AI.calls[0][1].content;
  assert.match(user, /Le masque se met avant le softmax/); assert.match(user, /n1: Attention — notes \[gpt\]/); assert.match(user, /Arena · Causal self-attention/);
});

test("invented ids are dropped; unusable reply or no provider → Inbox", async () => {
  assert.deepEqual(validateFiling({ note: "n9", title: "New idea", mod: "nope" }, { notes, modules }).note, "new");
  assert.equal(validateFiling({ note: "n9", title: "New idea", mod: "nope" }, { notes, modules }).mod, null);
  const r = await fileThought(fakeD1(), { AI: AIwith("I would put it in your notes.") }, { text: "x", where: { mod: "linalg" }, notes, modules });
  assert.equal(r.note, "inbox"); assert.equal(r.fallback, true); assert.equal(r.mod, "linalg");
  assert.equal((await fileThought(fakeD1(), {}, { text: "x", notes, modules })).note, "inbox");
  await assert.rejects(fileThought(fakeD1(), {}, { text: "  " }), (e) => e.status === 400);
});

test("health reports the assistant route", async () => {
  const { call } = setup({ AI: AIwith("{}") });
  assert.equal((await call("GET", "/api/health")).assistant, true);
});
