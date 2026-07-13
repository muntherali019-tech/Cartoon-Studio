// Cartoon Studio front-end. Talks to the API and renders everything in the
// browser: when no photoreal image model is wired, the built-in "Toon Render"
// engine draws an appealing cartoon poster to canvas from the design spec, so
// the whole product looks real end-to-end.

const $ = (s) => document.querySelector(s);

let TOKEN = localStorage.getItem("cartoon_token") || "";
const api = (path, body) =>
  fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}) },
    body: JSON.stringify(body),
  }).then((r) => r.json());

let CONFIG = { enabled: false, model: "demo", watermark: true, plans: [] };
let USER = null;

const PALETTES = [
  { primary: "#FF5C7A", secondary: "#5B8CFF", outline: "#141821", paper: "#FFF3E9" },
  { primary: "#36E0A0", secondary: "#FFB23E", outline: "#0E1116", paper: "#EAFBF4" },
  { primary: "#A66BFF", secondary: "#FF8A47", outline: "#141013", paper: "#F3EDFF" },
  { primary: "#FFB23E", secondary: "#4DA6FF", outline: "#1a1205", paper: "#FFF6E8" },
];

// ---------- boot ----------
init();
async function init() {
  try {
    CONFIG = await fetch("/api/config", { headers: TOKEN ? { authorization: `Bearer ${TOKEN}` } : {} }).then((r) => r.json());
    USER = CONFIG.user || null;
  } catch {}
  const pill = $("#statusPill");
  pill.textContent = CONFIG.enabled ? `● AI live · ${CONFIG.model}` : "● demo mode";
  pill.style.color = CONFIG.enabled ? "var(--good)" : "var(--muted)";
  if (!CONFIG.enabled) $("#artHint").textContent = "Demo mode — add ANTHROPIC_API_KEY on the server for live AI, and an image key for photoreal cartoons.";
  renderAccount(); renderFeatures(); renderPlans(); renderPacks(); renderReferral();
  wireTabs(); wireCartoon(); wireComic(); wireCharacter(); wireStickers(); wireToonify(); wireKit(); wireCaptions();
  wireAuth(); wireReferral(); captureReferral();
  if (USER) loadKit();
  drawHero();
  handleReturnFromCheckout();
  initReveal();
}

function captureReferral() {
  const ref = new URLSearchParams(location.search).get("ref");
  if (ref) localStorage.setItem("cartoon_ref", ref);
}

// ---------- tabs ----------
function wireTabs() {
  document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      document.querySelector(`.panel[data-panel="${t.dataset.tab}"]`).classList.add("active");
    });
  });
}

// =====================================================================
//  TOON RENDER ENGINE — draws a cartoon poster from a design spec.
// =====================================================================
function toonRender(canvas, spec, opts = {}) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const pal = spec?.palette || PALETTES[0];
  ctx.clearRect(0, 0, W, H);

  // paper background with a soft vignette
  ctx.fillStyle = pal.paper || "#FFF3E9";
  ctx.fillRect(0, 0, W, H);
  const vg = ctx.createRadialGradient(W / 2, H * 0.42, H * 0.2, W / 2, H / 2, H * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.10)");
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  // halftone dots for a printed-comic feel
  halftone(ctx, W, H, hexA(pal.secondary, 0.12));

  // big friendly "character" blob built from the palette — deterministic per spec
  const seed = hashStr((spec?.imagePrompt || "") + (spec?.caption || opts.label || ""));
  drawBlobCharacter(ctx, W, H, pal, seed);

  // burst behind the label
  const burstY = H * 0.12;
  starburst(ctx, W * 0.5, burstY, W * 0.16, pal.primary, pal.outline);

  // label / caption ribbon
  const label = opts.label || spec?.caption || "";
  if (label) ribbon(ctx, W, H * 0.86, label, pal);

  // frame + watermark
  ctx.strokeStyle = pal.outline; ctx.lineWidth = Math.max(6, W * 0.014);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
  if (CONFIG.watermark && !opts.noMark) {
    ctx.fillStyle = hexA(pal.outline, 0.5);
    ctx.font = `700 ${Math.round(W * 0.03)}px sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText("🎨 Cartoon Studio", W * 0.95, H * 0.965);
  }
  if (spec?.brand?.name) {
    ctx.fillStyle = hexA(pal.outline, 0.65);
    ctx.font = `800 ${Math.round(W * 0.03)}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(spec.brand.name, W * 0.05, H * 0.965);
  }
}

