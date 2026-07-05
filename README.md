# Cartoon Studio

Turn one idea into a cartoon **script**, a scene-by-scene **storyboard**, and
ready-to-paste **AI image-generation prompts** — plus a bonus **photo → cartoon**
prompt tool. Rendering the images is left to your own image tool; the app produces
everything up to the render step.

## Getting started

```bash
npm install
cp .env.example .env      # then paste your ANTHROPIC_API_KEY
npm run dev               # backend (:8787) + Vite dev server (:5173)
```

Open http://localhost:5173. You'll need an Anthropic API key from
[console.anthropic.com](https://console.anthropic.com/settings/keys).

Other scripts:

```bash
npm run build    # production build into dist/
npm start        # serve the built app + API from Express (:8787)
npm run web      # Vite only
npm run server   # backend only
```

## How it works

The React front end (all in `src/CartoonStudio.jsx`) never talks to Anthropic
directly — a small Express proxy in `server/index.js` holds the API key and
exposes `POST /api/generate`. The server **owns the prompts**: the client sends
only an action (`script` / `panel` / `cartoon`) plus validated parameters, so the
endpoint can't be abused as a generic Claude proxy. It's also rate-limited per IP
(`RATE_LIMIT_PER_MIN`, default 20/min) and by a global daily cap
(`RATE_LIMIT_PER_DAY`, default 500/day) to bound spend. Set `REDIS_URL` to share
those limits across multiple instances (it falls back to in-memory otherwise).
Set the model with `ANTHROPIC_MODEL` (default `claude-opus-4-8`).

## Tech stack

React + Vite (icons from `lucide-react`) on the front end; Express +
`@anthropic-ai/sdk` on the backend.
