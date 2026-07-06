#!/usr/bin/env bash
# One-command setup for auto-deploy. Run locally after installing the GitHub CLI
# (`gh auth login`). It stores the deploy secrets in this repo so that a push to
# `main` builds, tests, and deploys automatically (see .github/workflows/ci.yml).
#
#   ./scripts/go-live.sh      (or: npm run go-live)
#
# Nothing is printed or committed — secrets go straight into GitHub. Leave any
# prompt blank to skip that platform.
set -euo pipefail

command -v gh >/dev/null || { echo "Install the GitHub CLI first: https://cli.github.com"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Run 'gh auth login' first."; exit 1; }

repo="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
echo "Configuring auto-deploy secrets for: $repo"
echo "(input is hidden; press Enter to skip a value)"
echo

read -rsp "Netlify auth token (NETLIFY_AUTH_TOKEN): " NETLIFY_AUTH_TOKEN; echo
read -rp  "Netlify site ID     (NETLIFY_SITE_ID):   " NETLIFY_SITE_ID
read -rsp "Render deploy hook  (RENDER_DEPLOY_HOOK_URL): " RENDER_DEPLOY_HOOK_URL; echo

set_secret() { # name value
  if [ -n "${2:-}" ]; then
    printf '%s' "$2" | gh secret set "$1" --repo "$repo" --body-file -
    echo "  ✓ set $1"
  else
    echo "  – skipped $1 (blank)"
  fi
}

echo
echo "Storing secrets…"
set_secret NETLIFY_AUTH_TOKEN "$NETLIFY_AUTH_TOKEN"
set_secret NETLIFY_SITE_ID "$NETLIFY_SITE_ID"
set_secret RENDER_DEPLOY_HOOK_URL "$RENDER_DEPLOY_HOOK_URL"

cat <<'EOF'

Done. Remaining one-time steps (per platform):
  • Netlify: create the site once (npx netlify-cli sites:create) and set
    ANTHROPIC_API_KEY in the site's environment variables.
  • Render:  create the service once from render.yaml (New > Blueprint); the
    Blueprint prompts for ANTHROPIC_API_KEY.

Then: merge to `main` (or push to it) — CI builds, tests, and deploys.
PRs get an automatic Netlify preview URL commented on the PR.
EOF
