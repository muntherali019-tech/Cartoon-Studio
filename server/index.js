// Cartoon Studio server — serves the web app and the AI API.
import "./env.js"; // load a local .env (no-op when absent) BEFORE anything reads process.env
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { aiStatus, aiEnabled, generateJSON, generateText, visionExtract } from "./ai.js";
import {
  signup, login, attachUser, publicUser,
  spendCredit, refundCredit, setCharacterKit, isPremium,
  addToGallery, removeFromGallery, getGallery,
} from "./auth.js";
import {
  stripeEnabled, creditPacksEnabled,
  createCheckout, createPackCheckout, handleWebhook, CREDIT_PACKS,
} from "./billing.js";
import { generateImage, imageProvider } from "./images.js";
import { initStore, backend } from "./store.js";
import { PROMPTS } from "./prompts.js";
import {
  demoIllustration, demoComic, demoCharacter, demoStickers, demoToonify, demoCaptions, demoColoring,
} from "./demo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const app = express();
app.set("trust proxy", 1); // behind Render's proxy → req.protocol is https

// Wrap async handlers so a rejected promise becomes a clean 500.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Stripe webhook needs the RAW body — mount it before the JSON parser.
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const result = await handleWebhook(req.body, req.headers["stripe-signature"]);
  res.status(result.status).json({ received: result.ok });
});

app.use(express.json({ limit: "20mb" }));
app.use(attachUser);
app.use(express.static(PUBLIC_DIR));

const NO_WATERMARK = process.env.CARTOON_NO_WATERMARK === "1";

// Credit cost per paid action.
const COST = { cartoon: 1, character: 1, toonify: 1, coloring: 1, comicPerPanel: 1, stickerPerSticker: 1 };

// ---------- meta ----------
app.get("/api/health", (_req, res) => res.json({ ok: true, ...aiStatus() }));

app.get("/api/config", (req, res) => {
  res.json({
    ...aiStatus(),
    watermark: !NO_WATERMARK,
    plans: PLANS,
    stripe: stripeEnabled,
    creditPacksEnabled,
    creditPacks: CREDIT_PACKS.map(({ id, label, credits, price, best }) => ({ id, label, credits, price, best })),
    imageProvider,
    user: publicUser(req.user),
  });
});

