// Pure-logic unit tests. No browser, no framework — just Node's assert.
import assert from "node:assert/strict";

import { hashString, createRng } from "../js/lib/rng.js";
import { buildMasterPrompt, getStyle, STYLES } from "../js/lib/prompts.js";
import { renderCartoon } from "../js/lib/renderer.js";
import { validateForm, validators } from "../js/lib/validate.js";
import {
  planPrice, PLANS, quoteCommercial, printPrice, cartTotal, STYLE_PACKS,
} from "../js/lib/pricing.js";

export const tests = {
  "hashString is deterministic and unsigned"() {
    assert.equal(hashString("cartoon"), hashString("cartoon"));
    assert.notEqual(hashString("cartoon"), hashString("studio"));
    assert.ok(hashString("x") >= 0);
  },

  "seeded rng is reproducible"() {
    const a = createRng(42);
    const b = createRng(42);
    assert.equal(a.next(), b.next());
    const r = createRng(1);
    assert.ok(r.int(1, 6) >= 1 && r.int(1, 6) <= 6);
    assert.ok(["a", "b", "c"].includes(createRng(9).pick(["a", "b", "c"])));
  },

  "buildMasterPrompt includes subject, style phrasing and negatives"() {
    const mp = buildMasterPrompt("pop", "a robot chef");
    assert.match(mp.positive, /a robot chef/);
    assert.match(mp.positive, /pop-art/i);
    assert.match(mp.positive, /masterpiece/);
    assert.ok(mp.negative.length > 0);
    assert.equal(mp.styleName, "Pop Art");
  },

  "buildMasterPrompt falls back for empty subject"() {
    const mp = buildMasterPrompt("water", "   ");
    assert.match(mp.positive, /friendly character/);
  },

  "getStyle returns a valid style or default"() {
    assert.equal(getStyle("noir").id, "noir");
    assert.equal(getStyle("nope").id, STYLES[0].id);
  },

  "renderCartoon is deterministic per prompt+style"() {
    const a = renderCartoon({ prompt: "a fox", style: "chibi" });
    const b = renderCartoon({ prompt: "a fox", style: "chibi" });
    assert.equal(a, b);
    assert.match(a, /^<svg/);
    assert.match(a, /viewBox="0 0 512 512"/);
  },

  "renderCartoon varies with different input"() {
    const a = renderCartoon({ prompt: "a fox", style: "chibi" });
    const b = renderCartoon({ prompt: "a bear", style: "chibi" });
    const c = renderCartoon({ prompt: "a fox", style: "noir" });
    assert.notEqual(a, b);
    assert.notEqual(a, c);
  },

  "renderCartoon escapes prompt text in the aria label"() {
    const svg = renderCartoon({ prompt: '<script>"x"', style: "pop" });
    assert.doesNotMatch(svg, /<script>/);
    assert.match(svg, /&lt;script&gt;/);
  },

  "every style renders valid, balanced svg"() {
    for (const s of STYLES) {
      const svg = renderCartoon({ prompt: "test subject", style: s.id });
      assert.match(svg, /<\/svg>$/);
      const open = (svg.match(/<g[ >]/g) || []).length;
      const close = (svg.match(/<\/g>/g) || []).length;
      assert.equal(open, close, `unbalanced <g> in style ${s.id}`);
    }
  },

  "validators catch empty and malformed input"() {
    assert.ok(validators.name(""));
    assert.equal(validators.name("Ada"), "");
    assert.ok(validators.email("nope"));
    assert.equal(validators.email("a@b.co"), "");
    assert.ok(validators.message("hi"));
    assert.equal(validators.message("a proper enquiry here"), "");
  },

  "validateForm aggregates errors"() {
    const bad = validateForm({ name: "", email: "x", message: "" });
    assert.equal(bad.valid, false);
    assert.equal(Object.keys(bad.errors).length, 3);
    const good = validateForm({ name: "Ada", email: "a@b.co", message: "please make me a cartoon" });
    assert.equal(good.valid, true);
  },

  "annual plan price gives a discount vs monthly x12"() {
    const pro = PLANS.find((p) => p.id === "pro");
    const monthlyYear = pro.monthly * 12;
    assert.ok(planPrice(pro, "annual") < monthlyYear);
    assert.equal(planPrice(pro, "monthly"), pro.monthly);
  },

  "commercial quote scales with scope, reach, assets and modifiers"() {
    const base = quoteCommercial({ scope: "social", reach: "local", assets: 1 });
    const big = quoteCommercial({ scope: "packaging", reach: "global", assets: 3 });
    assert.ok(big.total > base.total);
    const excl = quoteCommercial({ scope: "social", reach: "local", assets: 1, exclusive: true });
    assert.ok(excl.total > base.total);
    // per-asset should be reported and consistent
    assert.equal(big.perAsset, Math.round(big.total / 3));
    // guards against zero/negative assets
    assert.ok(quoteCommercial({ assets: 0 }).total > 0);
  },

  "print price applies bulk discount at volume"() {
    const one = printPrice({ product: "print", size: "m", qty: 1 });
    const twelve = printPrice({ product: "print", size: "m", qty: 12 });
    assert.equal(twelve.bulkApplied, true);
    assert.ok(twelve.total < one.unit * 12);
    assert.ok(printPrice({ product: "canvas", size: "l" }).total > printPrice({ product: "sticker", size: "s" }).total);
  },

  "cartTotal sums price * qty"() {
    assert.equal(cartTotal([{ price: 10, qty: 2 }, { price: 8, qty: 1 }]), 28);
    assert.equal(cartTotal([]), 0);
    assert.ok(STYLE_PACKS.length >= 4);
  },
};
