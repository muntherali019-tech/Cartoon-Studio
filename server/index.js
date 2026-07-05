import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8787;

// The model is fixed server-side; override with ANTHROPIC_MODEL if you want a
// different tier (e.g. claude-sonnet-5 for lower cost).
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

const app = express();
app.use(express.json({ limit: "12mb" })); // photos arrive as base64

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, hasKey: Boolean(client), model: MODEL });
});

// Proxy for the studio. The browser sends { system, messages }; the API key
// stays here on the server and is never exposed to the client.
app.post("/api/messages", async (req, res) => {
  if (!client) {
    return res
      .status(500)
      .json({ error: "Server is missing ANTHROPIC_API_KEY. See .env.example." });
  }
  const { system, messages } = req.body || {};
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "`messages` must be an array." });
  }
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      ...(system ? { system } : {}),
      messages,
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

// In production, serve the built SPA so `node server/index.js` runs the whole app.
const distDir = path.resolve(__dirname, "..", "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(distDir, "index.html")));
}

app.listen(PORT, () => {
  console.log(`Cartoon Studio API on http://localhost:${PORT} (model: ${MODEL})`);
  if (!client) console.warn("⚠  ANTHROPIC_API_KEY not set — /api/messages will 500.");
});
