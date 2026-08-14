# CLAUDE.md

This file guides Claude Code (claude.ai/code) and other AI assistants working in
this repository. Keep it up to date as the codebase evolves.

## Project Overview

**Cartoon Studio** is a self-contained AI studio that turns a prompt — or a
photo — into cartoons, comic strips, characters and sticker packs, then exports
them. It is a single Node service (an **Express API + a static web app** with
**zero build step**), so it deploys to Render in minutes.

Everything is designed to work **without any API keys**: with no
`ANTHROPIC_API_KEY` the server runs in **demo mode** (believable, topic-aware
sample content), and with no image key the browser renders cartoons with the
built-in **Toon Render** canvas engine. Add keys later to switch on live AI and
photoreal rendering.

## ⚠ Read this before you edit: the repo holds two generations

Only one of the two web apps in this repo is live. Editing the wrong one changes
nothing a user sees.

| | **Live** | **Vestigial** |
|---|---|---|
| Web app | `public/` (`index.html`, `app.js`, `styles.css`) | root `index.html` + `js/` + `css/`, and `src/CartoonStudio.jsx` + `src/main.jsx` |
| Server | `server/index.js` and everything it imports | `server/checkout.js`, `server/webhook.js`, `server/prompt.js`, `netlify/functions/generate.js` |
| Entry point | `npm start` → `node server/index.js`, which serves **`public/` only** | — |
| Build config | none (zero build step) | `vite.config.js`, `netlify.toml`, `Dockerfile`, `docker-compose.yml` |

How to tell: `server/index.js` sets `PUBLIC_DIR` to `../public`, so nothing at the
repo root is ever served. And the vestigial build configs cannot run as written —
`package.json` has **no `build` script** and no vite/react dependencies, so
`npm run build` (which `netlify.toml` and the `Dockerfile` both invoke) fails, and
`docker-compose.yml` wires up a Redis the server never reads.

