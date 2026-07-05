import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
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

// ---------- allowed inputs (kept in sync with the front-end presets) ----------
const FORMATS = ["Kids' story", "Explainer", "Ad / promo", "Short play"];
const TONES = ["Playful", "Heartwarming", "Funny", "Epic", "Calm"];
const STYLES = [
  "Flat 2D vector",
  "Pixar-style 3D",
  "Anime",
  "Comic ink",
  "Claymation",
  "Retro Saturday-morning",
];
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const MAX_IDEA = 2000;
const MAX_FIELD = 1000;
const MAX_CHARACTERS = 12;
const MAX_IMAGE_B64 = 7_000_000; // ~5MB decoded; client downscales before upload

// ---------- validation helpers ----------
class BadInput extends Error {}
const str = (v, max, label) => {
  if (typeof v !== "string" || !v.trim()) throw new BadInput(`Missing ${label}.`);
  if (v.length > max) throw new BadInput(`${label} is too long.`);
  return v;
};
const oneOf = (v, allowed, label) => {
  if (!allowed.includes(v)) throw new BadInput(`Invalid ${label}.`);
  return v;
};

// ---------- prompt builders (the studio owns every prompt; the client can only
// pick presets and supply the idea/photo — it can never inject a system prompt) ----------
function buildRequest(body) {
  const action = body?.action;

  if (action === "script") {
    const idea = str(body.idea, MAX_IDEA, "idea");
    const format = oneOf(body.format, FORMATS, "format");
    const tone = oneOf(body.tone, TONES, "tone");
    const sceneCount = Number(body.sceneCount);
    if (!Number.isInteger(sceneCount) || sceneCount < 3 || sceneCount > 5) {
      throw new BadInput("Invalid sceneCount.");
    }
    return {
      system:
        "You are a cartoon scriptwriter for short faceless videos. Reply with ONLY raw JSON, no prose, no markdown fences. Keep it tight.",
      messages: [
        {
          role: "user",
          content:
            `Write a ${format} in a ${tone} tone from this idea: "${idea}". ` +
            `Use exactly ${sceneCount} scenes. JSON shape: ` +
            `{"title":string,"logline":string (1 sentence),` +
            `"characters":[{"name":string,"look":string (8-15 word visual descriptor for consistent art)}],` +
            `"scenes":[{"n":number,"setting":string,"action":string (1-2 sentences),"line":string (the narration or key spoken line)}]}`,
        },
      ],
    };
  }

  if (action === "panel") {
    const style = oneOf(body.style, STYLES, "style");
    const scene = body.scene || {};
    const n = Number(scene.n);
    if (!Number.isFinite(n)) throw new BadInput("Invalid scene number.");
    const setting = str(scene.setting, MAX_FIELD, "scene setting");
    const action_ = str(scene.action, MAX_FIELD, "scene action");
    const characters = Array.isArray(body.characters) ? body.characters : [];
    if (characters.length > MAX_CHARACTERS) throw new BadInput("Too many characters.");
    const charLook = characters
      .map((c) => `${str(c?.name, 200, "character name")}: ${str(c?.look, 300, "character look")}`)
      .join("; ");
    return {
      system:
        "You are a storyboard artist and AI-image prompt engineer. Reply with ONLY raw JSON, no fences.",
      messages: [
        {
          role: "user",
          content:
            `Art style: ${style}. Keep characters consistent using these looks -> ${charLook}. ` +
            `Scene ${n} setting: ${setting}. Action: ${action_}. ` +
            `JSON shape: {"visual":string (what the frame shows, 1 sentence),` +
            `"imagePrompt":string (a detailed ready-to-paste image-gen prompt: include the art style, the character look, setting, lighting, framing),` +
            `"shot":string (camera/shot e.g. 'wide establishing','close-up'),` +
            `"narration":string (the voiceover line for this scene)}`,
        },
      ],
    };
  }

  if (action === "cartoon") {
    const photoStyle = oneOf(body.photoStyle, STYLES, "photo style");
    const image = body.image || {};
    const mediaType = oneOf(image.type, IMAGE_TYPES, "image type");
    if (typeof image.data !== "string" || !image.data) throw new BadInput("Missing image data.");
    if (image.data.length > MAX_IMAGE_B64) throw new BadInput("Image is too large.");
    return {
      system:
        "You look at a photo and write ONE detailed image-generation prompt to recreate the subject as a cartoon. Reply with ONLY the prompt text, no preamble, no quotes.",
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image.data } },
            {
              type: "text",
              text: `Recreate this as a cartoon in "${photoStyle}" style. Keep the subject recognisable. Describe face/clothing/pose/colours so an image model can render it.`,
            },
          ],
        },
      ],
    };
  }

  throw new BadInput("Unknown action.");
}

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
  message: { error: "Too many requests — give the studio a moment and try again." },
});

// Global daily ceiling across all callers, to bound total spend per day.
// In-memory + per-process: for a single-instance deploy. Use a shared store
// (e.g. rate-limit-redis) if you run multiple instances.
const dailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_PER_DAY) || 500,
  keyGenerator: () => "global",
  standardHeaders: true,
  legacyHeaders: false,
  validate: false, // static key is intentional (global counter)
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

app.listen(PORT, () => {
  console.log(`Cartoon Studio API on http://localhost:${PORT} (model: ${MODEL})`);
  if (!client) console.warn("⚠  ANTHROPIC_API_KEY not set — /api/generate will 500.");
});
