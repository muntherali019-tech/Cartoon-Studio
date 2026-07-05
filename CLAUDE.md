# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Cartoon Studio** turns a single idea into a complete cartoon production pack:
a script, a scene-by-scene storyboard, and ready-to-paste AI image-generation
prompts. It also includes a bonus "photo → cartoon" tool that writes a prompt to
redraw an uploaded photo in a chosen cartoon style. Image rendering itself is left
to the user's own image tool — the app produces everything up to the render step.

## Current State

A React + Vite app.

- `src/CartoonStudio.jsx` — the entire UI and logic (default-exported `CartoonStudio` component).
- `src/main.jsx` — React entry point that mounts `CartoonStudio` into `#root`.
- `index.html` — Vite HTML entry.
- `vite.config.js` — Vite config with `@vitejs/plugin-react`.
- `README.md` — project title.
- The default branch is `main`.

## Setup, Build & Run

```bash
npm install     # install dependencies
npm run dev     # start the dev server (http://localhost:5173)
npm run build   # production build into dist/
npm run preview # preview the production build
```

There is no test suite or linter configured yet.

## Architecture (`src/CartoonStudio.jsx`)

The component is a 4-stage, single-file pipeline with all styling done inline
(no Tailwind/CSS files) using a fixed cartoon palette (`INK`, `PAPER`, `PINK`,
`CYAN`, `SUN`, `MINT`).

- **Claude API access** — `callClaude(messages, system)` POSTs directly to
  `https://api.anthropic.com/v1/messages`. `extractJSON(text)` strips markdown
  fences and parses the first JSON object/array from a model reply.
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

- Runtime: `react`, `react-dom`, `lucide-react`.
- Build: `vite`, `@vitejs/plugin-react`.

## Conventions

- Keep commits small and focused, with clear, descriptive messages.
- Update this `CLAUDE.md` whenever the project structure, tooling, or workflows change.
- When wiring in a real render backend (fal.ai, Replicate, an SDXL endpoint),
  feed it the generated `imagePrompt` strings from the storyboard panels.