function drawBlobCharacter(ctx, W, H, pal, seed) {
  const rnd = mulberry(seed);
  const cx = W * 0.5, cy = H * 0.5, r = W * 0.24;
  // body
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = pal.primary;
  ctx.strokeStyle = pal.outline;
  ctx.lineWidth = Math.max(6, W * 0.016);
  ctx.beginPath();
  const pts = 14;
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const wobble = 1 + (rnd() - 0.5) * 0.18;
    const x = Math.cos(a) * r * wobble;
    const y = Math.sin(a) * r * wobble * 1.05;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // ears / accessory nubs
  ctx.fillStyle = pal.secondary;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * r * 0.5, -r * 0.85);
    ctx.lineTo(s * r * 0.85, -r * 1.35);
    ctx.lineTo(s * r * 0.15, -r * 1.0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  // cheeks
  ctx.fillStyle = hexA(pal.secondary, 0.55);
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * r * 0.45, r * 0.18, r * 0.16, r * 0.11, 0, 0, 7); ctx.fill(); }

  // eyes
  ctx.fillStyle = pal.outline;
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(s * r * 0.34, -r * 0.12, r * 0.11, r * 0.15, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(s * r * 0.30, -r * 0.18, r * 0.045, 0, 7); ctx.fill();
    ctx.fillStyle = pal.outline;
  }
  // smile
  ctx.strokeStyle = pal.outline; ctx.lineWidth = Math.max(4, W * 0.012);
  ctx.beginPath(); ctx.arc(0, r * 0.02, r * 0.32, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  ctx.restore();
}

function starburst(ctx, x, y, r, fill, stroke) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = 3;
  ctx.beginPath();
  const spikes = 12;
  for (let i = 0; i < spikes * 2; i++) {
    const rr = i % 2 ? r * 0.62 : r;
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.globalAlpha = 0.85; ctx.fill(); ctx.restore();
}

