// Cloudflare Access JWT verification with real RS256 keys.
import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyAccess } from "../src/auth.js";

const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
async function keypair(kid) {
  const k = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  return { kid, priv: k.privateKey, jwk: { ...(await crypto.subtle.exportKey("jwk", k.publicKey)), kid } };
}
async function sign(kp, claims, head = {}) {
  const h = enc({ alg: "RS256", kid: kp.kid, ...head }), p = enc(claims);
  const s = Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", kp.priv, new TextEncoder().encode(`${h}.${p}`))).toString("base64url");
  return `${h}.${p}.${s}`;
}
const env = { ACCESS_TEAM: "matis", ACCESS_AUD: "aud123", ACCESS_EMAIL: "me@x.dev" };
const now = Math.floor(Date.now() / 1000);
const good = { aud: ["aud123"], iss: "https://matis.cloudflareaccess.com", exp: now + 600, email: "me@x.dev" };

test("Access JWT: valid token passes, every tampering fails", async () => {
  const kp = await keypair("k1"), other = await keypair("k1");
  let certCalls = 0;
  const f = async (url) => { certCalls++; assert.equal(url, "https://matis.cloudflareaccess.com/cdn-cgi/access/certs"); return new Response(JSON.stringify({ keys: [kp.jwk] })); };
  const req = (tok, where = "header") => new Request("https://forge.example.com/api/health", { headers: where === "header" ? { "cf-access-jwt-assertion": tok } : { cookie: `a=1; CF_Authorization=${tok}` } });
  assert.deepEqual(await verifyAccess(req(await sign(kp, good)), env, { fetch: f }), { email: "me@x.dev" });
  assert.deepEqual(await verifyAccess(req(await sign(kp, good), "cookie"), env, { fetch: f }), { email: "me@x.dev" });
  const fails = async (tok, status) => { await assert.rejects(verifyAccess(req(tok), env, { fetch: f }), (e) => e.status === status); };
  await fails(await sign(other, good), 401);                                        // signed by another key with the same kid
  await fails(await sign(kp, { ...good, aud: ["someone-else"] }), 403);
  await fails(await sign(kp, { ...good, iss: "https://evil.cloudflareaccess.com" }), 403);
  await fails(await sign(kp, { ...good, exp: now - 1 }), 401);
  await fails(await sign(kp, { ...good, email: "intruder@x.dev" }), 403);
  await fails(await sign(kp, good, { alg: "none" }), 401);
  await fails(await sign(kp, good, { kid: "unknown" }), 401);
  const [h, , s] = (await sign(kp, good)).split(".");
  await fails(`${h}.${enc({ ...good, email: "me@x.dev", exp: now + 99999 })}.${s}`, 401);  // payload swapped, signature kept
  await assert.rejects(verifyAccess(new Request("https://forge.example.com/api/health"), env, { fetch: f }), (e) => e.status === 401);
  assert.ok(certCalls <= 2, "certs are cached");
});
