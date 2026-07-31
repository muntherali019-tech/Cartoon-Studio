// Studio Demo Engine — a procedural cartoon-portrait renderer.
//
// This is NOT a neural image model; it is a deterministic vector engine that
// composes a stylised character portrait from the prompt + style, so the live
// demo produces real, varied, downloadable artwork with no backend. For
// production-grade renders the app can call a hosted model instead (see
// backends.js); this engine is the always-available fallback and offline demo.

import { hashString, createRng } from "./rng.js";
import { getStyle } from "./prompts.js";

const SIZE = 512;

function esc(str) {
  return String(str).replace(/[<>&"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])
  );
}

// Slightly shift a hex colour's lightness for shading.
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const r = clamp(((n >> 16) & 255) + amt);
  const g = clamp(((n >> 8) & 255) + amt);
  const b = clamp((n & 255) + amt);
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

function defs(style, rng, bgA, bgB) {
  let out = `<defs>`;
  out += `<radialGradient id="bg" cx="50%" cy="38%" r="80%">
    <stop offset="0%" stop-color="${bgA}"/>
    <stop offset="100%" stop-color="${bgB}"/></radialGradient>`;

  if (style.treatment === "halftone") {
    out += `<pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse">
      <circle cx="4" cy="4" r="2.4" fill="rgba(0,0,0,0.12)"/></pattern>`;
  }
  if (style.treatment === "grain") {
    out += `<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n"/>
      <feColorMatrix in="n" type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.06"/></feComponentTransfer>
      <feComposite operator="over" in2="SourceGraphic"/></filter>`;
  }
  if (style.treatment === "soft") {
    out += `<filter id="soft"><feGaussianBlur stdDeviation="0.6"/></filter>`;
  }
  if (style.treatment === "glow") {
    out += `<filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  }
  out += `</defs>`;
  return out;
}

// Compose the portrait. Returns a self-contained SVG string.
export function renderCartoon({ prompt = "", style: styleId = "pop", seed } = {}) {
  const style = getStyle(styleId);
  const s = seed == null ? hashString(prompt + "::" + style.id) : seed >>> 0;
  const rng = createRng(s);
  const P = style.palette;

  const skinTones = ["#ffd9b3", "#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#ffe0bd"];
  const isNoir = style.id === "noir";
  const skin = isNoir ? "#d8d8de" : rng.pick(skinTones);
  const hair = style.id === "neon" ? rng.pick(["#2ff0ff", "#ff2fd0", "#7a2fff"]) : rng.pick(P.concat(["#3a2b20", "#111114", "#7a4a2b"]));
  const shirt = rng.pick(P);
  const bgA = P[Math.min(4, P.length - 1)];
  const bgB = shade(bgA, isNoir ? -20 : -30);

  // Chibi exaggerates the head; noir/pop keep classic proportions.
  const chibi = style.id === "chibi";
  const headR = chibi ? 150 : 128;
  const cx = SIZE / 2;
  const cy = chibi ? 210 : 225;

  const outline = style.outline;
  const stroke = outline
    ? ` stroke="${isNoir ? "#111114" : "#1c1b29"}" stroke-width="${outline}"`
    : "";

  const eyeR = chibi ? 26 : 16;
  const eyeY = cy + (chibi ? 6 : 4);
  const eyeDX = chibi ? 46 : 40;
  const happy = rng.chance(0.6);
  const browY = eyeY - eyeR - (rng.chance(0.5) ? 16 : 10);

  const filter =
    style.treatment === "grain" ? ` filter="url(#grain)"`
    : style.treatment === "soft" ? ` filter="url(#soft)"`
    : "";

  let body = "";

  // Background
  body += `<rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>`;
  if (style.treatment === "glow") {
    for (let i = 0; i < 5; i++) {
      body += `<circle cx="${rng.int(0, SIZE)}" cy="${rng.int(0, SIZE)}" r="${rng.int(40, 120)}" fill="${rng.pick(P.slice(0, 3))}" opacity="0.12"/>`;
    }
  } else {
    // soft decorative shapes
    for (let i = 0; i < 4; i++) {
      body += `<circle cx="${rng.int(40, SIZE - 40)}" cy="${rng.int(40, 220)}" r="${rng.int(18, 46)}" fill="${rng.pick(P.slice(0, 3))}" opacity="0.18"/>`;
    }
  }

  const glow = style.treatment === "glow" ? ` filter="url(#glow)"` : "";
  body += `<g${filter}${glow}>`;

  // Shoulders / shirt
  body += `<path d="M${cx - 150} ${SIZE} Q${cx} ${cy + 150} ${cx + 150} ${SIZE} Z" fill="${shirt}"${stroke}/>`;
  body += `<path d="M${cx - 150} ${SIZE} Q${cx} ${cy + 150} ${cx + 150} ${SIZE} Z" fill="${shade(shirt, -18)}" opacity="0.5"/>`;

  // Neck
  body += `<rect x="${cx - 26}" y="${cy + headR - 40}" width="52" height="60" rx="18" fill="${shade(skin, -20)}"${stroke}/>`;

  // Hair back layer
  body += `<circle cx="${cx}" cy="${cy - 10}" r="${headR + 14}" fill="${hair}"${stroke}/>`;

  // Head
  body += `<ellipse cx="${cx}" cy="${cy}" rx="${headR - 6}" ry="${headR + 6}" fill="${skin}"${stroke}/>`;

  // Cheeks
  if (!isNoir && rng.chance(0.7)) {
    body += `<circle cx="${cx - 62}" cy="${eyeY + 42}" r="16" fill="#ff9ab0" opacity="0.5"/>`;
    body += `<circle cx="${cx + 62}" cy="${eyeY + 42}" r="16" fill="#ff9ab0" opacity="0.5"/>`;
  }

  // Hair front (fringe) — vary shape by seed
  const fringe = rng.pick([
    `M${cx - headR} ${cy - 40} Q${cx} ${cy - headR - 30} ${cx + headR} ${cy - 40} Q${cx + 40} ${cy - 70} ${cx} ${cy - 60} Q${cx - 40} ${cy - 70} ${cx - headR} ${cy - 40} Z`,
    `M${cx - headR} ${cy - 20} Q${cx - 60} ${cy - headR} ${cx} ${cy - 70} Q${cx + 60} ${cy - headR} ${cx + headR} ${cy - 20} Q${cx} ${cy - 50} ${cx - headR} ${cy - 20} Z`,
  ]);
  body += `<path d="${fringe}" fill="${hair}"${stroke}/>`;

  // Eyebrows
  body += `<rect x="${cx - eyeDX - 18}" y="${browY}" width="36" height="7" rx="3.5" fill="${shade(hair, -30)}"/>`;
  body += `<rect x="${cx + eyeDX - 18}" y="${browY}" width="36" height="7" rx="3.5" fill="${shade(hair, -30)}"/>`;

  // Eyes
  const eyeWhite = isNoir ? "#f5f5f7" : "#ffffff";
  for (const dir of [-1, 1]) {
    const ex = cx + dir * eyeDX;
    body += `<ellipse cx="${ex}" cy="${eyeY}" rx="${eyeR}" ry="${eyeR + (chibi ? 8 : 2)}" fill="${eyeWhite}"${outline ? ` stroke="#1c1b29" stroke-width="2"` : ""}/>`;
    body += `<circle cx="${ex + dir * 3}" cy="${eyeY + 3}" r="${eyeR * 0.5}" fill="#241f2e"/>`;
    body += `<circle cx="${ex + dir * 3 + 3}" cy="${eyeY - 1}" r="${eyeR * 0.18}" fill="#fff"/>`;
  }

  // Nose
  body += `<path d="M${cx} ${eyeY + 20} q6 18 -4 24" fill="none" stroke="${shade(skin, -40)}" stroke-width="4" stroke-linecap="round"/>`;

  // Mouth
  const my = eyeY + 62;
  if (happy) {
    body += `<path d="M${cx - 34} ${my} Q${cx} ${my + 34} ${cx + 34} ${my}" fill="none" stroke="${isNoir ? "#111114" : "#b23a5b"}" stroke-width="6" stroke-linecap="round"/>`;
  } else {
    body += `<path d="M${cx - 26} ${my + 8} Q${cx} ${my - 6} ${cx + 26} ${my + 8}" fill="none" stroke="${isNoir ? "#111114" : "#b23a5b"}" stroke-width="6" stroke-linecap="round"/>`;
  }

  // Optional accessory: glasses (mentioned prompts benefit from this)
  if (/glass|specs|nerd/i.test(prompt) || rng.chance(0.25)) {
    const gy = eyeY;
    body += `<g fill="none" stroke="#1c1b29" stroke-width="5">`;
    body += `<circle cx="${cx - eyeDX}" cy="${gy}" r="${eyeR + 8}"/>`;
    body += `<circle cx="${cx + eyeDX}" cy="${gy}" r="${eyeR + 8}"/>`;
    body += `<line x1="${cx - eyeDX + eyeR + 8}" y1="${gy}" x2="${cx + eyeDX - eyeR - 8}" y2="${gy}"/>`;
    body += `</g>`;
  }

  body += `</g>`; // end filtered group

  // Halftone overlay for pop art
  if (style.treatment === "halftone") {
    body += `<rect width="${SIZE}" height="${SIZE}" fill="url(#dots)"/>`;
  }

  const label = esc((prompt || "untitled").slice(0, 42));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" role="img" aria-label="${label}">` +
    defs(style, rng, bgA, bgB) +
    body +
    `</svg>`;

  return svg;
}

// A data-URL wrapper handy for <img> and downloads.
export function renderCartoonDataUrl(opts) {
  return "data:image/svg+xml;utf8," + encodeURIComponent(renderCartoon(opts));
}