function ribbon(ctx, W, y, text, pal) {
  const h = W * 0.11;
  ctx.fillStyle = pal.outline;
  ctx.fillRect(W * 0.06, y - h / 2 + 5, W * 0.88, h);
  ctx.fillStyle = pal.secondary;
  ctx.fillRect(W * 0.06, y - h / 2, W * 0.88, h);
  ctx.fillStyle = pal.paper || "#fff";
  ctx.font = `800 ${Math.round(fitFont(ctx, text, W * 0.82, W * 0.06))}px "Comic Sans MS", "Baloo", sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, W * 0.5, y);
  ctx.textBaseline = "alphabetic";
}

function halftone(ctx, W, H, color) {
  ctx.save(); ctx.fillStyle = color;
  const step = Math.max(14, W * 0.03);
  for (let y = step; y < H; y += step) for (let x = step; x < W; x += step) {
    ctx.beginPath(); ctx.arc(x, y, step * 0.14, 0, 7); ctx.fill();
  }
  ctx.restore();
}

// ---------- cartoon tool ----------
function wireCartoon() {
  drawPlaceholder($("#artStage"), "Describe a cartoon →");
  $("#artBtn").addEventListener("click", async () => {
    const prompt = $("#artPrompt").value.trim();
    if (!prompt) return toast("Describe your cartoon first ✍️");
    busy($("#artBtn"), true, "Drawing…");
    try {
      const res = await api("/api/cartoon", { prompt, style: $("#artStyle").value });
      if (res.error === "out_of_credits") { syncUser(res.user); location.hash = "#pricing"; return toast("Out of credits — top up or upgrade."); }
      if (res.error) return toast("Couldn't draw that — try again.");
      syncUser(res.user);
      renderImageResult($("#artStage"), res, $("#artCaption"));
      toast("Cartoon drawn 🎨");
    } catch { toast("Draw failed — try again."); }
    finally { busy($("#artBtn"), false, "✨ Draw it"); }
  });
  $("#artDownload").addEventListener("click", () => downloadCanvas($("#artStage"), "cartoon.png"));
}

// Render either a real image (from a wired image model) or the Toon Render spec.
function renderImageResult(canvas, res, capEl) {
  if (res.type === "image" && (res.url || res.b64)) {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => { const ctx = canvas.getContext("2d"); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); };
    img.src = res.url || `data:image/png;base64,${res.b64}`;
  } else {
    toonRender(canvas, res.design);
  }
  if (capEl) capEl.textContent = res.design?.caption || "";
}

// ---------- comic tool ----------
function wireComic() {
  const c = $("#comicCount");
  c.addEventListener("input", () => ($("#comicCountLabel").textContent = c.value));
  $("#comicBtn").addEventListener("click", async () => {
    const idea = $("#comicIdea").value.trim();
    if (!idea) return toast("Give your comic an idea first.");
    if (!USER) return openAuth("signup");
    if (!USER.premium) { toast("Comic Studio is a Creator+ feature."); location.hash = "#pricing"; return; }
    busy($("#comicBtn"), true, "Drawing…");
    try {
      const res = await api("/api/comic", { idea, panels: Number(c.value) });
      if (res.error === "premium_required") { location.hash = "#pricing"; return toast("Upgrade to Creator to make comics."); }
      if (res.error === "out_of_credits") { syncUser(res.user); location.hash = "#pricing"; return toast("Out of credits — top up or upgrade."); }
      if (res.error) return toast("Couldn't draw the comic — try again.");
      syncUser(res.user);
      renderComic(res);
      toast(`Comic drawn 📖 — ${res.panels.length} panels.`);
    } catch { toast("Comic failed — try again."); }
    finally { busy($("#comicBtn"), false, "📖 Draw the strip"); }
  });
}

function renderComic(c) {
  const el = $("#comicOut");
  el.innerHTML = `<div class="comic-head"><div class="comic-title">${esc(c.title || "Your comic")}</div><div class="muted">${esc(c.style || "")}</div></div>
    <div class="comic-grid" id="comicGrid"></div>
    <div class="muted comic-share">${esc(c.shareCaption || "")}</div>`;
  const grid = $("#comicGrid");
  (c.panels || []).forEach((p) => {
    const wrap = document.createElement("div");
    wrap.className = "comic-panel";
    const cv = document.createElement("canvas"); cv.width = 360; cv.height = 360;
    toonRender(cv, { imagePrompt: p.imagePrompt, palette: c.palette, brand: c.brand }, { label: `${p.panel}`, noMark: true });
    // dialogue bubbles
    drawBubbles(cv, p.dialogue || [], c.palette);
    wrap.appendChild(cv);
    const cap = document.createElement("div"); cap.className = "comic-cap";
    cap.innerHTML = `<b>${esc(p.caption || "")}</b> ${esc(p.action || "")}`;
    wrap.appendChild(cap);
    grid.appendChild(wrap);
  });
}

function drawBubbles(canvas, dialogue, pal) {
  if (!dialogue.length) return;
  const ctx = canvas.getContext("2d"), W = canvas.width;
  let y = W * 0.1;
  dialogue.slice(0, 2).forEach((d) => {
    const text = `${d.speaker ? d.speaker + ": " : ""}${d.line}`;
    ctx.font = `600 ${Math.round(W * 0.05)}px "Comic Sans MS", sans-serif`;
    const tw = Math.min(W * 0.8, ctx.measureText(text).width + 24);
    ctx.fillStyle = "#fff"; ctx.strokeStyle = (pal?.outline) || "#141821"; ctx.lineWidth = 3;
    roundRect(ctx, W * 0.1, y, tw, W * 0.11, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = (pal?.outline) || "#141821"; ctx.textBaseline = "middle";
    ctx.fillText(text, W * 0.1 + 12, y + W * 0.056, tw - 20);
    ctx.textBaseline = "alphabetic";
    y += W * 0.15;
  });
}

// ---------- character tool ----------
function wireCharacter() {
  drawPlaceholder($("#charStage"), "Describe a character →");
  $("#charBtn").addEventListener("click", async () => {
    const description = $("#charDesc").value.trim();
    if (!description) return toast("Describe your character first.");
    busy($("#charBtn"), true, "Designing…");
    try {
      const res = await api("/api/character", { description });
      if (res.error === "out_of_credits") { syncUser(res.user); location.hash = "#pricing"; return toast("Out of credits — top up or upgrade."); }
      if (res.error) return toast("Design failed — try again.");
      syncUser(res.user);
      toonRender($("#charStage"), { imagePrompt: res.imagePrompt, palette: res.palette, caption: res.name });
      $("#charSheet").innerHTML = `<div class="char-name">${esc(res.name || "")}</div>
        <div class="muted">${esc(res.personality || "")}</div>
        <div class="char-look">${esc(res.look || "")}</div>
        <span class="chip">${esc(res.style || "")}</span>`;
      toast("Character designed 🦸");
    } catch { toast("Design failed — try again."); }
    finally { busy($("#charBtn"), false, "🦸 Design character"); }
  });
}

// ---------- stickers tool ----------
function wireStickers() {
  const c = $("#stickCount");
  c.addEventListener("input", () => ($("#stickCountLabel").textContent = c.value));
  $("#stickBtn").addEventListener("click", async () => {
    const character = $("#stickChar").value.trim();
    if (!character) return toast("Name a character first.");
    if (!USER) return openAuth("signup");
    if (!USER.premium) { toast("Sticker packs are a Creator+ feature."); location.hash = "#pricing"; return; }
    busy($("#stickBtn"), true, "Making…");
    try {
      const res = await api("/api/stickers", { character, count: Number(c.value) });
      if (res.error === "premium_required") { location.hash = "#pricing"; return toast("Upgrade to Creator for sticker packs."); }
      if (res.error === "out_of_credits") { syncUser(res.user); location.hash = "#pricing"; return toast("Out of credits — top up or upgrade."); }
      if (res.error) return toast("Couldn't make the pack — try again.");
      syncUser(res.user);
      renderStickers(res);
      toast(`Sticker pack minted 🧩 — ${res.stickers.length} stickers.`);
    } catch { toast("Sticker pack failed — try again."); }
    finally { busy($("#stickBtn"), false, "🧩 Make pack"); }
  });
}

function renderStickers(res) {
  const el = $("#stickOut"); el.innerHTML = "";
  (res.stickers || []).forEach((s) => {
    const wrap = document.createElement("div"); wrap.className = "sticker";
    const cv = document.createElement("canvas"); cv.width = 240; cv.height = 240;
    toonRender(cv, { imagePrompt: s.imagePrompt, palette: res.palette, brand: res.brand }, { label: s.label, noMark: true });
    wrap.appendChild(cv);
    el.appendChild(wrap);
  });
}

// ---------- toonify tool ----------
function wireToonify() {
  drawPlaceholder($("#toonStage"), "Drop a photo →");
  $("#toonBtn").addEventListener("click", async () => {
    const file = $("#toonFile").files[0];
    if (!file) return toast("Choose a photo to toonify.");
    busy($("#toonBtn"), true, "Toonifying…");
    try {
      const base64 = await fileToBase64(file);
      const res = await api("/api/toonify", { base64, mediaType: file.type || "image/png", style: $("#toonStyle").value });
      if (res.error === "out_of_credits") { syncUser(res.user); location.hash = "#pricing"; return toast("Out of credits — top up or upgrade."); }
      if (res.error) return toast("Toonify failed — try a clearer photo.");
      syncUser(res.user);
      renderImageResult($("#toonStage"), res, $("#toonCaption"));
      toast("Toonified 📷✨");
    } catch { toast("Toonify failed — try again."); }
    finally { busy($("#toonBtn"), false, "📷 Toonify"); }
  });
  $("#toonDownload").addEventListener("click", () => downloadCanvas($("#toonStage"), "toonified.png"));
}

// ---------- character kit ----------
function wireKit() {
  ["kitName","kitStyle","kitPrimary","kitSecondary","kitOutline","kitTraits"].forEach((id) => $("#"+id)?.addEventListener("input", drawKitPreview));
  drawKitPreview();
  $("#kitSave").addEventListener("click", async () => {
    if (!USER) return openAuth("signup");
    if (!USER.premium) { toast("Character Kit is a Creator+ feature."); location.hash = "#pricing"; return; }
    busy($("#kitSave"), true, "Saving…");
    try {
      const res = await api("/api/characterkit", {
        name: $("#kitName").value, style: $("#kitStyle").value,
        primary: $("#kitPrimary").value, secondary: $("#kitSecondary").value, outline: $("#kitOutline").value,
        traits: $("#kitTraits").value,
      });
      if (res.error) { $("#kitHint").textContent = res.error; return; }
      if (res.user) syncUser(res.user);
      $("#kitHint").textContent = "Saved — new cartoons, comics and stickers now use your character.";
      toast("Character kit saved 🎭");
    } catch { toast("Save failed."); }
    finally { busy($("#kitSave"), false, "💾 Save character kit"); }
  });
}
function loadKit() {
  const k = USER?.characterKit; if (!k) return;
  const set = (id, v) => { const el = $("#"+id); if (el && v) el.value = v; };
  set("kitName", k.name); set("kitStyle", k.style); set("kitPrimary", k.primary);
  set("kitSecondary", k.secondary); set("kitOutline", k.outline); set("kitTraits", k.traits);
  drawKitPreview();
}
function drawKitPreview() {
  const pal = { primary: $("#kitPrimary")?.value || "#FF5C7A", secondary: $("#kitSecondary")?.value || "#5B8CFF", outline: $("#kitOutline")?.value || "#141821", paper: "#FFF3E9" };
  toonRender($("#kitStage"), { palette: pal, caption: $("#kitName")?.value || "Your character", brand: { name: $("#kitName")?.value || "" } }, { noMark: true });
}

// ---------- captions ----------
function wireCaptions() {
  $("#capBtn").addEventListener("click", async () => {
    const topic = $("#capTopic").value.trim();
    if (!topic) return toast("Type a topic first.");
    busy($("#capBtn"), true, "Writing…");
    try {
      const res = await api("/api/captions", { topic, count: 6 });
      $("#capOut").textContent = res.text || res.error || "No result.";
    } catch { toast("Captions failed."); }
    finally { busy($("#capBtn"), false, "💬 Write captions"); }
  });
}

// ---------- features + pricing ----------
function renderFeatures() {
  const feats = [
    ["🎨", "Prompt → cartoon", "Describe anything and get a finished, framed cartoon with a caption — in seconds."],
    ["📖", "Comic Strip Studio", "One idea becomes a multi-panel comic with a real setup, build and punchline, lettered with dialogue."],
    ["🦸", "Character designer", "Turn a sentence into a memorable, reusable character with a full look sheet."],
    ["🧩", "Sticker packs", "Spin any character into a matching set of expression stickers, ready to share."],
    ["📷", "Photo → cartoon", "Drop a selfie and get a cartoon that still looks like you — real vision AI."],
    ["🎭", "Character Kit", "Lock your colours, style and character once — everything you make stays on-model."],
    ["💬", "Caption & meme writer", "Never post a blank cartoon — get scroll-stopping captions on tap."],
    ["⬇", "Export & sell", "Download crisp PNGs; Studio unlocks a commercial licence and merch-ready export."],
  ];
  $("#featureGrid").innerHTML = feats.map(([ico, h, p]) => `<div class="feature"><div class="ico">${ico}</div><h3>${h}</h3><p>${p}</p></div>`).join("");
}

function renderPlans() {
  const plans = CONFIG.plans || [];
  $("#plans").innerHTML = plans.map((p) => `<div class="plan ${p.popular ? "popular" : ""}">
      ${p.popular ? '<span class="badge">Most popular</span>' : ""}
      <h3>${esc(p.name)}</h3>
      <div class="price">${esc(p.price)} <small>${esc(p.period)}</small></div>
      <div class="credits">${esc(p.credits)}</div>
      <ul>${p.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
      <button class="btn ${p.popular ? "btn-primary" : "btn-ghost"}" onclick="cartoonCheckout('${p.id}')">${esc(p.cta)}</button>
    </div>`).join("");
}
window.cartoonCheckout = async (id) => {
  if (id === "free") return USER ? toast("You're set — start drawing 🎉") : openAuth("signup");
  if (!USER) return openAuth("signup");
  if (!CONFIG.stripe) return toast("Billing isn't configured on this server yet (set STRIPE keys).");
  try { const res = await api("/api/billing/checkout", { plan: id }); res.url ? (window.location.href = res.url) : toast(res.error || "Couldn't start checkout."); }
  catch { toast("Checkout failed."); }
};

// ---------- credit packs ----------
function renderPacks() {
  const packs = CONFIG.creditPacks || [];
  const wrap = $("#packsWrap");
  if (!packs.length) return (wrap.hidden = true);
  wrap.hidden = false;
  $("#packs").innerHTML = packs.map((p) => `<div class="pack ${p.best ? "best" : ""}">
      ${p.best ? '<span class="badge">Best value</span>' : ""}
      <div class="pack-credits">${esc(p.credits)}</div><div class="muted">credits</div>
      <div class="pack-price">${esc(p.price)}</div>
      <button class="btn ${p.best ? "btn-primary" : "btn-ghost"} btn-block" onclick="cartoonBuyPack('${p.id}')">Buy pack</button>
    </div>`).join("");
}
window.cartoonBuyPack = async (id) => {
  if (!USER) return openAuth("signup");
  if (!CONFIG.creditPacksEnabled) return toast("Credit packs aren't configured on this server yet.");
  try { const res = await api("/api/billing/credits", { pack: id }); res.url ? (window.location.href = res.url) : toast(res.error || "Couldn't start checkout."); }
  catch { toast("Checkout failed."); }
};

// ---------- referral ----------
function renderReferral() {
  const card = $("#referralCard");
  if (!USER || !USER.referralCode) return (card.hidden = true);
  card.hidden = false;
  $("#referralLink").value = `${location.origin}/?ref=${USER.referralCode}`;
}
function wireReferral() {
  $("#referralCopy")?.addEventListener("click", () => {
    const el = $("#referralLink"); el.select();
    navigator.clipboard?.writeText(el.value).then(() => toast("Referral link copied 🔗"), () => toast("Copy failed — select and copy manually."));
  });
}

function syncUser(user) { if (!user) return; USER = user; renderAccount(); renderReferral(); }

// ---------- accounts ----------
function renderAccount() {
  const btn = $("#accountBtn");
  if (USER) {
    const c = USER.creditsLeft === "unlimited" ? "∞" : USER.creditsLeft;
    btn.textContent = `${USER.plan.toUpperCase()} · ${c} left`;
    btn.title = `${USER.email} — click to sign out`;
  } else { btn.textContent = "Sign in"; btn.title = "Sign in or create an account"; }
}

let authMode = "login";
function wireAuth() {
  $("#accountBtn").addEventListener("click", () => (USER ? logout() : openAuth("login")));
  $("#authClose").addEventListener("click", closeAuth);
  $("#authModal").addEventListener("click", (e) => e.target.id === "authModal" && closeAuth());
  $("#authSwitch").addEventListener("click", (e) => { e.preventDefault(); openAuth(authMode === "login" ? "signup" : "login"); });
  $("#authSubmit").addEventListener("click", doAuth);
  $("#authPass").addEventListener("keydown", (e) => e.key === "Enter" && doAuth());
}
function openAuth(mode) {
  authMode = mode;
  $("#authTitle").textContent = mode === "login" ? "Sign in to Cartoon Studio" : "Create your account";
  $("#authSubmit").textContent = mode === "login" ? "Sign in" : "Create account";
  $("#authSwitchText").textContent = mode === "login" ? "New here?" : "Already have an account?";
  $("#authSwitch").textContent = mode === "login" ? "Create an account" : "Sign in";
  $("#authError").textContent = "";
  $("#authModal").hidden = false; $("#authEmail").focus();
}
function closeAuth() { $("#authModal").hidden = true; }

async function doAuth() {
  const email = $("#authEmail").value.trim();
  const password = $("#authPass").value;
  if (!email || !password) return ($("#authError").textContent = "Enter email and password.");
  busy($("#authSubmit"), true, "…");
  try {
    const ref = authMode === "signup" ? localStorage.getItem("cartoon_ref") || undefined : undefined;
    const res = await api(`/api/auth/${authMode}`, { email, password, ref });
    if (res.error) { $("#authError").textContent = res.error; return; }
    TOKEN = res.token; localStorage.setItem("cartoon_token", TOKEN);
    if (ref) localStorage.removeItem("cartoon_ref");
    USER = res.user; renderAccount(); renderReferral(); loadKit(); closeAuth();
    const bonus = USER.bonusCredits ? ` — +${USER.bonusCredits} bonus credits!` : "";
    toast(`Welcome${authMode === "signup" ? "" : " back"}, ${USER.email.split("@")[0]} 👋${bonus}`);
  } catch { $("#authError").textContent = "Something went wrong."; }
  finally { busy($("#authSubmit"), false, authMode === "login" ? "Sign in" : "Create account"); }
}
function logout() { TOKEN = ""; USER = null; localStorage.removeItem("cartoon_token"); renderAccount(); renderReferral(); toast("Signed out."); }

async function refreshMe() {
  if (!TOKEN) return;
  try { const res = await fetch("/api/me", { headers: { authorization: `Bearer ${TOKEN}` } }).then((r) => r.json()); syncUser(res.user); loadKit(); } catch {}
}
function handleReturnFromCheckout() {
  const q = new URLSearchParams(location.search);
  if (q.get("upgraded")) { refreshMe(); toast(`Upgraded to ${q.get("upgraded").toUpperCase()} 🎉`); history.replaceState({}, "", location.pathname + "#pricing"); }
  else if (q.get("credits")) { refreshMe(); toast(`Added ${q.get("credits")} credits 🎉`); history.replaceState({}, "", location.pathname + "#pricing"); }
  else if (q.get("canceled")) { toast("Checkout canceled."); history.replaceState({}, "", location.pathname); }
}

// ---------- hero ----------
function drawHero() {
  const cv = $("#heroCanvas"); if (!cv) return;
  let i = 0;
  const spin = () => {
    const pal = PALETTES[i % PALETTES.length];
    toonRender(cv, { palette: pal, caption: ["Draw anything", "Make a comic", "Mint stickers", "Toonify a photo"][i % 4] }, { noMark: true });
    i++;
  };
  spin();
  setInterval(spin, 2200);
}

// ---------- reveal-on-scroll ----------
function initReveal() {
  const targets = document.querySelectorAll(".feature, .plan, .pack, .features h2, .pricing h2");
  if (!("IntersectionObserver" in window)) { targets.forEach((t) => t.classList.add("in")); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))), { threshold: 0.12 });
  targets.forEach((t) => { t.classList.add("reveal"); io.observe(t); });
}

// ---------- utils ----------
function drawPlaceholder(canvas, text) {
  const ctx = canvas.getContext("2d"), W = canvas.width, H = canvas.height;
  ctx.fillStyle = "#FFF3E9"; ctx.fillRect(0, 0, W, H);
  halftone(ctx, W, H, "rgba(91,140,255,0.10)");
  ctx.fillStyle = "#9a8b7a"; ctx.font = `700 ${Math.round(W * 0.05)}px sans-serif`; ctx.textAlign = "center";
  ctx.fillText(text, W / 2, H / 2);
  ctx.strokeStyle = "#141821"; ctx.lineWidth = 8; ctx.strokeRect(4, 4, W - 8, H - 8);
}
function fitFont(ctx, text, maxW, start) {
  let size = start;
  do { ctx.font = `800 ${size}px sans-serif`; if (ctx.measureText(text).width <= maxW) break; size -= 2; } while (size > 10);
  return size;
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function hexA(hex, a) { const { r, g, b } = hexRGB(hex); return `rgba(${r},${g},${b},${a})`; }
function hexRGB(hex) { let h = (hex || "#000").replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); return { r: parseInt(h.slice(0, 2), 16) || 0, g: parseInt(h.slice(2, 4), 16) || 0, b: parseInt(h.slice(4, 6), 16) || 0 }; }
function hashStr(s) { let h = 0; for (let i = 0; i < String(s).length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
function mulberry(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function esc(s) { return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function fileToBase64(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(file); }); }
function downloadCanvas(canvas, name) { canvas.toBlob((b) => { const url = URL.createObjectURL(b); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); }); }
function busy(btn, on, label) { btn.disabled = on; if (label) btn.textContent = label; }
let toastTimer;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 3200); }
