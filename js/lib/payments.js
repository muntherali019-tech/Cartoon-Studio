// Payments & form delivery configuration.
//
// Everything here works from a static site with NO server and NO secret keys:
//   - Formspree accepts a browser POST to a public form endpoint.
//   - Stripe Payment Links are hosted checkout URLs (no secret key required).
//
// Leave the values blank to keep the built-in demo behaviour. Fill them in to
// go live — no code changes needed.
//
// Flows that need arbitrary/dynamic amounts (the license quote, the print
// order total, and a multi-item store cart) require a server-side Stripe
// Checkout Session and are intentionally left as demo confirmations here.

export const PAYMENTS = {
  // Formspree form id — the part after /f/ in your endpoint.
  // e.g. "mabcwxyz"  ->  https://formspree.io/f/mabcwxyz
  formspreeId: "",

  // Stripe Payment Links keyed by a stable id. Create them in the Stripe
  // dashboard and paste the buy.stripe.com URLs here. Keys:
  //   plan_<planId>_<cycle>   e.g. plan_pro_monthly, plan_pro_annual
  //   pack_<packId>           e.g. pack_anime
  stripeLinks: {
    // plan_pro_monthly: "https://buy.stripe.com/xxxxxxxx",
  },

  // Base URL of the checkout API (server/index.js) that creates Stripe
  // Checkout Sessions for dynamic amounts (license quote, print order, cart).
  // Leave blank to keep those flows as demo confirmations.
  // e.g. "https://api.cartoonstudio.co.uk"
  checkoutApiBase: "",
};

export function formspreeEndpoint(cfg = PAYMENTS) {
  return cfg.formspreeId ? `https://formspree.io/f/${cfg.formspreeId}` : null;
}

export function planLinkKey(planId, cycle) {
  return `plan_${planId}_${cycle}`;
}

export function packLinkKey(packId) {
  return `pack_${packId}`;
}

export function paymentLink(key, cfg = PAYMENTS) {
  return (cfg.stripeLinks && cfg.stripeLinks[key]) || null;
}

// Deliver a contact enquiry. Returns { ok, delivered } — delivered is false
// when no endpoint is configured (the demo path). Throws on a real HTTP error
// so the UI can show a retry message. fetchImpl is injectable for tests.
export async function submitContact(fields, cfg = PAYMENTS, fetchImpl) {
  const url = formspreeEndpoint(cfg);
  if (!url) return { ok: true, delivered: false };

  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
  if (!doFetch) throw new Error("no fetch available");

  const res = await doFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(`formspree ${res.status}`);
  return { ok: true, delivered: true };
}

// Start a Checkout Session for a dynamic-amount purchase. Returns a Stripe
// checkout URL when the API is configured, or null (demo fallback) when it is
// not. `payload` is the user's selection, e.g. { kind: "print", product, size,
// qty } — never a price; the server computes that. fetchImpl is injectable.
export async function startCheckout(payload, cfg = PAYMENTS, fetchImpl) {
  if (!cfg.checkoutApiBase) return null;

  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
  if (!doFetch) throw new Error("no fetch available");

  const res = await doFetch(`${cfg.checkoutApiBase}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`checkout ${res.status}`);
  const { url } = await res.json();
  return url;
}
