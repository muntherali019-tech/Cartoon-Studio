// Deterministic pseudo-random utilities.
// A given prompt always yields the same cartoon, which makes the live demo
// reproducible and lets us unit-test the render engine.

// FNV-1a style string hash -> unsigned 32-bit int.
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Mulberry32 PRNG — small, fast, good distribution. Returns a function
// producing floats in [0, 1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Convenience wrapper around a seeded PRNG.
export function createRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // float in [min, max)
    range: (min, max) => min + next() * (max - min),
    // integer in [min, max]
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    // pick one element of an array
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    // true with probability p
    chance: (p) => next() < p,
  };
}
