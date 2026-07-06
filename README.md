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

## Deploy

**Docker (app + Redis, one command):**

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
docker compose up --build     # app on http://localhost:8787, Redis wired in
```

**Render (one click, full backend):** push this repo, then in Render choose
**New → Blueprint** and point it at the repo. `render.yaml` provisions the web
service **and** a Redis instance, wires `REDIS_URL` between them automatically, and
prompts you for `ANTHROPIC_API_KEY`. Hit **Apply**. This is the full-featured
backend (per-IP + daily rate caps shared via Redis).

**Netlify (static + serverless):** connect the repo in Netlify and set
`ANTHROPIC_API_KEY` in the site's environment variables. `netlify.toml` builds the
SPA and serves `/api/generate` as a serverless function that reuses the same
prompt-restriction/validation logic (`server/prompt.js`). Note: the serverless
path does **not** enforce the rate caps (those need Redis) — for a public deploy,
enable Netlify's platform rate limiting, or proxy `/api/*` to the Render backend
(a commented-out redirect for this is included in `netlify.toml`).

### Auto-deploy on push (no dashboard step per deploy)

The `deploy` job in `.github/workflows/ci.yml` runs **only on push to `main`, and
only after the build + Docker tests pass**. Each step self-skips if its secret is
missing, so nothing deploys until you add the secrets below under
**Repo → Settings → Secrets and variables → Actions**. Do **not** paste tokens in
chat — put them straight into GitHub Secrets.

| Secret | Where to get it | One-time setup |
|---|---|---|
| `NETLIFY_AUTH_TOKEN` | Netlify → User settings → Applications → **New access token** | — |
| `NETLIFY_SITE_ID` | Create the site once (`npx netlify-cli sites:create`, or the dashboard) → the site's **API ID** | Set `ANTHROPIC_API_KEY` in the site's env vars |
| `RENDER_DEPLOY_HOOK_URL` | Render service → Settings → **Deploy Hook** (create the service once from `render.yaml`) | Blueprint prompts for `ANTHROPIC_API_KEY` |

With those set, `git push` to `main` builds, tests, and deploys to both platforms
automatically. (Render's Blueprint can also auto-deploy on its own once connected —
if you rely on that, you can omit `RENDER_DEPLOY_HOOK_URL`.)

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
