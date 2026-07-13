import test from "node:test";
import assert from "node:assert/strict";
import {
  categorize, demoIllustration, demoComic, demoCharacter, demoStickers, demoToonify, demoCaptions,
} from "../server/demo.js";

// The demo engine is what makes a keyless deploy feel like a real product — its
// output must be well-formed, topic-aware, and free of "lorem"/"demo mode".

const NOT_PLACEHOLDER = (s) => {
  const t = String(s).toLowerCase();
  assert.ok(!t.includes("lorem"), `should not contain lorem: ${s}`);
  assert.ok(!t.includes("demo mode"), `should not contain "demo mode": ${s}`);
};

test("categorize maps ideas to sensible cartoon buckets", () => {
  assert.equal(categorize("a grumpy cat in a hat"), "animals");
  assert.equal(categorize("monday morning at the office"), "office");
  assert.equal(categorize("epic boss fight in a game"), "gaming");
  assert.equal(categorize("something totally unmatched"), "everyday"); // graceful default
});

test("demoIllustration returns a directable prompt, caption and palette", () => {
  const d = demoIllustration("a grumpy cat in a wizard hat", "");
  assert.ok(d.imagePrompt && d.caption && d.style);
  assert.ok(d.palette && d.palette.primary && d.palette.outline);
  NOT_PLACEHOLDER(d.imagePrompt + d.caption);
  assert.ok(d.imagePrompt.toLowerCase().includes("cat"));
});

test("demoComic returns the requested panels with dialogue and an arc", () => {
  const c = demoComic("my cat negotiating breakfast", 4);
  assert.equal(c.panels.length, 4);
  assert.ok(c.title && c.style && Array.isArray(c.hashtags) && c.hashtags.length >= 3);
  c.panels.forEach((p, i) => {
    assert.equal(p.panel, i + 1);
    assert.ok(p.caption && p.action && p.imagePrompt);
    assert.ok(Array.isArray(p.dialogue));
    NOT_PLACEHOLDER(p.action + p.caption);
  });
});

test("demoComic respects a range of panel counts", () => {
  assert.equal(demoComic("x", 2).panels.length, 2);
  assert.equal(demoComic("x", 6).panels.length, 6);
});

test("demoCharacter returns a named, reusable character sheet", () => {
  const ch = demoCharacter("a brave little dumpling knight");
  assert.ok(ch.name && ch.personality && ch.look && ch.style);
  assert.ok(ch.palette && ch.palette.primary);
  assert.ok(ch.imagePrompt.length > 0);
  NOT_PLACEHOLDER(ch.look + ch.personality);
});

test("demoStickers returns a cohesive labelled set", () => {
  const s = demoStickers("Biscuit the smug cat", 6);
  assert.equal(s.stickers.length, 6);
  for (const st of s.stickers) {
    assert.ok(st.label && st.pose && st.imagePrompt);
  }
});

test("demoToonify returns a faithful conversion prompt", () => {
  const t = demoToonify("");
  assert.ok(t.imagePrompt.toLowerCase().includes("photo"));
  assert.ok(t.caption && t.palette && t.style);
});

test("demoCaptions returns the requested count, numbered", () => {
  const text = demoCaptions("gym life", 5);
  const lines = text.split("\n").filter((l) => /^\d+\./.test(l.trim()));
  assert.equal(lines.length, 5);
  NOT_PLACEHOLDER(text);
});
