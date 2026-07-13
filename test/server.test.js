import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Boots the real server against an isolated JSON store (temp DATA_DIR) and
// drives the whole API over HTTP. No secrets required — the server runs in
// demo mode, so every AI route returns its built-in believable sample content.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 19000 + Math.floor(Math.random() * 2000);
const BASE = `http://127.0.0.1:${PORT}`;
let proc, dataDir;

const api = async (method, route, { token, body } = {}) => {
  const res = await fetch(BASE + route, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
};

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), "cartoon-test-"));
  proc = spawn(process.execPath, [path.join(ROOT, "server", "index.js")], {
    // Force demo mode: an explicit empty ANTHROPIC_API_KEY wins over any local
    // .env (the loader never overrides a set var), so tests never hit live AI.
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, AUTH_SECRET: "test-secret", ANTHROPIC_API_KEY: "" },
    stdio: "ignore",
  });
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`${BASE}/api/health`); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("server did not start");
});

after(() => {
  proc?.kill();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

test("health reports demo mode", async () => {
  const r = await api("GET", "/api/health");
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.enabled, false);
  assert.equal(r.body.model, "demo");
});

test("config exposes plans, credit packs and disabled billing", async () => {
  const r = await api("GET", "/api/config");
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.plans) && r.body.plans.length === 3);
  assert.equal(r.body.stripe, false);
  assert.equal(r.body.imageProvider, "toonrender");
  assert.equal(r.body.user, null);
  assert.ok(Array.isArray(r.body.creditPacks) && r.body.creditPacks.length === 3);
  assert.equal(r.body.creditPacksEnabled, false);
});

test("signup validates email/password and blocks duplicates", async () => {
  assert.equal((await api("POST", "/api/auth/signup", { body: { email: "nope", password: "longenough" } })).status, 400);
  assert.equal((await api("POST", "/api/auth/signup", { body: { email: "a@b.co", password: "12345" } })).status, 400);

  const ok = await api("POST", "/api/auth/signup", { body: { email: "artist@example.com", password: "secret123" } });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  assert.equal(ok.body.user.plan, "free");
  assert.equal(ok.body.user.creditsLeft, 8);
  assert.ok(ok.body.user.referralCode);

  assert.equal((await api("POST", "/api/auth/signup", { body: { email: "artist@example.com", password: "secret123" } })).status, 400);
});

test("login rejects wrong passwords and returns a token", async () => {
  assert.equal((await api("POST", "/api/auth/login", { body: { email: "artist@example.com", password: "nope" } })).status, 400);
  const ok = await api("POST", "/api/auth/login", { body: { email: "artist@example.com", password: "secret123" } });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
});

test("/api/cartoon requires a prompt and returns a render spec with a palette", async () => {
  assert.equal((await api("POST", "/api/cartoon", { body: { prompt: "  " } })).status, 400);
  const r = await api("POST", "/api/cartoon", { body: { prompt: "a grumpy cat in a wizard hat" } });
  assert.equal(r.status, 200);
  assert.equal(r.body.type, "design");
  assert.ok(r.body.design && r.body.design.imagePrompt && r.body.design.caption);
  assert.ok(r.body.design.palette && r.body.design.palette.primary);
});

test("cartoons spend credits and stop at the free-plan limit", async () => {
  const signup = await api("POST", "/api/auth/signup", { body: { email: "spender@example.com", password: "secret123" } });
  const token = signup.body.token;
  assert.equal(signup.body.user.creditsLeft, 8);
  for (let i = 0; i < 8; i++) {
    const r = await api("POST", "/api/cartoon", { token, body: { prompt: `idea ${i}` } });
    assert.equal(r.status, 200, `cartoon ${i} should succeed`);
    assert.equal(r.body.user.creditsLeft, 7 - i);
  }
  const overdrawn = await api("POST", "/api/cartoon", { token, body: { prompt: "one too many" } });
  assert.equal(overdrawn.status, 402);
  assert.equal(overdrawn.body.error, "out_of_credits");
});

test("comic studio is gated on auth and a premium plan", async () => {
  const anon = await api("POST", "/api/comic", { body: { idea: "cat breakfast", panels: 4 } });
  assert.equal(anon.status, 401);

  const { body: { token } } = await api("POST", "/api/auth/login", { body: { email: "artist@example.com", password: "secret123" } });
  const gated = await api("POST", "/api/comic", { token, body: { idea: "cat breakfast", panels: 4 } });
  assert.equal(gated.status, 403);
  assert.equal(gated.body.error, "premium_required");

  assert.equal((await api("POST", "/api/comic", { token, body: { idea: "  " } })).status, 400);
});

