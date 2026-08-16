// Cartoon Studio's single source of truth for everything that's for sale.
//
// Two revenue lines live here:
//   1. PLANS        — recurring subscriptions (Free / Creator / Studio)
//   2. CREDIT_PACKS — one-time credit top-ups (pay-as-you-go, no subscription)
//
// Every paid SKU carries `amount` (in `CURRENCY` minor units) so a Checkout
// session can be built from inline `price_data` — meaning the server can charge
// with nothing configured but `STRIPE_SECRET_KEY`. A dashboard Price ID may
// still be supplied per SKU (`stripePrice`) to override the inline amount; see
// `buildLineItem` in billing.js.
//
// `price`/`period` are display strings for the storefront and must stay in sync
// with `amount` — products.test.js asserts that they do.

export const CURRENCY = "usd";

// ---------------- Subscriptions ----------------
export const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    amount: 0,
    credits: "8 cartoons / mo",
    features: ["Toon Render engine", "Watermark", "Single cartoons", "Meme captions", "Photo → cartoon"],
    cta: "Start free",
  },
  {
    id: "creator",
    name: "Creator",
    price: "$12",
    period: "/mo",
    amount: 1200,
    interval: "month",
    credits: "150 cartoons / mo",
    features: ["No watermark", "Comic Strip Studio", "Character Kit", "Sticker packs", "HD export"],
    cta: "Go Creator",
    popular: true,
    stripePrice: process.env.STRIPE_PRICE_CREATOR || "",
  },
  {
    id: "studio",
    name: "Studio",
    price: "$39",
    period: "/mo",
    amount: 3900,
    interval: "month",
    credits: "Unlimited cartoons",
    features: ["Everything in Creator", "Priority rendering", "Commercial licence", "Merch-ready export", "API access"],
    cta: "Go Studio",
    stripePrice: process.env.STRIPE_PRICE_STUDIO || "",
  },
];

// Monthly credit allowance per plan (Infinity = unlimited). Kept here so auth.js
// and the storefront can never drift apart — auth.js re-exports this.
export const PLAN_CREDITS = {
  free: 8,
  creator: 150,
  studio: Infinity,
};

// Plans a user can actually pay for (Free is not a checkout).
export const PAID_PLANS = PLANS.filter((p) => p.amount > 0);

export function findPlan(id) {
  return PLANS.find((p) => p.id === id) || null;
}

// ---------------- One-time credit packs ----------------
// Buy credits outright — no subscription required. The impulse-purchase path:
// it converts occasional users, and catches paid users who burn through their
// monthly allowance mid-project.
export const CREDIT_PACKS = [
  {
    id: "pack60",
    label: "60 credits",
    credits: 60,
    amount: 900,
    price: "$9",
    blurb: "60 extra cartoon credits",
    stripePrice: process.env.STRIPE_PRICE_PACK60 || "",
  },
  {
    id: "pack250",
    label: "250 credits",
    credits: 250,
    amount: 2900,
    price: "$29",
    best: true,
    blurb: "250 credits · best value",
    stripePrice: process.env.STRIPE_PRICE_PACK250 || "",
  },
  {
    id: "pack600",
    label: "600 credits",
    credits: 600,
    amount: 5900,
    price: "$59",
    blurb: "600 credits for a big project",
    stripePrice: process.env.STRIPE_PRICE_PACK600 || "",
  },
];

export function findPack(id) {
  return CREDIT_PACKS.find((p) => p.id === id) || null;
}

// Flat lookup so a webhook / purchase route can resolve any SKU by id.
export const PRODUCTS_BY_ID = Object.fromEntries(
  [...PAID_PLANS, ...CREDIT_PACKS].map((p) => [p.id, p])
);

export function findProduct(id) {
  return PRODUCTS_BY_ID[id] || null;
}

// What the storefront needs, minus the server-only `stripePrice` field.
const strip = ({ stripePrice, ...rest }) => rest;

export function catalog() {
  return {
    plans: PLANS.map(strip),
    creditPacks: CREDIT_PACKS.map(strip),
  };
}
