# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Cartoon-Studio** is the marketing website for Cartoon Studio — a service
offering custom cartoon portraits, brand mascots, and illustration. It is a
static site built with plain HTML, CSS, and JavaScript (no framework or build
step).

As the project grows, keep this file up to date so it accurately reflects the
codebase.

## Structure

- `index.html` — the landing page (hero, services, gallery, contact).
- `css/styles.css` — all styling, including the responsive mobile layout.
- `js/main.js` — progressive-enhancement interactions (mobile nav toggle,
  footer year).

## Build & Run

There is no build system or dependencies. Open `index.html` directly in a
browser, or serve the folder for correct relative paths:

```sh
python3 -m http.server 8000
```

## Current State

- No package manifest, bundler, or automated test suite is configured yet.
- Outstanding work is tracked inline with `TODO` comments (dynamic gallery,
  contact-form validation + submission).
- The default branch is `main`.

## Conventions

- Keep commits small and focused, with clear, descriptive messages.
- Plain HTML/CSS/JS; JavaScript is an enhancement layer — the page must remain
  usable if scripts fail to load.
- Update this `CLAUDE.md` whenever the project structure, tooling, or workflows
  change.
