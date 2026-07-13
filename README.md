# Cartoon Studio

An AI cartoon-studio marketing site with a **working live demo**, six tuned
art styles, four revenue tools, and a real test suite — built as plain
HTML/CSS/ES-modules with no build step.

## Highlights

- **Live studio** — pick a style, describe a subject, and get a real,
  downloadable SVG cartoon rendered in the browser.
- **Real model wiring** — `js/lib/backends.js` ships working request adapters
  for OpenAI Images, Stability, and Replicate. With no API key configured (the
  case for this public demo) it transparently falls back to the local **Studio
  Demo Engine** so the demo always works offline.
- **Master-prompt optimization** — each style carries a hand-tuned positive +
  negative prompt (`js/lib/prompts.js`).
- **Revenue tools** — subscription plans (monthly/annual), an instant
  commercial-license quote calculator, a print shop, and a style-pack store.
- **Premium UI** — gradient system, glassmorphic header, scroll reveals,
  render shimmer, light/dark aware, fully responsive.

## Structure

```
index.html            # Page markup + section mount points
css/styles.css        # Design system + components (light/dark)
js/app.js             # UI bootstrap — wires every interactive surface
js/data.js            # Curated sample content (gallery, testimonials, stats)
js/lib/
  rng.js              # Seeded PRNG + string hash (deterministic renders)
  prompts.js          # Styles + master-prompt optimizer
  renderer.js         # Procedural SVG cartoon engine
  backends.js         # Hosted-model adapters + demo fallback
  pricing.js          # Plans, license quote, print + pack pricing (pure)
  validate.js         # Form validators (pure)
tests/
  unit.test.mjs       # Pure-logic unit tests
  e2e.test.mjs        # Playwright browser tests
  run.mjs             # Runner: unit tests + static server + e2e
```

## Run locally

```sh
npm start          # python3 -m http.server 8000  -> http://localhost:8000
```

No dependencies to install for the site itself.

## Test

```sh
npm test           # runs unit tests, then Playwright e2e against a temp server
```

The runner resolves Playwright from a local or global install and skips the
e2e phase gracefully if a browser isn't available; unit tests always run.

## Going live

All of the integrations below work from this static site — no server required
for the first two. Everything falls back to a friendly demo message until you
fill the config in, so nothing breaks before you're ready.

### Contact form (Formspree)

1. Create a form at [formspree.io](https://formspree.io) and copy its id (the
   part after `/f/`).
2. Set it in `js/lib/payments.js`:
   ```js
   export const PAYMENTS = { formspreeId: "yourFormId", /* … */ };
   ```
   Submissions now POST straight to Formspree from the browser.

### Plan checkout (Stripe Payment Links)

1. In the Stripe dashboard, create a **Payment Link** for each plan/cycle.
2. Paste the `buy.stripe.com` URLs into `stripeLinks`, keyed by
   `plan_<planId>_<cycle>`:
   ```js
   stripeLinks: {
     plan_pro_monthly: "https://buy.stripe.com/…",
     plan_pro_annual:  "https://buy.stripe.com/…",
   }
   ```
   Plan buttons then redirect to Stripe-hosted checkout.

### Dynamic checkout (license quote / print / cart)

These totals are computed from user input, so they use a **server-side Stripe
Checkout Session** (a static Payment Link can't do variable amounts). A small,
dependency-free Node server is included at `server/`:

```sh
STRIPE_SECRET_KEY=sk_live_… PUBLIC_BASE_URL=https://cartoonstudio.co.uk \
  npm run serve:api           # POST /api/checkout -> { url }
```

Then point the site at it in `js/lib/payments.js`:

```js
export const PAYMENTS = { checkoutApiBase: "https://api.cartoonstudio.co.uk", /* … */ };
```

The quote, print, and cart buttons then POST the user's **selection** (never a
price) to the API, which **recomputes the amount server-side** from
`js/lib/pricing.js` and returns a Stripe checkout URL to redirect to. Until
`checkoutApiBase` is set, these flows stay as demo confirmations. The endpoint
returns `503` if `STRIPE_SECRET_KEY` is unset, so nothing charges by accident.

### Real render model

Set credentials in `js/lib/backends.js` (`RENDER_CONFIG`) — ideally via a
server-side proxy so keys never ship to the client — to route renders through a
hosted image model (OpenAI / Stability / Replicate) instead of the demo engine.

## Roadmap

- Verify Stripe webhooks server-side to fulfil orders after payment.
- Persist the style-pack cart across sessions.