// ---------- accounts ----------
app.post("/api/auth/signup", async (req, res) => {
  try { res.json(await signup(req.body?.email, req.body?.password, req.body?.ref)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.post("/api/auth/login", async (req, res) => {
  try { res.json(await login(req.body?.email, req.body?.password)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.get("/api/me", (req, res) => res.json({ user: publicUser(req.user) }));

// ---------- character kit (premium revenue feature) ----------
app.get("/api/characterkit", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Sign in first" });
  res.json({ characterKit: req.user.characterKit || null, premium: isPremium(req.user) });
});
app.post("/api/characterkit", wrap(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Sign in first" });
  try {
    const characterKit = await setCharacterKit(req.user, req.body || {});
    res.json({ characterKit, user: publicUser(req.user) });
  } catch (e) {
    res.status(403).json({ error: e.message });
  }
}));

// ---------- gallery ("My Creations") ----------
app.get("/api/gallery", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Sign in first" });
  res.json({ items: getGallery(req.user) });
});
app.post("/api/gallery", wrap(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Sign in first" });
  try {
    const items = await addToGallery(req.user, req.body || {});
    res.json({ items });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}));
app.delete("/api/gallery/:id", wrap(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Sign in first" });
  const items = await removeFromGallery(req.user, req.params.id);
  res.json({ items });
}));

// ---------- billing ----------
app.post("/api/billing/checkout", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Sign in first" });
  if (!stripeEnabled) return res.status(400).json({ error: "Billing not configured on this server" });
  try {
    const origin = `${req.protocol}://${req.get("host")}`;
    res.json({ url: await createCheckout({ user: req.user, plan: req.body?.plan, origin }) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.post("/api/billing/credits", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Sign in first" });
  if (!creditPacksEnabled) return res.status(400).json({ error: "Credit packs not configured on this server" });
  try {
    const origin = `${req.protocol}://${req.get("host")}`;
    res.json({ url: await createPackCheckout({ user: req.user, pack: req.body?.pack, origin }) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Merge a user's Character Kit style/palette into a render spec.
function applyKit(spec, user) {
  const kit = user?.characterKit;
  if (!spec || !kit) return spec;
  if (kit.style) spec.style = kit.style;
  spec.palette = { primary: kit.primary, secondary: kit.secondary, outline: kit.outline, paper: spec.palette?.paper || "#FFF3E9" };
  if (kit.name) spec.brand = { name: kit.name };
  return spec;
}

// ---------- single cartoon (costs 1 credit) ----------
app.post("/api/cartoon", wrap(async (req, res) => {
  const { prompt = "", style = "" } = req.body || {};
  if (!prompt.trim()) return res.status(400).json({ error: "prompt is required" });

  const credit = await spendCredit(req.user, COST.cartoon);
  if (!credit.ok) return res.status(402).json({ error: "out_of_credits", user: publicUser(req.user) });

  let design;
  try {
    design = await generateJSON({
      system: PROMPTS.illustrator,
      content: `Idea: ${prompt}\n${style ? `Preferred style: ${style}\n` : ""}Return JSON: { "caption": string, "imagePrompt": string, "style": string, "palette": {"primary": string, "secondary": string, "outline": string, "paper": string} }`,
      maxTokens: 700,
      demo: () => demoIllustration(prompt, style),
    });
  } catch (e) {
    await refundCredit(req.user, COST.cartoon);
    return res.status(502).json({ error: "generation_failed", user: publicUser(req.user) });
  }
  design = applyKit(design, req.user);

  // Try a real image model first (photoreal cartoon). Falls back to Toon Render.
  const img = await generateImage({ prompt: design.imagePrompt });
  if (img && (img.url || img.b64)) {
    return res.json({ type: "image", url: img.url, b64: img.b64, design, user: publicUser(req.user) });
  }
  res.json({ type: "design", design, user: publicUser(req.user) });
}));

// ---------- printable colouring page (costs 1 credit) ----------
app.post("/api/coloring", wrap(async (req, res) => {
  const { prompt = "" } = req.body || {};
  if (!prompt.trim()) return res.status(400).json({ error: "prompt is required" });

  const credit = await spendCredit(req.user, COST.coloring);
  if (!credit.ok) return res.status(402).json({ error: "out_of_credits", user: publicUser(req.user) });

  let design;
  try {
    design = await generateJSON({
      system: PROMPTS.coloring,
      content: `Idea: ${prompt}\nReturn JSON: { "title": string, "caption": string, "imagePrompt": string, "style": string, "line": true, "palette": {"primary": string, "secondary": string, "outline": string, "paper": string} }`,
      maxTokens: 600,
      demo: () => demoColoring(prompt),
    });
  } catch (e) {
    await refundCredit(req.user, COST.coloring);
    return res.status(502).json({ error: "generation_failed", user: publicUser(req.user) });
  }
  design.line = true; // always render as line art on the client

  // A wired image model can draw real line art; otherwise the client renders it.
  const img = await generateImage({ prompt: `${design.imagePrompt} Black and white line art only, no shading.` });
  if (img && (img.url || img.b64)) {
    return res.json({ type: "image", url: img.url, b64: img.b64, design, user: publicUser(req.user) });
  }
  res.json({ type: "design", design, user: publicUser(req.user) });
}));

// ---------- comic strip (premium, credit-costed per panel) ----------
app.post("/api/comic", wrap(async (req, res) => {
  const { idea = "", panels = 4 } = req.body || {};
  if (!idea.trim()) return res.status(400).json({ error: "idea is required" });
  if (!req.user) return res.status(401).json({ error: "Sign in to make a comic" });
  if (!isPremium(req.user)) return res.status(403).json({ error: "premium_required", user: publicUser(req.user) });

  const n = Math.max(2, Math.min(6, Number(panels) || 4));
  const credit = await spendCredit(req.user, n * COST.comicPerPanel);
  if (!credit.ok) return res.status(402).json({ error: "out_of_credits", user: publicUser(req.user) });

  let data;
  try {
    data = await generateJSON({
      system: PROMPTS.comic(n),
      content: `Comic idea: ${idea}\nReturn JSON: { "title": string, "style": string, "palette": {"primary": string, "secondary": string, "outline": string, "paper": string}, "panels": [{ "panel": number, "caption": string, "action": string, "dialogue": [{"speaker": string, "line": string}], "imagePrompt": string }], "shareCaption": string, "hashtags": [string] } with exactly ${n} panels.`,
      maxTokens: 3000,
      demo: () => demoComic(idea, n),
    });
  } catch (e) {
    await refundCredit(req.user, n * COST.comicPerPanel);
    return res.status(502).json({ error: "generation_failed", user: publicUser(req.user) });
  }
  data = applyKit(data, req.user);
  res.json({ ...data, user: publicUser(req.user) });
}));

// ---------- character designer (costs 1) ----------
app.post("/api/character", wrap(async (req, res) => {
  const { description = "" } = req.body || {};
  if (!description.trim()) return res.status(400).json({ error: "description is required" });

  const credit = await spendCredit(req.user, COST.character);
  if (!credit.ok) return res.status(402).json({ error: "out_of_credits", user: publicUser(req.user) });

  let data;
  try {
    data = await generateJSON({
      system: PROMPTS.character,
      content: `Describe the character: ${description}\nReturn JSON: { "name": string, "personality": string, "look": string, "style": string, "palette": {"primary": string, "secondary": string, "outline": string, "paper": string}, "imagePrompt": string }`,
      maxTokens: 900,
      demo: () => demoCharacter(description),
    });
  } catch (e) {
    await refundCredit(req.user, COST.character);
    return res.status(502).json({ error: "generation_failed", user: publicUser(req.user) });
  }
  res.json({ ...data, user: publicUser(req.user) });
}));

// ---------- sticker pack (premium, credit-costed) ----------
app.post("/api/stickers", wrap(async (req, res) => {
  const { character = "", count = 6 } = req.body || {};
  if (!character.trim()) return res.status(400).json({ error: "character is required" });
  if (!req.user) return res.status(401).json({ error: "Sign in to make stickers" });
  if (!isPremium(req.user)) return res.status(403).json({ error: "premium_required", user: publicUser(req.user) });

  const n = Math.max(3, Math.min(8, Number(count) || 6));
  const credit = await spendCredit(req.user, n * COST.stickerPerSticker);
  if (!credit.ok) return res.status(402).json({ error: "out_of_credits", user: publicUser(req.user) });

  let data;
  try {
    data = await generateJSON({
      system: PROMPTS.stickers(n),
      content: `Character: ${character}\nReturn JSON: { "character": string, "style": string, "palette": {"primary": string, "secondary": string, "outline": string, "paper": string}, "stickers": [{ "label": string, "pose": string, "imagePrompt": string }] } with exactly ${n} stickers.`,
      maxTokens: 2000,
      demo: () => demoStickers(character, n),
    });
  } catch (e) {
    await refundCredit(req.user, n * COST.stickerPerSticker);
    return res.status(502).json({ error: "generation_failed", user: publicUser(req.user) });
  }
  data = applyKit(data, req.user);
  res.json({ ...data, user: publicUser(req.user) });
}));

// ---------- toonify a photo (vision, costs 1) ----------
app.post("/api/toonify", wrap(async (req, res) => {
  const { base64 = "", mediaType = "image/png", style = "" } = req.body || {};
  if (!base64) return res.status(400).json({ error: "base64 image is required" });

  const credit = await spendCredit(req.user, COST.toonify);
  if (!credit.ok) return res.status(402).json({ error: "out_of_credits", user: publicUser(req.user) });

  let design;
  try {
    design = await visionExtract({
      base64, mediaType,
      system: PROMPTS.toonify,
      instruction: `Convert this photo to a cartoon${style ? ` in this style: ${style}` : ""}. Return JSON: { "caption": string, "imagePrompt": string, "style": string, "palette": {"primary": string, "secondary": string, "outline": string, "paper": string} }`,
      demo: () => demoToonify(style),
    });
  } catch (e) {
    await refundCredit(req.user, COST.toonify);
    return res.status(502).json({ error: "toonify_failed", user: publicUser(req.user) });
  }
  design = applyKit(design, req.user);

  const img = await generateImage({ prompt: design.imagePrompt });
  if (img && (img.url || img.b64)) {
    return res.json({ type: "image", url: img.url, b64: img.b64, design, user: publicUser(req.user) });
  }
  res.json({ type: "design", design, user: publicUser(req.user) });
}));

// ---------- captions / memes (free) ----------
app.post("/api/captions", wrap(async (req, res) => {
  const { topic = "", count = 6 } = req.body || {};
  if (!topic.trim()) return res.status(400).json({ error: "topic is required" });
  const text = await generateText({
    system: PROMPTS.captioner,
    content: `Write ${count} short funny cartoon captions about: ${topic}. Number them.`,
    maxTokens: 800,
    demo: demoCaptions(topic, count),
  });
  res.json({ text });
}));

// SPA fallback.
app.get("*", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));

// Global error handler.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err?.message || err);
  if (res.headersSent) return;
  res.status(500).json({ error: "server_error" });
});

const PLANS = [
  {
    id: "free", name: "Free", price: "$0", period: "forever", credits: "8 cartoons / mo",
    features: ["Toon Render engine", "Watermark", "Single cartoons", "Meme captions", "Photo → cartoon"],
    cta: "Start free",
  },
  {
    id: "creator", name: "Creator", price: "$12", period: "/mo", credits: "150 cartoons / mo",
    features: ["No watermark", "Comic Strip Studio", "Character Kit", "Sticker packs", "HD export"],
    cta: "Go Creator", popular: true,
  },
  {
    id: "studio", name: "Studio", price: "$39", period: "/mo", credits: "Unlimited cartoons",
    features: ["Everything in Creator", "Priority rendering", "Commercial licence", "Merch-ready export", "API access"],
    cta: "Go Studio",
  },
];

const PORT = process.env.PORT || 3000;

// Exported so tests can drive the real app in-process. Running the server as a
// child process hides it from `--experimental-test-coverage`, which instruments
// only the current process — so the routes below reported 0% however thoroughly
// they were exercised.
export { app, initStore };

// Only boot when run directly (`node server/index.js`), not when imported.
const runDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (runDirectly) {
  initStore()
    .then(() => {
      app.listen(PORT, () => {
        console.log(
          `Cartoon Studio on http://localhost:${PORT}  (AI: ${aiEnabled ? "live" : "demo"}, store: ${backend}, images: ${imageProvider}, stripe: ${stripeEnabled ? "on" : "off"})`
        );
      });
    })
    .catch((e) => {
      console.error("Failed to initialize store:", e.message);
      process.exit(1);
    });
}
