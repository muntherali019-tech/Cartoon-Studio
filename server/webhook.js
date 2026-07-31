// Stripe webhook verification + fulfilment dispatch — dependency-free.
//
// After a buyer pays, Stripe POSTs an event to our webhook. We must verify the
// signature over the RAW request body (not re-serialized JSON) using the
// endpoint's signing secret, reject stale/forged events, and only then act.
//
// Uses Node's built-in crypto so there is no Stripe SDK dependency.

import crypto from "node:crypto";

const DEFAULT_TOLERANCE = 300; // seconds — reject events older than 5 minutes

// Parse the "Stripe-Signature" header: "t=timestamp,v1=sig,v1=sig2".
export function parseSignatureHeader(header) {
  const out = { t: null, v1: [] };
  if (typeof header !== "string") return out;
  for (const part of header.split(",")) {
    const [key, value] = part.split("=");
    if (key === "t") out.t = Number(value);
    else if (key === "v1") out.v1.push(value);
  }
  return out;
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Compute the expected signature for a raw payload + timestamp.
export function computeSignature(rawBody, timestamp, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
}

// Verify and return the parsed event, or throw. `now` is injectable for tests.
export function verifyStripeSignature(rawBody, signatureHeader, secret, opts = {}) {
  if (!secret) throw new Error("missing webhook secret");
  const tolerance = opts.tolerance ?? DEFAULT_TOLERANCE;
  const now = opts.now ?? Math.floor(Date.now() / 1000);

  const { t, v1 } = parseSignatureHeader(signatureHeader);
  if (!t || !v1.length) throw new Error("bad signature header");
  if (Math.abs(now - t) > tolerance) throw new Error("timestamp outside tolerance");

  const expected = computeSignature(rawBody, t, secret);
  const matched = v1.some((sig) => timingSafeEqualHex(sig, expected));
  if (!matched) throw new Error("signature mismatch");

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error("invalid event JSON");
  }
}

// Dispatch a verified event. Only paid checkouts trigger fulfilment. The
// `fulfil` callback is where you grant the license / queue the print / etc.
// Returns a small result object describing what happened.
export async function handleEvent(event, { fulfil } = {}) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data?.object || {};
      // Guard against unpaid sessions (e.g. async payment still pending).
      if (session.payment_status && session.payment_status !== "paid") {
        return { handled: true, fulfilled: false, reason: "not paid" };
      }
      if (typeof fulfil === "function") await fulfil(session);
      return { handled: true, fulfilled: true, sessionId: session.id };
    }
    default:
      // Acknowledge everything else so Stripe stops retrying.
      return { handled: false, type: event.type };
  }
}
