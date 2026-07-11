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

## Going to production

Set credentials in `js/lib/backends.js` (`RENDER_CONFIG`) — ideally via a
server-side proxy so keys never ship to the client — to route renders through a
hosted image model instead of the demo engine.

## Roadmap

- Wire the contact form and checkout CTAs to real backend endpoints.
- Persist the style-pack cart and connect a payment provider.
