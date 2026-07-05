# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Cartoon Studio** turns a single idea into a complete cartoon production pack:
a script, a scene-by-scene storyboard, and ready-to-paste AI image-generation
prompts. It also includes a bonus "photo → cartoon" tool that writes a prompt to
redraw an uploaded photo in a chosen cartoon style. Image rendering itself is left
to the user's own image tool — the app produces everything up to the render step.

## Current State

A React + Vite front end with a small Express backend proxy for the Claude API.

- `src/CartoonStudio.jsx` — the entire UI and logic (default-exported `CartoonStudio` component).
- `src/main.jsx` — React entry point that mounts `CartoonStudio` into `#root`.
- `index.html` — Vite HTML entry.
- `vite.config.js` — Vite config with `@vitejs/plugin-react`; proxies `/api` to the backend in dev.
- `server/index.js` — Express proxy that holds the API key and forwards to Claude (uses `@anthropic-ai/sdk`).
- `.env.example` — template for the required `ANTHROPIC_API_KEY` (copy to `.env`, which is gitignored).
- `README.md` — project overview.
- The default branch is `main`.

## Setup, Build & Run

```bash
npm install                     # install dependencies
cp .env.example .env            # then add your ANTHROPIC_API_KEY
npm run dev                     # runs backend (:8787) + Vite dev server (:5173) together
npm run build                   # production build into dist/
npm start                       # serve the built app + API from Express (:8787)
```

Other scripts: `npm run web` (Vite only), `npm run server` (backend only), `npm run preview`.

There is no test suite or linter configured yet.

## Backend proxy (`server/index.js`)

The browser must never hold the Anthropic key, so all model calls go through a
local proxy. To keep the endpoint from being used as a generic Claude proxy, the
**server owns every prompt** — the client sends only an action + validated
parameters, never a `system` prompt or raw `messages`.

- `POST /api/generate` — accepts `{ action, ...params }` where `action` is
  `"script"`, `"panel"`, or `"cartoon"`. `buildRequest()` validates params against
  the preset enums (`FORMATS`/`TONES`/`STYLES`), length caps, and image type/size,
  builds the system+user prompt server-side, then calls `client.messages.create(...)`
  and returns the raw Claude `Message` (front end reads `.content`). Rate-limited
  per-IP (`express-rate-limit`, default 20/min, `RATE_LIMIT_PER_MIN`). The model is
  fixed server-side via `ANTHROPIC_MODEL` (default `claude-opus-4-8`).
- `GET /api/health` — reports `{ ok, hasKey, model }`.
- Unknown `/api/*` routes return JSON `404`; other paths fall through to the SPA.
- In production it also serves the built `dist/` SPA, so `npm start` runs everything.

Config via env (`.env`): `ANTHROPIC_API_KEY` (required), `ANTHROPIC_MODEL`,
`RATE_LIMIT_PER_MIN`, `PORT` (all optional; port default 8787).

## Architecture (`src/CartoonStudio.jsx`)

The component is a 4-stage, single-file pipeline with all styling done inline
(no Tailwind/CSS files) using a fixed cartoon palette (`INK`, `PAPER`, `PINK`,
`CYAN`, `SUN`, `MINT`).

- **Claude API access** — `callAPI(action, params)` POSTs to the local
  `/api/generate` proxy (which owns the prompts and injects the key); it never
  calls Anthropic directly and never sends a prompt. `extractJSON(text)` strips
  markdown fences and parses the first JSON object/array from a model reply.
- **Stage 1 — Idea**: captures the idea plus `format`, `tone`, `style`, and
  `sceneCount` presets (`FORMATS`, `TONES`, `STYLES`).
- **Stage 2 — Script**: `genScript()` asks the model for a titled, character-
  and scene-structured JSON script.
- **Stage 3 — Storyboard**: `runPipeline()` calls `genScript()` then loops
  `genPanel()` per scene to produce a shot, visual, image prompt, and narration.
  `buildPack()` / `downloadPack()` export the whole pack as Markdown.
- **Stage 4 — Photo → cartoon**: `onPhoto()` reads an uploaded image to base64;
  `cartoonify()` sends it to the model to generate a single cartoon image prompt.
- Small presentational helpers (`Stage`, `PromptBox`, `Label`, `Row`, `Empty`)
  live in the same file.

### Notable details

- Character "look" descriptors are threaded from the script into each storyboard
  panel prompt to keep art style consistent across scenes.
- Icons come from `lucide-react`; fonts are imported from Google Fonts via an
  inline `<style>` tag.
- User-facing errors are intentionally friendly ("The studio AI didn't respond…").

## Dependencies

- Front end: `react`, `react-dom`, `lucide-react`.
- Backend: `express`, `express-rate-limit`, `@anthropic-ai/sdk`, `dotenv`.
- Build/dev: `vite`, `@vitejs/plugin-react`, `concurrently`.

## Conventions

- Keep commits small and focused, with clear, descriptive messages.
- Update this `CLAUDE.md` whenever the project structure, tooling, or workflows change.
- When wiring in a real render backend (fal.ai, Replicate, an SDXL endpoint),
  feed it the generated `imagePrompt` strings from the storyboard panels.
