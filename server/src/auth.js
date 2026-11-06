// Cloudflare Access: verify the signed JWT on every /api request. Fails closed when Access isn't configured.
// Env: ACCESS_TEAM (e.g. "matis" for matis.cloudflareaccess.com), ACCESS_AUD (the application's AUD tag).
// Local dev only: AUTH = "dev" in .dev.vars, honoured only for localhost requests.

const b64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
const json = (s) => JSON.parse(new TextDecoder().decode(b64u(s)));
let jwks = { at: 0, team: null, keys: [] };

async function keysFor(team, f) {
  if (jwks.team === team && Date.now() - jwks.at < 3600e3 && jwks.keys.length) return jwks.keys;
  const r = await f(`https://${team}.cloudflareaccess.com/cdn-cgi/access/certs`);
  if (!r.ok) throw new Error(`Access certs: ${r.status}`);
  jwks = { at: Date.now(), team, keys: (await r.json()).keys || [] };
  return jwks.keys;
}

function tokenFrom(req) {
  const h = req.headers.get("cf-access-jwt-assertion");
  if (h) return h;
  const c = (req.headers.get("cookie") || "").match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return c ? c[1] : null;
}

/** Returns { email } or throws an Error with .status. */
export async function verifyAccess(req, env, { fetch: f = fetch, now = () => Date.now() / 1000 } = {}) {
  const host = new URL(req.url).hostname;
  if (env.AUTH === "dev" && (host === "localhost" || host === "127.0.0.1")) return { email: "dev@localhost" };
  if (!env.ACCESS_TEAM || !env.ACCESS_AUD) throw Object.assign(new Error("Cloudflare Access is not configured"), { status: 503 });
  const tok = tokenFrom(req);
  if (!tok) throw Object.assign(new Error("Not signed in"), { status: 401 });
  const [h, p, s] = tok.split(".");
  if (!h || !p || !s) throw Object.assign(new Error("Malformed token"), { status: 401 });
  const head = json(h), claims = json(p);
  if (head.alg !== "RS256") throw Object.assign(new Error("Unexpected algorithm"), { status: 401 });
  const jwk = (await keysFor(env.ACCESS_TEAM, f)).find((k) => k.kid === head.kid);
  if (!jwk) throw Object.assign(new Error("Unknown signing key"), { status: 401 });
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64u(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw Object.assign(new Error("Bad signature"), { status: 401 });
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(env.ACCESS_AUD)) throw Object.assign(new Error("Wrong audience"), { status: 403 });
  if (claims.iss !== `https://${env.ACCESS_TEAM}.cloudflareaccess.com`) throw Object.assign(new Error("Wrong issuer"), { status: 403 });
  if (!claims.exp || claims.exp < now()) throw Object.assign(new Error("Token expired"), { status: 401 });
  if (env.ACCESS_EMAIL && claims.email !== env.ACCESS_EMAIL) throw Object.assign(new Error("Not allowed"), { status: 403 });
  return { email: claims.email };
}
