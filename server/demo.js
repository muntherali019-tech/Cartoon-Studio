// Cartoon Studio demo engine.
//
// When no ANTHROPIC_API_KEY is present the product still has to feel real — so
// instead of "lorem ipsum" or a "demo mode" banner, this module writes genuine,
// topic-aware content: single illustration briefs, multi-panel comic strips with
// dialogue, reusable character sheets, sticker packs and toonify specs. It reads
// like a real cartoonist wrote it, so a live demo is fully believable.

// ---- topic understanding -------------------------------------------------

const CATEGORIES = {
  animals: ["cat", "dog", "fox", "bear", "panda", "dragon", "dino", "dinosaur", "bunny", "owl", "sloth", "penguin", "shark", "puppy", "kitten"],
  office: ["work", "office", "boss", "meeting", "email", "monday", "coffee", "deadline", "startup", "coder", "developer", "zoom", "job"],
  gaming: ["game", "gamer", "gaming", "boss fight", "level", "controller", "rpg", "loot", "respawn", "noob"],
  food: ["pizza", "taco", "coffee", "donut", "burger", "cake", "ramen", "snack", "sushi", "avocado", "food"],
  space: ["space", "astronaut", "alien", "rocket", "planet", "moon", "galaxy", "star", "robot"],
  superhero: ["hero", "superhero", "villain", "cape", "power", "save", "city", "sidekick"],
  everyday: ["gym", "monday", "sleep", "procrastinate", "diet", "cat person", "plants", "introvert", "adulting"],
};

export function categorize(topic = "") {
  const t = String(topic).toLowerCase();
  let best = "everyday", score = 0;
  for (const [cat, words] of Object.entries(CATEGORIES)) {
    const hits = words.reduce((n, w) => (t.includes(w) ? n + 1 : n), 0);
    if (hits > score) { score = hits; best = cat; }
  }
  return score ? best : "everyday";
}

function subject(topic) {
  const t = String(topic || "a lovable little character").trim().replace(/[.?!]+$/, "");
  return t.length > 60 ? t.slice(0, 60).trim() + "…" : t;
}
function slug(topic) {
  return String(topic || "cartoon").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20) || "cartoon";
}
function titleCase(s) {
  return String(s).replace(/\b\w/g, (c) => c.toUpperCase());
}
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
function pick(arr, seed) {
  return arr[Math.abs(hashStr(seed)) % arr.length];
}

const STYLES = [
  "1990s Saturday-morning cartoon, bold outlines, flat cel shading",
  "modern flat vector, clean shapes, soft gradients",
  "classic newspaper comic strip, ink lines, halftone dots",
  "Ghibli-soft watercolour, warm light, gentle edges",
  "bold American comic ink, dynamic shadows, pop colours",
];
const PALETTES = [
  { primary: "#FF5C7A", secondary: "#5B8CFF", outline: "#141821", paper: "#FFF3E9" },
  { primary: "#36E0A0", secondary: "#FFB23E", outline: "#0E1116", paper: "#EAFBF4" },
  { primary: "#A66BFF", secondary: "#FF8A47", outline: "#141013", paper: "#F3EDFF" },
  { primary: "#FFB23E", secondary: "#4DA6FF", outline: "#1a1205", paper: "#FFF6E8" },
];
const TAG_BANK = {
  animals: ["#cartoon", "#cuteanimals", "#illustration", "#doodle", "#characterdesign"],
  office: ["#worklife", "#officehumor", "#cartoon", "#relatable", "#mondaymood"],
  gaming: ["#gaming", "#gamerlife", "#cartoon", "#pixelheart", "#bossfight"],
  food: ["#foodie", "#cartoon", "#cutefood", "#kawaii", "#snackattack"],
  space: ["#space", "#scifi", "#cartoon", "#astronaut", "#doodle"],
  superhero: ["#superhero", "#comic", "#cartoon", "#comicart", "#heroes"],
  everyday: ["#relatable", "#cartoon", "#doodle", "#comicstrip", "#sliceoflife"],
};
function tags(topic) {
  const cat = categorize(topic);
  return [...TAG_BANK[cat].slice(0, 4), `#${slug(topic)}`];
}
function styleFor(topic) { return pick(STYLES, subject(topic)); }
function paletteFor(topic) { return pick(PALETTES, subject(topic) + "p"); }

// ---- single illustration -------------------------------------------------

export function demoIllustration(topic, style = "") {
  const s = subject(topic);
  const artStyle = style || styleFor(topic);
  const captions = [
    `${titleCase(s)}, but make it iconic`,
    `certified ${slug(topic)} moment`,
    `a whole mood`,
    `main character energy`,
  ];
  return {
    caption: pick(captions, s),
    imagePrompt: `A charming cartoon of ${s}: expressive face, dynamic pose, simple readable background, centred framing, warm key light. Art style: ${artStyle}.`,
    palette: paletteFor(topic),
    style: artStyle,
  };
}

// ---- comic strip ---------------------------------------------------------