test("sticker studio is gated on auth and a premium plan", async () => {
  const anon = await api("POST", "/api/stickers", { body: { character: "Biscuit", count: 6 } });
  assert.equal(anon.status, 401);
  const { body: { token } } = await api("POST", "/api/auth/login", { body: { email: "artist@example.com", password: "secret123" } });
  assert.equal((await api("POST", "/api/stickers", { token, body: { character: "Biscuit" } })).status, 403);
});

test("character kit is gated on auth and a premium plan", async () => {
  assert.equal((await api("POST", "/api/characterkit", { body: { name: "X" } })).status, 401);
  const { body: { token } } = await api("POST", "/api/auth/login", { body: { email: "artist@example.com", password: "secret123" } });
  assert.equal((await api("POST", "/api/characterkit", { token, body: { name: "Biscuit", primary: "#ff0000" } })).status, 403);
});

test("character designer and captions return believable content", async () => {
  const ch = await api("POST", "/api/character", { body: { description: "a brave dumpling knight" } });
  assert.equal(ch.status, 200);
  assert.ok(ch.body.name && ch.body.imagePrompt && ch.body.palette);

  const caps = await api("POST", "/api/captions", { body: { topic: "working from home with a cat", count: 4 } });
  assert.equal(caps.status, 200);
  assert.ok(typeof caps.body.text === "string" && caps.body.text.length > 0);
  assert.equal((await api("POST", "/api/captions", { body: {} })).status, 400);
});

test("toonify requires an image payload", async () => {
  assert.equal((await api("POST", "/api/toonify", { body: {} })).status, 400);
});

test("colouring page requires a prompt and returns a line-art spec", async () => {
  assert.equal((await api("POST", "/api/coloring", { body: { prompt: "  " } })).status, 400);
  const r = await api("POST", "/api/coloring", { body: { prompt: "a friendly dragon tea party" } });
  assert.equal(r.status, 200);
  assert.equal(r.body.type, "design");
  assert.equal(r.body.design.line, true);
  assert.ok(r.body.design.imagePrompt && r.body.design.title);
});

test("billing checkout is gated on auth and Stripe configuration", async () => {
  assert.equal((await api("POST", "/api/billing/checkout", { body: { plan: "creator" } })).status, 401);
  const { body: { token } } = await api("POST", "/api/auth/login", { body: { email: "artist@example.com", password: "secret123" } });
  assert.equal((await api("POST", "/api/billing/checkout", { token, body: { plan: "creator" } })).status, 400);
});

test("gallery saves, lists and deletes creations for a signed-in user", async () => {
  // Anonymous access is rejected.
  assert.equal((await api("GET", "/api/gallery")).status, 401);
  assert.equal((await api("POST", "/api/gallery", { body: { type: "cartoon", design: {} } })).status, 401);

  const { body: { token } } = await api("POST", "/api/auth/login", { body: { email: "artist@example.com", password: "secret123" } });

  // Starts empty.
  assert.deepEqual((await api("GET", "/api/gallery", { token })).body.items, []);

  // A save without a design is rejected; a valid save round-trips.
  assert.equal((await api("POST", "/api/gallery", { token, body: { type: "cartoon" } })).status, 400);
  const saved = await api("POST", "/api/gallery", {
    token,
    body: { type: "cartoon", caption: "a happy robot", design: { caption: "a happy robot", imagePrompt: "robot", palette: { primary: "#fff", outline: "#000" } } },
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.items.length, 1);
  const id = saved.body.items[0].id;
  assert.equal(saved.body.items[0].type, "cartoon");
  assert.equal(saved.body.items[0].caption, "a happy robot");

  // An unknown creation type is rejected.
  assert.equal((await api("POST", "/api/gallery", { token, body: { type: "bogus", design: { caption: "x" } } })).status, 400);

  // Delete removes it.
  const del = await api("DELETE", `/api/gallery/${id}`, { token });
  assert.equal(del.status, 200);
  assert.deepEqual(del.body.items, []);
});

test("referrals grant bonus credits to both parties", async () => {
  const referrer = await api("POST", "/api/auth/signup", { body: { email: "referrer@example.com", password: "secret123" } });
  const code = referrer.body.user.referralCode;
  const invited = await api("POST", "/api/auth/signup", { body: { email: "invited@example.com", password: "secret123", ref: code } });
  assert.equal(invited.body.user.creditsLeft, 8 + 15); // free 8 + 15 referral bonus
  assert.equal(invited.body.user.bonusCredits, 15);

  const me = await api("GET", "/api/me", { token: referrer.body.token });
  assert.equal(me.body.user.creditsLeft, 8 + 15);
  assert.equal(me.body.user.referrals, 1);
});
