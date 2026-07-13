# 🎨 Cartoon Studio

**Turn any idea — or any photo — into cartoons, comics, characters and sticker packs.**

Cartoon Studio is a self-contained AI studio. Type an idea and it draws the
cartoon, writes and letters the **comic strip**, designs a reusable **character**,
and mints a matching **sticker pack** — ready to post, print or sell. Drop a
selfie and it redraws you as a cartoon that still looks like you.

It's a single Node service (Express API + static web app) with **zero build
step**, so it deploys to Render in minutes.

---

## Features

| | |
|---|---|
| 🎨 **Prompt → cartoon** | Describe anything → a finished, framed cartoon with a caption. Exports a crisp PNG. |
| 📖 **Comic Strip Studio** *(Creator+)* | One idea → a multi-panel strip with a real setup/build/punchline, lettered with speech bubbles. |
| 🦸 **Character designer** | A sentence → a memorable character with a full look sheet you can reuse. |
| 🧩 **Sticker Pack Studio** *(Creator+)* | Any character → a cohesive set of expression stickers. |
| 📷 **Photo → cartoon (Toonify)** | Drop a photo — vision AI reads it and redraws it as an on-model cartoon. |
| 🎭 **Character Kit** *(Creator+)* | Lock your colours, style and character once; every render stays on-model. |
| 💬 **Caption & meme writer** | Scroll-stopping captions and meme lines on tap. |
| 👤 **Accounts + credits** | Email/password sign-in with server-enforced monthly credits (Free 8 · Creator 150 · Studio unlimited). |
| 💸 **Live Stripe billing** | Real Checkout + webhook for subscriptions **and** one-time credit packs. |
| 🎁 **Referrals** | Give-15-get-15: both sides get bonus credits when a friend joins. |

## Render quality (best models wired in)

- Text, comics and character design run through the **Anthropic API**
  (`claude-opus-4-8` by default) with tuned, centralized **master prompts**
  (`server/prompts.js`): explicit expert roles, hard constraints, a JSON output
  contract, a shared house-style bar, and JSON prefill for reliable output.
- **Photoreal cartoon rendering**: set `IMAGE_PROVIDER=openai` + `OPENAI_API_KEY`
  (gpt-image-1) or point `IMAGE_API_URL` at any image endpoint. With no image key,
  the built-in **Toon Render** canvas engine draws an appealing cartoon poster
  (character, halftone, starburst, ribbon caption) entirely in the browser — so
  there's no heavy server cost and it runs on Render's free tier.

## Believable demo (no lorem)

With **no `ANTHROPIC_API_KEY`**, Cartoon Studio runs in **demo mode** — but
instead of placeholder text it serves genuine, topic-aware sample content
(`server/demo.js`): real cartoon briefs, multi-panel comic scripts with
dialogue, character sheets, sticker sets and meme captions. Deploy first, add the
key later; every screen is clickable end-to-end.

## Revenue

Four monetization surfaces, all wired end-to-end:

1. **Subscriptions** — Free / Creator ($12) / Studio ($39) via Stripe Checkout + webhook.
2. **Credit packs** — one-time top-ups (60 / 250 / 600) that stack on the monthly allowance and never expire.
3. **Premium tools** — Comic Studio, Sticker Studio and Character Kit are gated to paid plans.
4. **Referral loop** — give-15-get-15 credits turns every user into a growth channel.

## Run locally

```bash
npm install
cp .env.example .env        # optional: add your ANTHROPIC_API_KEY
npm start                   # http://localhost:3000
```

## Testing

```bash
npm test                    # node:test — the whole suite, no key needed
```

The suite boots the real server against an isolated store and exercises every
route (auth, credits, premium gating, billing gating, referrals), plus unit tests
for the token signer, credit accounting and the demo engine. It also runs in CI
on every push and PR.

## Deploy to Render

This repo ships `render.yaml`. Connect the repo as a Blueprint, then add your
keys in the dashboard: `ANTHROPIC_API_KEY` (live AI), `OPENAI_API_KEY` +
`IMAGE_PROVIDER=openai` (photoreal), `STRIPE_*` (billing), `DATABASE_URL`
(durable Postgres). Everything degrades gracefully when unset.

See **CLAUDE.md** for architecture and contributor conventions.