const COMIC_ARCS = {
  office: [
    ["Monday, 9:00am", "Our hero stares into a bottomless inbox.", [["You", "It's fine. Everything's fine."]]],
    ["9:01am", "The inbox refreshes. It doubled.", [["Inbox", "ding ding ding"]]],
    ["9:02am", "Slow zoom on a single, unblinking eye.", []],
    ["The punchline", "They calmly close the laptop and walk into the sea.", [["You", "Out of office."]]],
  ],
  gaming: [
    ["The setup", "Player faces the final boss, health bar full.", [["Hero", "I've trained my whole life for this."]]],
    ["The build", "Boss winds up a screen-filling attack.", [["Boss", "have you though?"]]],
    ["Beat", "One (1) HP remains. Sweat.", []],
    ["The punchline", "Victory! ...the controller was unplugged the whole time.", [["Hero", "wait."]]],
  ],
  animals: [
    ["Morning", "A very smug cat sits by an empty bowl.", [["Cat", "I am starving."]]],
    ["The ask", "It stares directly into your soul.", [["Cat", "possibly dying."]]],
    ["The reveal", "The bowl is, in fact, full.", []],
    ["The punchline", "The cat knocks the full bowl off the counter. Eye contact maintained.", [["Cat", "now we understand each other."]]],
  ],
  everyday: [
    ["The plan", "Tonight: bed early, be a functional adult.", [["You", "New me starts now."]]],
    ["The build", "One episode won't hurt.", [["TV", "Are you still watching?"]]],
    ["Beat", "The sun rises. Birds sing. The episode counter judges.", []],
    ["The punchline", "New me starts... tomorrow.", [["You", "final answer."]]],
  ],
};

export function demoComic(idea, panels = 4) {
  const s = subject(idea);
  const cat = categorize(idea);
  const arc = COMIC_ARCS[cat] || COMIC_ARCS.everyday;
  const style = styleFor(idea);
  const out = [];
  for (let i = 0; i < panels; i++) {
    const [beat, action, dialogue] = arc[i % arc.length];
    out.push({
      panel: i + 1,
      caption: beat,
      action,
      dialogue: (dialogue || []).map(([speaker, line]) => ({ speaker, line })),
      imagePrompt: `Comic panel ${i + 1} about "${s}": ${action} Consistent characters and framing, expressive faces. Art style: ${style}.`,
    });
  }
  return {
    title: `${titleCase(s)}: A Strip`,
    style,
    palette: paletteFor(idea),
    panels: out.slice(0, panels),
    shareCaption: `${titleCase(s)} in ${panels} panels 😹 ${tags(idea).join(" ")}`,
    hashtags: tags(idea),
  };
}

// ---- character sheet -----------------------------------------------------

export function demoCharacter(description) {
  const s = subject(description);
  const cat = categorize(description);
  const style = styleFor(description);
  const names = {
    animals: ["Biscuit", "Sir Pounce", "Waffles", "Mochi"],
    office: ["Deadline Dan", "Karen from Finance", "Intern Ito", "Boss Cat"],
    gaming: ["Pixel", "Noobslayer", "Captain Respawn", "Lagatha"],
    food: ["Sir Loin", "Queso", "Bubbles the Boba", "Donut Dave"],
    space: ["Cosmo", "Zorb", "Captain Nebula", "Bleep-7"],
    superhero: ["Captain Obvious", "The Napper", "Ultraviolet", "Side-Kick Steve"],
    everyday: ["Procrasti Nate", "Couch Goblin", "Bex", "Gym-Sometimes Sam"],
  };
  const pal = paletteFor(description);
  return {
    name: pick(names[cat] || names.everyday, s),
    personality: `Big-hearted, a little chaotic, ${cat === "office" ? "running on caffeine and spite" : "always up for an adventure"}.`,
    look: `Rounded, huggable silhouette; oversized expressive eyes; one signature accessory; bold ${pal.primary} and ${pal.secondary} colour scheme with clean ${pal.outline} outlines.`,
    style,
    palette: pal,
    imagePrompt: `Character turnaround / hero portrait of "${titleCase(s)}": clear silhouette, front and 3/4 views, neutral background, consistent proportions. Art style: ${style}.`,
  };
}

// ---- sticker pack --------------------------------------------------------

export function demoStickers(character, count = 6) {
  const s = subject(character);
  const style = styleFor(character);
  const set = [
    ["LOL", "head thrown back, mid belly-laugh"],
    ["nope", "arms crossed, unimpressed side-eye"],
    ["love it", "starry eyes, hands clasped, floating hearts"],
    ["oops", "wide-eyed, sweat-drop, awkward grin"],
    ["hype", "both fists up, jumping, motion lines"],
    ["sleepy", "yawning, half-closed eyes, tiny 'zzz'"],
    ["thanks!", "little bow, one hand on chest, sparkle"],
    ["brb", "dashing off-frame, dust cloud"],
  ];
  const stickers = [];
  for (let i = 0; i < count; i++) {
    const [label, pose] = set[i % set.length];
    stickers.push({
      label,
      pose,
      imagePrompt: `Sticker of ${s}: ${pose}. Same character and style across the pack, bold readable shapes, thick clean border for die-cut, transparent-friendly. Art style: ${style}.`,
    });
  }
  return { character: titleCase(s), style, palette: paletteFor(character), stickers };
}

// ---- toonify (vision) ----------------------------------------------------

export function demoToonify(style = "") {
  const artStyle = style || STYLES[0];
  return {
    caption: "toon mode: activated ✨",
    imagePrompt: `Cartoon version of the person in the photo: keep the recognisable features (hairstyle, expression, glasses, outfit colours), restyle as an appealing cartoon with clean outlines and flat shading, friendly proportions, simple background. Art style: ${artStyle}.`,
    palette: PALETTES[0],
    style: artStyle,
  };
}

// ---- captions / memes ----------------------------------------------------

export function demoCaptions(topic, count = 6) {
  const s = subject(topic);
  const lines = [
    `POV: ${s} at 3am`,
    `nobody: … me and ${s}:`,
    `${titleCase(s)}? in THIS economy?`,
    `it's giving ${slug(topic)}`,
    `me pretending ${s} is fine`,
    `the ${s} starter pack`,
    `${titleCase(s)}, colourised`,
  ];
  const out = [];
  for (let i = 0; i < count; i++) out.push(`${i + 1}. ${lines[i % lines.length]}`);
  return out.join("\n");
}

export { PALETTES, STYLES };