The vestigial modules are not entirely dead weight: `server/checkout.js`,
`server/webhook.js` and the pure helpers under `js/lib/` are exercised by the
legacy test runner (see [Testing](#testing)). Leave them alone unless you're
deliberately reviving or deleting that generation — and if you delete, delete the
whole layer (app, config and its tests) in one change.

**Everything below describes the live app** unless it says otherwise.

## Setup, Build & Run

No build step — it's plain ESM Node + static files.

```bash
npm install
cp .env.example .env      # optional: add ANTHROPIC_API_KEY / image / Stripe keys
npm start                 # http://localhost:3000  (or: npm run dev to auto-reload)
npm test                  # node --test
npm run test:coverage     # node --test --experimental-test-coverage
```

- **Node ≥ 20** (`engines`); CI runs Node 22.
- **Default branch:** `main`.
- `scripts/go-live.sh` is a one-off helper that stores deploy secrets in the GitHub
  repo via the `gh` CLI. It is not referenced by `package.json`.

## Architecture

```
server/                 Express API (ESM, no framework beyond express + pg)
  index.js              Routes, credit costs, PLANS, SPA fallback, boot
  env.js                Loads a local .env before anything reads process.env (no-op when absent)
  ai.js                 Anthropic client; generateText/generateJSON/visionExtract; demo passthrough
  prompts.js            Master system prompts (one voice for the whole product)
  demo.js               Believable, topic-aware sample content for demo mode (no key)
  images.js             Real image models (OpenAI gpt-image-1 / custom) → falls back to Toon Render
  auth.js               Accounts, scrypt hashing, HMAC tokens, monthly credits, Character Kit,
                        gallery, referrals
  billing.js            Stripe Checkout (subscriptions + one-time credit packs) + webhook
  store.js              Persistence: Postgres (DATABASE_URL) or JSON file, same async API
public/                 Static web app (no bundler) — the app that actually ships
  index.html            Landing + Studio (tabs), pricing, packs, referral, auth modal
  app.js                Front-end + the Toon Render canvas engine
  styles.css            Premium UI, animations (reduced-motion aware)
test/                   node:test suites (in-process server HTTP + demo/auth/ai/billing units)
tests/                  Legacy suite for the vestigial generation (see Testing)
.github/workflows/ci.yml  install → audit → syntax-check → tests → coverage → smoke test
render.yaml             One-service Render blueprint (the real deploy path)
```

### Request flow
Browser (`public/app.js`) → `POST /api/*` → `server/index.js` route →
`ai.js` (live Anthropic **or** `demo.js` fallback) → JSON back to the client →
rendered to `<canvas>` by the **Toon Render** engine (or a real image if an
image model is wired). The Anthropic API key never reaches the browser.

### How the AI is wired ("best models in")
- Text/reasoning runs through the **Anthropic API**, model `claude-opus-4-8` by
  default (`AI_MODEL`), with an optional separate `AI_VISION_MODEL` for Toonify.
- Prompts live in **`server/prompts.js`** as tuned "master prompts": each gives
  the model an explicit expert role, hard constraints, a JSON output contract, a
  shared house-style bar, and JSON prefill (`{`) for reliable structured output.
- Creative routes run warm (`AI_TEMPERATURE`, 0.85); structured routes run
  precise (`AI_JSON_TEMPERATURE`, 0.4).
- Images: set `IMAGE_PROVIDER=openai` + `OPENAI_API_KEY` (gpt-image-1) or
  `IMAGE_API_URL` for any `{prompt,width,height}→{url|b64}` endpoint. With none,
  `imageProvider` is `toonrender` and the browser draws the cartoon itself.

## Key conventions

- **ESM only** (`"type": "module"`); Node ≥ 20; 2-space indent; double quotes.
- **Never throw a raw 500 at a user.** Wrap async routes with `wrap()`, refund
  credits when a paid action fails after charging (`refundCredit`), and return
  typed JSON errors (`out_of_credits`, `premium_required`, `generation_failed`).
- **Demo mode must stay believable.** Every AI route passes a `demo` fallback
  (a function from `server/demo.js`) to `generateJSON`/`generateText`. Demo
  content must never contain "lorem" or "demo mode" in user-facing text — the
  demo tests assert this. If you add a route, add its demo generator too.
- **Credits & gating.** Paid actions call `spendCredit(user, cost)` (monthly
  allowance first, then purchased/bonus credits) and premium tools check
  `isPremium(user)`. Costs are centralized in `COST` in `server/index.js`.
- **The Stripe webhook is mounted before the JSON body parser** — signature
  verification needs the raw body. Keep it first in `index.js`.
- **Secrets stay server-side.** No API keys in `public/`. The client only ever
  sees `publicUser(...)` (never password hashes or Stripe internals).
- **Persistence is backend-agnostic.** Use the `store.js` async API; it works
  the same on Postgres or the JSON file. User records are JSONB blobs so the
  shape can evolve freely.
- Keep commits small and focused. Update this file when structure/tooling changes.

## The tools (and their routes)

| Tool | Route | Cost | Notes |
|---|---|---|---|
| Cartoon | `POST /api/cartoon` | 1 credit | Prompt → illustration (real image or Toon Render) |
| Comic Strip Studio | `POST /api/comic` | 1/panel · **Creator+** | Multi-panel strip with dialogue |
| Character designer | `POST /api/character` | 1 credit | Reusable character sheet |
| Sticker Pack Studio | `POST /api/stickers` | 1/sticker · **Creator+** | Matching expression set |
| Toonify | `POST /api/toonify` | 1 credit | Photo → cartoon (vision) |
| Colouring Page | `POST /api/coloring` | 1 credit | Printable black-and-white line-art page (`design.line`) |
| Character Kit | `GET/POST /api/characterkit` | — · **Creator+** | Save colours/style/traits applied to all renders |
| Gallery ("My Creations") | `GET/POST/DELETE /api/gallery` | — | Per-account saved creations (capped, newest-first); stores the small render spec, not image blobs |
| Captions | `POST /api/captions` | free | Meme/caption lines |
| Meta | `GET /api/health` · `/api/config` | — | Health + plans/packs/provider/user bootstrap |
| Accounts | `POST /api/auth/signup` · `/api/auth/login` · `GET /api/me` | — | scrypt + HMAC tokens |
| Billing | `POST /api/billing/checkout` · `/credits` · `/webhook` | — | Subscriptions + one-time credit packs |

## Revenue model

Four monetization surfaces, all wired end-to-end: **subscriptions**
(Free/Creator/Studio — the `PLANS` array in `server/index.js`), **one-time credit
packs** (stack on the monthly allowance, never expire), **premium-gated tools**
(Comic Studio, Sticker Studio, Character Kit), and a **give-15-get-15 referral
loop**.

## Testing

`npm test` runs `node --test`, which discovers **both** test directories.

**`test/` — the live suite (63 tests).** Runs the real app **in-process** against
an isolated temp store (`DATA_DIR`) and drives every route over HTTP on an
ephemeral port, plus unit tests for the token signer, credit accounting, the demo
engine, the loose-JSON parser, and the Stripe webhook. Everything runs in demo
mode, so **no keys or network are required**. Add tests here alongside any new
route or logic.

**`tests/` — the legacy suite.** `tests/unit.test.mjs` and `tests/e2e.test.mjs`
belong to the vestigial generation and cover `js/lib/*` (rng, prompts, renderer,
validation, pricing, payments) plus `server/checkout.js` and `server/webhook.js`.
They **export** their cases rather than registering them with `node:test`, so
`npm test` imports them and reports two trivially-passing files — it does not
execute their assertions. The real driver is `node tests/run.mjs`, which runs the
unit cases and then serves the root site and runs the Playwright e2e cases against
it (Playwright is not a declared dependency, so the e2e half is skipped unless one
is installed). There is no npm script for it and CI does not run it.

`npm run test:coverage` adds Node's built-in coverage report. **Keep the server
in-process** — `--experimental-test-coverage` instruments only the current
process, so spawning the server as a child hides `index.js`, `billing.js` and
`ai.js` from the report entirely (they read 0% however well they are tested).
`server/index.js` exports `{ app, initStore }` and only calls `app.listen` when
run directly, which is what makes this possible.

Two things are worth knowing when touching billing:

- `verifySignature` takes injectable `now` / `secret` / `toleranceSeconds`, so
  signature and replay behaviour can be tested without env juggling or waiting
  on the clock. Signatures older than `STRIPE_WEBHOOK_TOLERANCE` (default 300s)
  are rejected.
- Webhook side effects are **idempotent per user**: applied event ids are
  recorded on `user.processedEvents` (capped at 50) and re-delivered events are
  skipped, so a retried or replayed credit-pack purchase cannot stack credits.

## CI

`.github/workflows/ci.yml` ("Cartoon Studio CI") on push to `main` and on PRs,
Node 22: `npm install` → `npm audit --audit-level=high` (**report-only — it ends
in `|| true`, so vulnerabilities do not fail the build**) → `node --check` on
`server/*.js` and `public/app.js` → `npm test` → coverage report → demo-mode smoke
test (`/api/health`, then `POST /api/cartoon`).

## Deploy

Push and connect the repo to Render (the blueprint is `render.yaml`: build
`npm install`, start `node server/index.js`, health check `/api/health`), or run
`node server/index.js` anywhere. Add `ANTHROPIC_API_KEY` for live AI,
`OPENAI_API_KEY` + `IMAGE_PROVIDER=openai` for photoreal cartoons, `STRIPE_*`
for billing, and `DATABASE_URL` for durable Postgres. Everything degrades
gracefully when unset. `.env.example` documents every variable.

The `netlify.toml` and Docker files target the vestigial generation and do not
work as written — see the warning at the top.

## Git workflow

- Default branch is `main`. Do work on a feature branch and push with
  `git push -u origin <branch>`; retry network failures with exponential backoff.
- **Do not open a pull request unless explicitly asked.**
- If a designated branch's PR has already merged, restart the branch from the
  latest `main` for follow-up work rather than stacking onto merged history.
