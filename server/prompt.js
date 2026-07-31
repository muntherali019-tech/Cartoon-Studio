// Shared prompt-building + input validation for the Cartoon Studio API.
// Imported by both the Express server (server/index.js) and the Netlify function
// (netlify/functions/generate.js) so the two backends never drift.
//
// The studio owns every prompt: callers send only { action, ...params }; they can
// never inject a system prompt or raw messages.

// ---------- allowed inputs (kept in sync with the front-end presets) ----------
export const FORMATS = ["Kids' story", "Explainer", "Ad / promo", "Short play"];
export const TONES = ["Playful", "Heartwarming", "Funny", "Epic", "Calm"];
export const STYLES = [
  "Flat 2D vector",
  "Pixar-style 3D",
  "Anime",
  "Comic ink",
  "Claymation",
  "Retro Saturday-morning",
];
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const MAX_IDEA = 2000;
const MAX_FIELD = 1000;
const MAX_CHARACTERS = 12;
const MAX_IMAGE_B64 = 7_000_000; // ~5MB decoded; client downscales before upload

// ---------- validation helpers ----------
export class BadInput extends Error {}

const str = (v, max, label) => {
  if (typeof v !== "string" || !v.trim()) throw new BadInput(`Missing ${label}.`);
  if (v.length > max) throw new BadInput(`${label} is too long.`);
  return v;
};
const oneOf = (v, allowed, label) => {
  if (!allowed.includes(v)) throw new BadInput(`Invalid ${label}.`);
  return v;
};

// Build the { system, messages } for a validated request, or throw BadInput.
export function buildRequest(body) {
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
