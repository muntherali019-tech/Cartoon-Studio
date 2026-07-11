// Revenue logic — subscription plans, commercial-license quoting, print
// pricing, and style-pack catalogue. All pure functions so the money math is
// unit-tested and never drifts between UI and tests.

export const PLANS = [
  {
    id: "starter",
    name: "Starter",
    monthly: 9,
    blurb: "For hobbyists and one-off gifts.",
    features: ["25 cartoons / month", "6 art styles", "Personal-use license", "PNG + SVG download"],
    cta: "Start free trial",
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 29,
    blurb: "For creators and small brands.",
    features: [
      "300 cartoons / month",
      "All styles + monthly style packs",
      "Commercial-use license",
      "4K upscales",
      "Priority render queue",
    ],
    cta: "Go Pro",
    featured: true,
  },
  {
    id: "studio",
    name: "Studio",
    monthly: 99,
    blurb: "For agencies and teams.",
    features: [
      "Unlimited cartoons",
      "Team seats (5 included)",
      "Extended commercial license",
      "Brand style training",
      "API access",
      "Dedicated support",
    ],
    cta: "Book a demo",
  },
];

// Annual billing gives ~2 months free.
export const ANNUAL_DISCOUNT = 0.8333; // pay for 10 of 12 months

export function planPrice(plan, cycle = "monthly") {
  if (cycle === "annual") {
    return Math.round(plan.monthly * 12 * ANNUAL_DISCOUNT);
  }
  return plan.monthly;
}

// ---- Commercial-license instant quote ----
// Price scales with usage scope, reach, exclusivity and rush.
const LICENSE_BASE = 120;
const SCOPE = { social: 1, web: 1.4, print: 1.8, broadcast: 2.6, packaging: 3.2 };
const REACH = { local: 1, national: 1.6, global: 2.4 };

export function quoteCommercial({
  scope = "social",
  reach = "local",
  assets = 1,
  exclusive = false,
  rush = false,
} = {}) {
  const n = Math.max(1, Math.floor(assets));
  const scopeMult = SCOPE[scope] ?? 1;
  const reachMult = REACH[reach] ?? 1;

  // Volume discount: each extra asset is cheaper.
  const assetFactor = 1 + (n - 1) * 0.7;

  let price = LICENSE_BASE * scopeMult * reachMult * assetFactor;
  if (exclusive) price *= 1.75;
  if (rush) price *= 1.3;

  const total = Math.round(price);
  return {
    total,
    perAsset: Math.round(total / n),
    breakdown: { scopeMult, reachMult, assetFactor, exclusive, rush },
  };
}

// ---- Print shop pricing ----
export const PRINT_PRODUCTS = {
  sticker: { name: "Sticker pack", base: 6, area: 0 },
  print: { name: "Art print", base: 18, area: 1 },
  canvas: { name: "Framed canvas", base: 45, area: 1.4 },
  mug: { name: "Mug", base: 14, area: 0 },
  tee: { name: "T-shirt", base: 24, area: 0.2 },
};
export const PRINT_SIZES = { s: 1, m: 1.5, l: 2.2 };

export function printPrice({ product = "print", size = "m", qty = 1 } = {}) {
  const p = PRINT_PRODUCTS[product] || PRINT_PRODUCTS.print;
  const sizeMult = PRINT_SIZES[size] ?? 1;
  const n = Math.max(1, Math.floor(qty));
  const unit = p.base + p.base * p.area * (sizeMult - 1);
  // Bulk discount over 5 / 10 units.
  const bulk = n >= 10 ? 0.85 : n >= 5 ? 0.92 : 1;
  const total = Math.round(unit * n * bulk * 100) / 100;
  return { unit: Math.round(unit * 100) / 100, total, bulkApplied: bulk < 1 };
}

// ---- Style-pack store ----
export const STYLE_PACKS = [
  { id: "anime", name: "Anime Deluxe", price: 12, count: 8, blurb: "Shonen, shojo, mecha & more." },
  { id: "storybook", name: "Storybook Classics", price: 10, count: 6, blurb: "Warm, painterly children's-book looks." },
  { id: "8bit", name: "Pixel & 8-bit", price: 8, count: 5, blurb: "Retro game sprites and pixel portraits." },
  { id: "holiday", name: "Seasonal & Holiday", price: 9, count: 7, blurb: "Festive styles all year round." },
];

export function cartTotal(items) {
  return Math.round(items.reduce((sum, it) => sum + (it.price || 0) * (it.qty || 1), 0) * 100) / 100;
}
