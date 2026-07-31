// Style presets and the master-prompt optimizer.
//
// Each style ships a hand-tuned "master prompt" — the positive/negative
// phrasing that gets the best output from a real image model — plus the
// palette + shape treatment the local demo engine uses to emulate it.

export const STYLES = [
  {
    id: "pop",
    name: "Pop Art",
    tagline: "Bold outlines, halftone punch",
    // Master prompt fragments tuned for image models.
    master:
      "vibrant pop-art cartoon portrait, thick black ink outlines, Ben-Day " +
      "halftone dots, flat saturated primary colors, comic-book shading, " +
      "high contrast, clean vector look",
    negative: "photorealistic, muddy colors, gradient noise, blurry",
    palette: ["#ff3b6b", "#ffd23f", "#3fa7ff", "#1c1b29", "#fff4e6"],
    treatment: "halftone",
    outline: 6,
  },
  {
    id: "water",
    name: "Watercolour",
    tagline: "Soft washes, gentle edges",
    master:
      "soft watercolour cartoon portrait, delicate paper texture, gentle " +
      "colour bleeds, pastel palette, hand-painted illustration, light " +
      "airy shading, storybook charm",
    negative: "harsh outlines, neon, 3d render, plastic",
    palette: ["#f6a5c0", "#a5d8ff", "#ffe3a3", "#c3f0ca", "#fdf6ef"],
    treatment: "soft",
    outline: 0,
  },
  {
    id: "chibi",
    name: "Chibi",
    tagline: "Big head, bigger charm",
    master:
      "adorable chibi cartoon character, oversized head, huge sparkly eyes, " +
      "tiny body, kawaii style, soft cel shading, rounded shapes, cheerful",
    negative: "realistic proportions, gritty, dark, detailed anatomy",
    palette: ["#ffb4d1", "#ffe066", "#8ce0c0", "#b8b4ff", "#fff7fb"],
    treatment: "cel",
    outline: 4,
  },
  {
    id: "noir",
    name: "Ink Noir",
    tagline: "High-contrast monochrome",
    master:
      "dramatic black-and-white ink cartoon portrait, film-noir lighting, " +
      "bold brush strokes, deep shadows, crosshatching, graphic-novel style, " +
      "moody and cinematic",
    negative: "colorful, flat lighting, pastel, low contrast",
    palette: ["#111114", "#2b2b33", "#7a7a86", "#d8d8de", "#f5f5f7"],
    treatment: "cel",
    outline: 5,
  },
  {
    id: "retro",
    name: "Retro 70s",
    tagline: "Warm, groovy, nostalgic",
    master:
      "retro 1970s cartoon portrait, warm mustard and terracotta palette, " +
      "grainy print texture, rounded groovy shapes, vintage advertising " +
      "illustration, sun-faded tones",
    negative: "modern, neon, sharp digital, cool blue tones",
    palette: ["#e07a3f", "#e9c46a", "#8ab17d", "#6b4f3a", "#f4ead5"],
    treatment: "grain",
    outline: 3,
  },
  {
    id: "neon",
    name: "Neon Cyber",
    tagline: "Glowing synthwave energy",
    master:
      "neon synthwave cartoon portrait, glowing magenta and cyan rim light, " +
      "dark background, retro-futuristic, vaporwave gradients, sharp digital " +
      "vector art, luminous edges",
    negative: "daylight, pastel, matte, hand-drawn paper",
    palette: ["#ff2fd0", "#2ff0ff", "#7a2fff", "#12071f", "#f6e9ff"],
    treatment: "glow",
    outline: 2,
  },
];

export function getStyle(id) {
  return STYLES.find((s) => s.id === id) || STYLES[0];
}

// Build the optimized "master prompt" string sent to an image model.
// Combines the user's subject with the style's tuned phrasing plus a set of
// universal quality boosters, and returns both the positive and negative
// prompt. Kept pure so it can be unit-tested and previewed live.
export function buildMasterPrompt(styleId, subject) {
  const style = getStyle(styleId);
  const cleaned = (subject || "").trim().replace(/\s+/g, " ");
  const focus = cleaned || "a friendly character";

  const boosters = [
    "masterpiece",
    "clean composition",
    "expressive face",
    "centered portrait",
    "crisp edges",
    "professional illustration",
  ];

  const positive = [
    focus,
    style.master,
    boosters.join(", "),
  ].join(", ");

  return {
    styleId: style.id,
    styleName: style.name,
    subject: focus,
    positive,
    negative: style.negative,
  };
}

// Realistic example subjects for the demo — never lorem ipsum.
export const EXAMPLE_SUBJECTS = [
  "a golden retriever wearing round glasses",
  "a barista with pink hair holding a latte",
  "an astronaut cat floating past the moon",
  "a friendly grandmother tending her rooftop garden",
  "a skateboarding fox in a hoodie",
  "a jazz pianist mid-performance under a spotlight",
];
