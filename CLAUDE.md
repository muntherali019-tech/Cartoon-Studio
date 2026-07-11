# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Cartoon-Studio** is the marketing website for Cartoon Studio — an AI
cartoon-generation service. It is a static site built with plain HTML, CSS,
and JavaScript **ES modules** (no bundler/build step) plus a Node-based test
suite. The site includes a working in-browser render demo and four revenue
tools.

As the project grows, keep this file up to date so it accurately reflects the
codebase.

## Structure

- `index.html` — page markup and section mount points.
- `css/styles.css` — the design system and all components (light/dark aware).
- `js/app.js` — UI bootstrap; wires nav, studio, gallery, tools, and forms.
  Loaded as `<script type="module">`.
- `js/data.js` — curated sample content (gallery, testimonials, stats).
- `js/lib/` — pure, testable modules:
  - `rng.js` — seeded PRNG + hash (renders are deterministic per prompt).
  - `prompts.js` — style presets and the master-prompt optimizer.
  - `renderer.js` — the procedural SVG cartoon engine (Studio Demo Engine).
  - `backends.js` — hosted-model adapters (OpenAI/Stability/Replicate) with a
    fallback to the local engine when no API key is configured.
  - `pricing.js` — plans, license quoting, print + pack pricing.
  - `validate.js` — form validators.
- `tests/` — `unit.test.mjs` (pure logic), `e2e.test.mjs` (Playwright),
  `run.mjs` (runner: unit tests + static server + e2e).

## Build & Run

No build step and no runtime dependencies for the site.

```sh
npm start   # python3 -m http.server 8000
npm test    # unit tests, then Playwright e2e against a temp static server
```

The test runner resolves Playwright from a local or global install and skips
the e2e phase gracefully if no browser is available; unit tests always run.

## Architecture notes

- **Determinism**: `renderer.js` seeds its PRNG from the prompt + style, so a
  given input always yields the same cartoon. This keeps the demo reproducible
  and makes the engine unit-testable.
- **Pure vs. DOM**: everything under `js/lib/` is free of DOM access at module
  scope, so it imports cleanly into Node tests. `app.js` is the only module
  that touches the DOM, and only after `DOMContentLoaded`.
- **Model wiring**: to use a real image model in production, set `RENDER_CONFIG`
  in `backends.js` (prefer a server-side proxy so keys never reach the client).

## Current State

- Working `package.json` with `start` and `test` scripts.
- Remaining `TODO`s: POST the contact form and checkout CTAs to real backends;
  connect a payment provider for the store cart.
- The default branch is `main`.

## Conventions

- Keep commits small and focused, with clear, descriptive messages.
- Keep pure logic in `js/lib/` (no DOM at module scope) and cover it with unit
  tests; wire the DOM only in `app.js`.
- JavaScript is an enhancement layer — keep core content readable if scripts
  fail to load.
- Update this `CLAUDE.md` whenever the project structure, tooling, or workflows
  change.
