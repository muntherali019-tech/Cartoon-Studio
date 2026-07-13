// Stripe Checkout Session builder — pure logic, dependency-free.
//
// The browser sends only the *selection* (what the user picked), never a
// price. The server recomputes every amount from the shared pricing library
// so a tampered client can't set its own total. Amounts are converted to the
// minor currency unit (pence) that Stripe expects.

import { quoteCommercial, printPrice, STYLE_PACKS, PRINT_PRODUCTS } from "../js/lib/pricing.js";

const CURRENCY = "gbp";
const toMinor = (major) => Math.round(major * 100);

// Turn an app payload into Stripe line_items. Throws on an unknown/invalid
// request so the handler can return 400.
export function buildLineItems(payload = {}) {
  switch (payload.kind) {
    case "quote": {
      const q = quoteCommercial({
        scope: payload.scope,
        reach: payload.reach,
        assets: Number(payload.assets) || 1,
        exclusive: !!payload.exclusive,
        rush: !!payload.rush,
      });
      return [{
        name: `Commercial license (${payload.scope || "social"}, ${payload.reach || "local"})`,
        amount: toMinor(q.total),
        quantity: 1,
      }];
    }
    case "print": {
      const product = PRINT_PRODUCTS[payload.product];
      if (!product) throw new Error("unknown product");
      const res = printPrice({
        product: payload.product,
        size: payload.size,
        qty: Number(payload.qty) || 1,
      });
      return [{
        name: `${product.name} (${payload.size || "m"})`,
        amount: toMinor(res.unit),
        quantity: Math.max(1, Math.floor(Number(payload.qty) || 1)),
      }];
    }
    case "cart": {
      const items = Array.isArray(payload.items) ? payload.items : [];
      const lines = items.map((it) => {
        const pack = STYLE_PACKS.find((p) => p.id === it.id);
        if (!pack) throw new Error(`unknown pack: ${it.id}`);
        return {
          name: `${pack.name} style pack`,
          amount: toMinor(pack.price),
          quantity: Math.max(1, Math.floor(Number(it.qty) || 1)),
        };
      });
      if (!lines.length) throw new Error("empty cart");
      return lines;
    }
    default:
      throw new Error("unknown checkout kind");
  }
}

// Encode nested params as application/x-www-form-urlencoded, the format the
// Stripe REST API expects (line_items[0][price_data][unit_amount]=...).
export function stripeForm(obj, prefix = "", out = []) {
  for (const [key, value] of Object.entries(obj)) {
    const k = prefix ? `${prefix}[${key}]` : key;
    if (value != null && typeof value === "object") {
      stripeForm(value, k, out);
    } else {
      out.push(`${encodeURIComponent(k)}=${encodeURIComponent(value)}`);
    }
  }
  return out.join("&");
}

// Build the Stripe params object from line items + redirect URLs.
export function buildSessionParams(lineItems, { successUrl, cancelUrl }) {
  const params = {
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: lineItems.map((li) => ({
      quantity: li.quantity,
      price_data: {
        currency: CURRENCY,
        unit_amount: li.amount,
        product_data: { name: li.name },
      },
    })),
  };
  return params;
}

// Create a Checkout Session via the Stripe REST API. fetchImpl is injectable
// for tests; apiKey is your Stripe secret key (server-side only).
export async function createCheckoutSession(payload, opts) {
  const { apiKey, successUrl, cancelUrl, fetchImpl, apiBase } = opts;
  if (!apiKey) throw new Error("missing Stripe secret key");

  const lineItems = buildLineItems(payload);
  const params = buildSessionParams(lineItems, { successUrl, cancelUrl });
  const doFetch = fetchImpl || fetch;

  const res = await doFetch(`${apiBase || "https://api.stripe.com"}/v1/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: stripeForm(params),
  });
  if (!res.ok) {
    const detail = res.text ? await res.text().catch(() => "") : "";
    throw new Error(`stripe ${res.status} ${detail}`.trim());
  }
  const session = await res.json();
  return { id: session.id, url: session.url };
}
