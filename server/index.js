import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { createClient } from "redis";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { buildRequest, BadInput } from "./prompt.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8787;

// Shared rate-limit store for multi-instance deploys. If REDIS_URL is set we back
// the limiters with Redis so the caps hold across every instance; otherwise we
// fall back to per-process in-memory counters (fine for a single instance / dev).
let redisClient = null;
if (process.env.REDIS_URL) {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 5000,
        // Give up after a few tries so an unreachable Redis fails fast instead
        // of hanging startup; we then fall back to in-memory limiting.
        reconnectStrategy: (retries) =>
          retries > 3 ? new Error("Redis unavailable") : Math.min(retries * 200, 1000),
      },
    });
    redisClient.on("error", (e) => console.error("Redis error:", e.message));
    await redisClient.connect();
    console.log("Rate limiting via Redis (shared across instances).");
  } catch (e) {
    console.warn(`⚠  Could not connect to Redis (${e.message}); using in-memory rate limiting.`);
    try { await redisClient?.destroy?.(); } catch { /* ignore */ }
    redisClient = null;
  }
}

// Returns a RedisStore when Redis is connected, else undefined (default MemoryStore).
// Each limiter needs its own prefix so counters don't collide.
function makeStore(prefix) {
  if (!redisClient) return undefined;
  return new RedisStore({ prefix, sendCommand: (...args) => redisClient.sendCommand(args) });
}

// The model is fixed server-side; override with ANTHROPIC_MODEL if you want a
// different tier (e.g. claude-sonnet-5 for lower cost).
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

const app = express();
app.set("trust proxy", 1); // read the real client IP behind a hosting proxy
app.use(express.json({ limit: "12mb" })); // photos arrive as base64

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, hasKey: Boolean(client), model: MODEL });
});

// Cap how often any one IP can hit the (paid) model endpoint.
const generateLimiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_PER_MIN) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore("rl:min:"),
  message: { error: "Too many requests — give the studio a moment and try again." },
});

// Global daily ceiling across all callers, to bound total spend per day.
const dailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_PER_DAY) || 500,
  keyGenerator: () => "global",
  standardHeaders: true,
  legacyHeaders: false,
  validate: false, // static key is intentional (global counter)
  store: makeStore("rl:day:"),
  message: { error: "The studio has hit its daily limit. Please try again tomorrow." },
});

// The only model endpoint. The client sends { action, ...params }; the server
// builds the prompt, so the key AND the prompts stay server-side.
app.post("/api/generate", generateLimiter, dailyLimiter, async (req, res) => {
  if (!client) {
    return res
      .status(500)
      .json({ error: "Server is missing ANTHROPIC_API_KEY. See .env.example." });
  }
  let request;
  try {
    request = buildRequest(req.body || {});
  } catch (err) {
    if (err instanceof BadInput) return res.status(400).json({ error: err.message });
    throw err;
  }
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: request.system,
      messages: request.messages,
    });
    res.json(message);
  } catch (err) {
    const status = err?.status || 500;
    console.error("Anthropic API error:", err?.message || err);
    res.status(status).json({
      error: err?.message || "The studio AI didn't respond. Try that step again.",
    });
  }
});

// Unknown API routes return JSON, not the SPA fallback below.
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));

// In production, serve the built SPA so `node server/index.js` runs the whole app.
const distDir = path.resolve(__dirname, "..", "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(distDir, "index.html")));
}

const server = app.listen(PORT, () => {
  console.log(`Cartoon Studio API on http://localhost:${PORT} (model: ${MODEL})`);
  if (!client) console.warn("⚠  ANTHROPIC_API_KEY not set — /api/generate will 500.");
});

// Close the HTTP server and Redis connection cleanly on shutdown.
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    server.close(async () => {
      try { await redisClient?.quit(); } catch { /* ignore */ }
      process.exit(0);
    });
  });
}
