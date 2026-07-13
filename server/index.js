// Minimal, dependency-free checkout API server.
//
//   POST /api/checkout   { kind: "quote"|"print"|"cart", ...selection }
//     -> 200 { url }     Stripe-hosted checkout URL to redirect the buyer to
//
// Prices are recomputed server-side from js/lib/pricing.js — the client never
// sends an amount. Configure via environment variables:
//
//   STRIPE_SECRET_KEY   your Stripe secret key (required to go live)
//   PUBLIC_BASE_URL     where the site is served (for success/cancel URLs)
//   PORT                listen port (default 8787)
//   ALLOW_ORIGIN        CORS origin (default "*")
//
// Run: STRIPE_SECRET_KEY=sk_… node server/index.js

import http from "node:http";
import { createCheckoutSession } from "./checkout.js";

const PORT = Number(process.env.PORT) || 8787;
const BASE = process.env.PUBLIC_BASE_URL || `http://localhost:8000`;
const ORIGIN = process.env.ALLOW_ORIGIN || "*";

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 1e6) reject(new Error("payload too large"));
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

export const handler = async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "POST" || !req.url.startsWith("/api/checkout")) {
    return send(res, 404, { error: "not found" });
  }

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) return send(res, 503, { error: "checkout not configured" });

  let payload;
  try {
    payload = await readJson(req);
  } catch (err) {
    return send(res, 400, { error: err.message });
  }

  try {
    const { url } = await createCheckoutSession(payload, {
      apiKey,
      successUrl: `${BASE}/?checkout=success`,
      cancelUrl: `${BASE}/?checkout=cancelled`,
    });
    return send(res, 200, { url });
  } catch (err) {
    // Client mistakes (unknown product, empty cart) -> 400; anything else 502.
    const clientErr = /unknown|empty|invalid/i.test(err.message);
    return send(res, clientErr ? 400 : 502, { error: err.message });
  }
};

// Only start listening when run directly, so tests can import the handler.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  http.createServer(handler).listen(PORT, () => {
    console.log(`Checkout API listening on http://localhost:${PORT}`);
    if (!process.env.STRIPE_SECRET_KEY) {
      console.log("⚠  STRIPE_SECRET_KEY not set — /api/checkout will return 503.");
    }
  });
}
