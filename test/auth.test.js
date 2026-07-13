import test from "node:test";
import assert from "node:assert/strict";
import { makeToken, verifyToken, publicUser, PLAN_CREDITS, isPremium } from "../server/auth.js";

// Pure-logic unit tests for the token signer and credit accounting.

test("tokens round-trip and reject tampering", () => {
  const token = makeToken("user-123");
  assert.equal(verifyToken(token), "user-123");
  const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
  assert.equal(verifyToken(tampered), null);
  assert.equal(verifyToken(""), null);
  assert.equal(verifyToken("only.two"), null);
});

test("an expired token is rejected", () => {
  assert.equal(verifyToken(`user-123.${Date.now() - 1000}.deadbeef`), null);
});

test("PLAN_CREDITS covers every plan with sane allowances", () => {
  assert.equal(PLAN_CREDITS.free, 8);
  assert.equal(PLAN_CREDITS.creator, 150);
  assert.equal(PLAN_CREDITS.studio, Infinity);
});

test("publicUser reports credit math and premium per plan", () => {
  assert.equal(publicUser(null), null);

  const free = publicUser({ id: "1", email: "F@x.co", plan: "free", creditsUsed: 2, period: period() });
  assert.equal(free.creditsAllowed, 8);
  assert.equal(free.creditsLeft, 6);
  assert.equal(free.premium, false);

  const creator = publicUser({ id: "2", email: "c@x.co", plan: "creator", creditsUsed: 10, period: period() });
  assert.equal(creator.creditsLeft, 140);
  assert.equal(creator.premium, true);

  const studio = publicUser({ id: "3", email: "s@x.co", plan: "studio", creditsUsed: 999, period: period() });
  assert.equal(studio.creditsAllowed, "unlimited");
  assert.equal(studio.creditsLeft, "unlimited");
});

test("purchased/bonus credits add on top of the monthly allowance", () => {
  const u = publicUser({ id: "7", email: "b@x.co", plan: "free", creditsUsed: 8, bonusCredits: 20, period: period() });
  assert.equal(u.creditsLeft, 20); // monthly exhausted, 20 purchased remain
  const partial = publicUser({ id: "8", email: "b2@x.co", plan: "free", creditsUsed: 3, bonusCredits: 4, period: period() });
  assert.equal(partial.creditsLeft, 5 + 4);
});

test("isPremium reflects paid plans only", () => {
  assert.equal(isPremium({ plan: "free" }), false);
  assert.equal(isPremium({ plan: "creator" }), true);
  assert.equal(isPremium({ plan: "studio" }), true);
  assert.equal(isPremium(null), false);
});

test("a stale credit period resets usage to zero", () => {
  const stale = publicUser({ id: "6", email: "p@x.co", plan: "free", creditsUsed: 7, period: "2000-1" });
  assert.equal(stale.creditsUsed, 0);
  assert.equal(stale.creditsLeft, 8);
});

function period() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
}
