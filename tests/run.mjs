// Test runner: executes pure unit tests, then serves the site over HTTP and
// runs the Playwright e2e suite against it. Exits non-zero on any failure.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;

let passed = 0;
let failed = 0;

/* ---- unit tests ---- */
async function runUnit() {
  console.log("\nUnit tests");
  const { tests } = await import("./unit.test.mjs");
  for (const [name, fn] of Object.entries(tests)) {
    try {
      await fn();
      passed++;
      console.log(`  ${GREEN("✓")} ${name}`);
    } catch (err) {
      failed++;
      console.log(`  ${RED("✗")} ${name}`);
      console.log(DIM(`      ${err.message}`));
    }
  }
}

/* ---- static server ---- */
const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

function startServer() {
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    const filePath = path.join(root, urlPath);
    if (!filePath.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404).end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

/* ---- resolve playwright (local dep or global install) ---- */
async function loadChromium() {
  const require = createRequire(import.meta.url);
  const candidates = ["playwright", "playwright-core"];
  for (const name of candidates) {
    try {
      return (await import(name)).chromium;
    } catch {}
  }
  // Fall back to a global install.
  for (const base of ["/opt/node22/lib/node_modules", process.env.npm_config_prefix].filter(Boolean)) {
    try {
      const mod = await import(path.join(base, "playwright", "index.mjs"));
      return mod.chromium;
    } catch {}
  }
  return null;
}

async function runE2ESuite() {
  const chromium = await loadChromium();
  if (!chromium) {
    console.log("\n" + DIM("E2E tests skipped — Playwright not available in this environment."));
    return;
  }
  console.log("\nE2E tests (headless Chromium)");
  const server = await startServer();
  const { port } = server.address();
  const baseURL = `http://127.0.0.1:${port}/`;
  try {
    const { runE2E } = await import("./e2e.test.mjs");
    const results = await runE2E(chromium, baseURL);
    for (const r of results) {
      if (r.ok) {
        passed++;
        console.log(`  ${GREEN("✓")} ${r.name}`);
      } else {
        failed++;
        console.log(`  ${RED("✗")} ${r.name}`);
        console.log(DIM(`      ${r.error}`));
      }
    }
  } finally {
    server.close();
  }
}

await runUnit();
await runE2ESuite();

console.log(`\n${failed ? RED("FAIL") : GREEN("PASS")}  ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
