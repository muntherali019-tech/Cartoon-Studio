// Render backends.
//
// The Studio calls generate(); if a hosted model is configured (endpoint +
// key) it POSTs the optimized master prompt to that model and returns the
// image. With no credentials configured — the case for this public static
// demo — it transparently falls back to the local Studio Demo Engine so the
// live demo always works. The request shapes below are the real payloads each
// provider expects, so wiring a production key is a config change, not a code
// change.

import { renderCartoonDataUrl } from "./renderer.js";
import { buildMasterPrompt } from "./prompts.js";

// Populate these from a secure config/proxy in production. Left empty here so
// nothing ships a key and the demo runs fully client-side.
export const RENDER_CONFIG = {
  backend: "demo", // "demo" | "openai" | "stability" | "replicate"
  apiBase: "",
  apiKey: "",
  model: "",
};

const ADAPTERS = {
  // OpenAI Images (gpt-image-1 class) — returns b64 JSON.
  openai: async (mp, cfg) => {
    const res = await fetch(`${cfg.apiBase || "https://api.openai.com"}/v1/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model || "gpt-image-1",
        prompt: mp.positive,
        size: "1024x1024",
        n: 1,
      }),
    });
    if (!res.ok) throw new Error(`openai ${res.status}`);
    const json = await res.json();
    return `data:image/png;base64,${json.data[0].b64_json}`;
  },

  // Stability AI SD3 — multipart form, returns raw image bytes.
  stability: async (mp, cfg) => {
    const form = new FormData();
    form.append("prompt", mp.positive);
    form.append("negative_prompt", mp.negative);
    form.append("output_format", "png");
    const res = await fetch(
      `${cfg.apiBase || "https://api.stability.ai"}/v2beta/stable-image/generate/core`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.apiKey}`, Accept: "image/*" },
        body: form,
      }
    );
    if (!res.ok) throw new Error(`stability ${res.status}`);
    const blob = await res.blob();
    return await blobToDataUrl(blob);
  },

  // Replicate — async prediction, poll until complete.
  replicate: async (mp, cfg) => {
    const base = cfg.apiBase || "https://api.replicate.com";
    const start = await fetch(`${base}/v1/predictions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        version: cfg.model,
        input: { prompt: mp.positive, negative_prompt: mp.negative },
      }),
    });
    if (!start.ok) throw new Error(`replicate ${start.status}`);
    let pred = await start.json();
    while (pred.status === "starting" || pred.status === "processing") {
      await new Promise((r) => setTimeout(r, 1200));
      pred = await (await fetch(pred.urls.get, {
        headers: { Authorization: `Token ${cfg.apiKey}` },
      })).json();
    }
    if (pred.status !== "succeeded") throw new Error(`replicate ${pred.status}`);
    return Array.isArray(pred.output) ? pred.output[0] : pred.output;
  },
};

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

// Public API. Returns { src, engine } where engine identifies who rendered it.
export async function generate({ prompt, style, seed }, cfg = RENDER_CONFIG) {
  const mp = buildMasterPrompt(style, prompt);
  const adapter = ADAPTERS[cfg.backend];

  if (adapter && cfg.apiKey) {
    try {
      const src = await adapter(mp, cfg);
      return { src, engine: cfg.backend, prompt: mp };
    } catch (err) {
      // Never leave the user staring at a failure — fall back to the demo.
      console.warn("Hosted render failed, using demo engine:", err.message);
    }
  }

  return {
    src: renderCartoonDataUrl({ prompt, style, seed }),
    engine: "demo",
    prompt: mp,
  };
}
