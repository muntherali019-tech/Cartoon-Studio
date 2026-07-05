import React, { useState, useRef } from "react";
import {
  Sparkles, Film, Image as ImageIcon, Wand2, Copy, Download,
  Loader2, Clapperboard, ScrollText, Camera, Check, X, RotateCcw
} from "lucide-react";

// ---------- Claude API (via the local /api proxy that holds the key) ----------
async function callClaude(messages, system) {
  const res = await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, messages }),
  });
  if (!res.ok) throw new Error("The studio AI didn't respond. Try running that step again.");
  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  if (!text) throw new Error("The studio AI came back empty. Run that step again.");
  return text;
}

function extractJSON(text) {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const firstObj = cleaned.indexOf("{");
  const firstArr = cleaned.indexOf("[");
  let start = -1;
  if (firstObj === -1) start = firstArr;
  else if (firstArr === -1) start = firstObj;
  else start = Math.min(firstObj, firstArr);
  if (start === -1) throw new Error("Couldn't read the studio output. Run that step again.");
  const openChar = cleaned[start];
  const closeChar = openChar === "{" ? "}" : "]";
  const end = cleaned.lastIndexOf(closeChar);
  return JSON.parse(cleaned.slice(start, end + 1));
}

// Downscale an uploaded photo in the browser before it's sent to the model.
// Keeps the long edge at MAX_EDGE and re-encodes as JPEG so the base64 payload
// stays small (Anthropic's vision API works best under ~5MB per image).
const MAX_EDGE = 1568;
function downscaleImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that photo. Try another."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Couldn't read that photo. Try another."));
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const url = canvas.toDataURL("image/jpeg", 0.9);
        resolve({ data: url.split(",")[1], url, type: "image/jpeg" });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

// ---------- presets ----------
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

// ---------- shared styling helpers (inline so we don't rely on arbitrary Tailwind) ----------
const INK = "#181818";
const PAPER = "#FAF6EF";
const PINK = "#FF3D81";
const CYAN = "#22B0E0";
const SUN = "#FFC93C";
const MINT = "#36C9A0";

const panel = {
  border: `3px solid ${INK}`,
  borderRadius: 18,
  boxShadow: `6px 6px 0 ${INK}`,
  background: "#fff",
};
const chip = (active, color) => ({
  border: `2px solid ${INK}`,
  borderRadius: 999,
  padding: "6px 14px",
  fontWeight: 700,
  cursor: "pointer",
  background: active ? color : "#fff",
  color: INK,
  boxShadow: active ? `2px 2px 0 ${INK}` : "none",
  transition: "all .12s",
});

function Stage({ n, color, icon, title, children }) {
  return (
    <section style={{ ...panel, padding: 0, overflow: "hidden", marginBottom: 26 }}>
      <header
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px", borderBottom: `3px solid ${INK}`, background: color,
        }}
      >
        <span
          style={{
            display: "grid", placeItems: "center", width: 34, height: 34,
            borderRadius: 10, border: `3px solid ${INK}`, background: "#fff",
            fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 18,
          }}
        >
          {n}
        </span>
        {icon}
        <h2 style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 20, margin: 0 }}>
          {title}
        </h2>
      </header>
      <div style={{ padding: 18 }}>{children}</div>
    </section>
  );
}

function PromptBox({ label, text, onCopy }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</span>
        <button onClick={onCopy} style={{ ...chip(false, "#fff"), padding: "3px 10px", fontSize: 12, display: "flex", gap: 5, alignItems: "center" }}>
          <Copy size={13} /> Copy
        </button>
      </div>
      <pre
        style={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12.5, lineHeight: 1.5,
          background: "#FFF7E9", border: `2px solid ${INK}`, borderRadius: 10, padding: 12,
          whiteSpace: "pre-wrap", margin: 0,
        }}
      >
        {text}
      </pre>
    </div>
  );
}

export default function CartoonStudio() {
  const [idea, setIdea] = useState("");
  const [format, setFormat] = useState(FORMATS[0]);
  const [tone, setTone] = useState(TONES[0]);
  const [style, setStyle] = useState(STYLES[0]);
  const [sceneCount, setSceneCount] = useState(4);

  const [script, setScript] = useState(null);
  const [board, setBoard] = useState([]); // storyboard panels
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  // photo -> cartoon
  const [photo, setPhoto] = useState(null);
  const [photoStyle, setPhotoStyle] = useState(STYLES[0]);
  const [photoPrompt, setPhotoPrompt] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef(null);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 1600); };
  const copy = async (t) => {
    try { await navigator.clipboard.writeText(t); flash("Copied"); }
    catch { flash("Press and hold to copy"); }
  };

  async function genScript() {
    const sys =
      "You are a cartoon scriptwriter for short faceless videos. Reply with ONLY raw JSON, no prose, no markdown fences. Keep it tight.";
    const user =
      `Write a ${format} in a ${tone} tone from this idea: "${idea}". ` +
      `Use exactly ${sceneCount} scenes. JSON shape: ` +
      `{"title":string,"logline":string (1 sentence),` +
      `"characters":[{"name":string,"look":string (8-15 word visual descriptor for consistent art)}],` +
      `"scenes":[{"n":number,"setting":string,"action":string (1-2 sentences),"line":string (the narration or key spoken line)}]}`;
    const raw = await callClaude([{ role: "user", content: user }], sys);
    return extractJSON(raw);
  }

  async function genPanel(sc, chars) {
    const sys =
      "You are a storyboard artist and AI-image prompt engineer. Reply with ONLY raw JSON, no fences.";
    const charLook = chars.map((c) => `${c.name}: ${c.look}`).join("; ");
    const user =
      `Art style: ${style}. Keep characters consistent using these looks -> ${charLook}. ` +
      `Scene ${sc.n} setting: ${sc.setting}. Action: ${sc.action}. ` +
      `JSON shape: {"visual":string (what the frame shows, 1 sentence),` +
      `"imagePrompt":string (a detailed ready-to-paste image-gen prompt: include the art style, the character look, setting, lighting, framing),` +
      `"shot":string (camera/shot e.g. 'wide establishing','close-up'),` +
      `"narration":string (the voiceover line for this scene)}`;
    const raw = await callClaude([{ role: "user", content: user }], sys);
    return { n: sc.n, ...extractJSON(raw) };
  }

  async function runPipeline() {
    if (!idea.trim()) { setError("Give the studio an idea first — even one line works."); return; }
    setBusy(true); setError(""); setScript(null); setBoard([]);
    try {
      setStatus("Writing the script…");
      const sc = await genScript();
      setScript(sc);
      const panels = [];
      for (let i = 0; i < sc.scenes.length; i++) {
        setStatus(`Drawing storyboard — scene ${i + 1} of ${sc.scenes.length}…`);
        // eslint-disable-next-line no-await-in-loop
        panels.push(await genPanel(sc.scenes[i], sc.characters || []));
        setBoard([...panels]);
      }
      setStatus("");
    } catch (e) {
      setError(e.message || "Something jammed in the studio. Try again.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  async function onPhoto(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError("");
    try {
      setPhoto(await downscaleImage(f));
    } catch (err) {
      setError(err.message || "Couldn't read that photo. Try another.");
    }
  }

  async function cartoonify() {
    if (!photo) return;
    setPhotoBusy(true); setError(""); setPhotoPrompt("");
    try {
      const sys =
        "You look at a photo and write ONE detailed image-generation prompt to recreate the subject as a cartoon. Reply with ONLY the prompt text, no preamble, no quotes.";
      const raw = await callClaude(
        [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: photo.type || "image/jpeg", data: photo.data } },
            { type: "text", text: `Recreate this as a cartoon in "${photoStyle}" style. Keep the subject recognisable. Describe face/clothing/pose/colours so an image model can render it.` },
          ],
        }],
        sys
      );
      setPhotoPrompt(raw.trim());
    } catch (e) {
      setError(e.message || "Couldn't read that photo. Try another.");
    } finally {
      setPhotoBusy(false);
    }
  }

  function buildPack() {
    if (!script) return "";
    const lines = [];
    lines.push(`# ${script.title}\n`);
    lines.push(`**Logline:** ${script.logline}\n`);
    lines.push(`**Format:** ${format}  |  **Tone:** ${tone}  |  **Art style:** ${style}\n`);
    lines.push(`\n## Character style guide`);
    (script.characters || []).forEach((c) => lines.push(`- **${c.name}** — ${c.look}`));
    lines.push(`\n## Voiceover script`);
    (script.scenes || []).forEach((s) => lines.push(`${s.n}. ${s.line}`));
    lines.push(`\n## Storyboard + image prompts`);
    board.forEach((p) => {
      lines.push(`\n### Scene ${p.n} — ${p.shot}`);
      lines.push(`*${p.visual}*`);
      lines.push(`\n**Image prompt:**\n${p.imagePrompt}`);
      lines.push(`\n**VO:** ${p.narration}`);
    });
    return lines.join("\n");
  }

  function downloadPack() {
    const blob = new Blob([buildPack()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(script?.title || "production-pack").replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setScript(null); setBoard([]); setError(""); setStatus("");
  }

  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK, fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box} textarea,select,button{font-family:inherit}
        textarea:focus,select:focus{outline:3px solid ${CYAN};outline-offset:1px}
        button:focus-visible{outline:3px solid ${CYAN};outline-offset:2px}
        @media (prefers-reduced-motion: reduce){*{transition:none!important}}
      `}</style>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 18px 80px" }}>
        {/* HERO */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ display: "grid", placeItems: "center", width: 46, height: 46, borderRadius: 13, border: `3px solid ${INK}`, background: SUN, boxShadow: `4px 4px 0 ${INK}` }}>
            <Clapperboard size={26} />
          </div>
          <h1 style={{ fontFamily: "'Baloo 2', system-ui", fontWeight: 800, fontSize: 34, margin: 0, lineHeight: 1 }}>
            Cartoon Studio
          </h1>
        </div>
        <p style={{ margin: "6px 0 22px", fontSize: 15.5, maxWidth: 560 }}>
          Turn one idea into a cartoon script, a scene-by-scene storyboard, and ready-to-paste image prompts.
          Render the images in your own tool — the studio does everything up to that point.
        </p>

        {/* STAGE 1 — IDEA */}
        <Stage n={1} color={SUN} icon={<Sparkles size={20} />} title="The idea">
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="e.g. A shy little robot learns to make its first friend at recess"
            rows={2}
            style={{ width: "100%", border: `2px solid ${INK}`, borderRadius: 10, padding: 12, fontSize: 15, resize: "vertical" }}
          />
          <div style={{ marginTop: 14 }}>
            <Label>Format</Label>
            <Row>{FORMATS.map((f) => <button key={f} style={chip(format === f, CYAN)} onClick={() => setFormat(f)}>{f}</button>)}</Row>
          </div>
          <div style={{ marginTop: 12 }}>
            <Label>Tone</Label>
            <Row>{TONES.map((t) => <button key={t} style={chip(tone === t, PINK)} onClick={() => setTone(t)}>{t}</button>)}</Row>
          </div>
          <div style={{ marginTop: 12 }}>
            <Label>Art style (keeps every scene consistent)</Label>
            <Row>{STYLES.map((s) => <button key={s} style={chip(style === s, MINT)} onClick={() => setStyle(s)}>{s}</button>)}</Row>
          </div>
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <Label inline>Scenes</Label>
            {[3, 4, 5].map((n) => <button key={n} style={chip(sceneCount === n, SUN)} onClick={() => setSceneCount(n)}>{n}</button>)}
          </div>

          <button
            onClick={runPipeline}
            disabled={busy}
            style={{
              marginTop: 18, width: "100%", border: `3px solid ${INK}`, borderRadius: 13,
              background: busy ? "#ddd" : PINK, color: busy ? INK : "#fff", fontFamily: "'Baloo 2', system-ui",
              fontWeight: 800, fontSize: 18, padding: "13px", cursor: busy ? "default" : "pointer",
              boxShadow: busy ? "none" : `5px 5px 0 ${INK}`, display: "flex", gap: 10, alignItems: "center", justifyContent: "center",
            }}
          >
            {busy ? <Loader2 size={20} className="spin" style={{ animation: "spin 1s linear infinite" }} /> : <Wand2 size={20} />}
            {busy ? (status || "Working…") : "Make the production pack"}
          </button>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

          {error && (
            <div style={{ marginTop: 14, border: `2px solid ${INK}`, background: "#FFE0E0", borderRadius: 10, padding: "10px 12px", display: "flex", gap: 8, alignItems: "center" }}>
              <X size={16} /> <span style={{ fontWeight: 600, fontSize: 14 }}>{error}</span>
            </div>
          )}
        </Stage>

        {/* STAGE 2 — SCRIPT */}
        <Stage n={2} color={CYAN} icon={<ScrollText size={20} />} title="The script">
          {!script ? (
            <Empty>Run the studio and your {format.toLowerCase()} appears here — title, characters, and scene beats.</Empty>
          ) : (
            <>
              <h3 style={{ fontFamily: "'Baloo 2', system-ui", fontSize: 22, margin: "0 0 2px" }}>{script.title}</h3>
              <p style={{ fontStyle: "italic", margin: "0 0 14px" }}>{script.logline}</p>
              <Label>Cast</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {(script.characters || []).map((c, i) => (
                  <span key={i} style={{ border: `2px solid ${INK}`, borderRadius: 10, padding: "6px 10px", fontSize: 13, background: "#FFF7E9" }}>
                    <b>{c.name}</b> — {c.look}
                  </span>
                ))}
              </div>
              <Label>Scenes</Label>
              {(script.scenes || []).map((s) => (
                <div key={s.n} style={{ borderLeft: `4px solid ${PINK}`, paddingLeft: 12, margin: "10px 0" }}>
                  <b>Scene {s.n}</b> · <span style={{ opacity: 0.7 }}>{s.setting}</span>
                  <div style={{ fontSize: 14, marginTop: 2 }}>{s.action}</div>
                  <div style={{ fontSize: 14, marginTop: 4 }}>🎙️ {s.line}</div>
                </div>
              ))}
            </>
          )}
        </Stage>

        {/* STAGE 3 — STORYBOARD */}
        <Stage n={3} color={MINT} icon={<Film size={20} />} title="Storyboard + image prompts">
          {board.length === 0 ? (
            <Empty>Each scene becomes a frame with a camera note and a copy-paste prompt for your image tool.</Empty>
          ) : (
            board.map((p) => (
              <div key={p.n} style={{ border: `2px solid ${INK}`, borderRadius: 12, padding: 14, marginBottom: 14, background: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Baloo 2',system-ui", fontWeight: 800 }}>Scene {p.n}</span>
                  <span style={{ border: `2px solid ${INK}`, borderRadius: 999, padding: "1px 9px", fontSize: 12, background: SUN, fontWeight: 700 }}>{p.shot}</span>
                </div>
                <div style={{ fontSize: 14, marginBottom: 2 }}>{p.visual}</div>
                <PromptBox label="Image prompt" text={p.imagePrompt} onCopy={() => copy(p.imagePrompt)} />
                <div style={{ fontSize: 14, marginTop: 8 }}>🎙️ {p.narration}</div>
              </div>
            ))
          )}

          {script && board.length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
              <button onClick={() => copy(buildPack())} style={{ ...chip(false, SUN), padding: "10px 16px", display: "flex", gap: 7, alignItems: "center", fontFamily: "'Baloo 2',system-ui", fontSize: 15 }}>
                <Copy size={16} /> Copy whole pack
              </button>
              <button onClick={downloadPack} style={{ ...chip(false, CYAN), padding: "10px 16px", display: "flex", gap: 7, alignItems: "center", fontFamily: "'Baloo 2',system-ui", fontSize: 15 }}>
                <Download size={16} /> Download .md
              </button>
              <button onClick={reset} style={{ ...chip(false, "#fff"), padding: "10px 16px", display: "flex", gap: 7, alignItems: "center" }}>
                <RotateCcw size={16} /> Clear
              </button>
            </div>
          )}
        </Stage>

        {/* STAGE 4 — PHOTO TO CARTOON */}
        <Stage n={4} color={PINK} icon={<Camera size={20} />} title="Photo → cartoon (bonus tool)">
          <p style={{ fontSize: 14, marginTop: 0 }}>
            Upload a photo. The studio writes a precise cartoon prompt you can paste into your image tool to redraw it.
          </p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div>
              <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} style={{ display: "none" }} />
              <button onClick={() => fileRef.current?.click()} style={{ ...chip(false, "#fff"), padding: "10px 16px", display: "flex", gap: 7, alignItems: "center" }}>
                <ImageIcon size={16} /> {photo ? "Change photo" : "Choose photo"}
              </button>
              {photo && (
                <img src={photo.url} alt="upload" style={{ display: "block", marginTop: 10, width: 130, height: 130, objectFit: "cover", border: `3px solid ${INK}`, borderRadius: 12 }} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <Label>Cartoon style</Label>
              <Row>{STYLES.map((s) => <button key={s} style={chip(photoStyle === s, MINT)} onClick={() => setPhotoStyle(s)}>{s}</button>)}</Row>
              <button
                onClick={cartoonify}
                disabled={!photo || photoBusy}
                style={{
                  marginTop: 12, border: `3px solid ${INK}`, borderRadius: 12, background: !photo || photoBusy ? "#ddd" : PINK,
                  color: !photo || photoBusy ? INK : "#fff", fontFamily: "'Baloo 2',system-ui", fontWeight: 800, fontSize: 15,
                  padding: "10px 18px", cursor: !photo || photoBusy ? "default" : "pointer",
                  boxShadow: !photo || photoBusy ? "none" : `4px 4px 0 ${INK}`, display: "flex", gap: 8, alignItems: "center",
                }}
              >
                {photoBusy ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Wand2 size={16} />}
                {photoBusy ? "Reading photo…" : "Write cartoon prompt"}
              </button>
            </div>
          </div>
          {photoPrompt && <PromptBox label="Cartoon prompt — paste into your image tool" text={photoPrompt} onCopy={() => copy(photoPrompt)} />}
        </Stage>

        <p style={{ fontSize: 12.5, opacity: 0.65, textAlign: "center", marginTop: 8 }}>
          Demo build. Wire the image prompts into a real render API (fal.ai, Replicate, an SDXL endpoint) in your stack to finish the pipeline.
        </p>
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: INK, color: "#fff", padding: "9px 18px", borderRadius: 999, fontWeight: 700, display: "flex", gap: 7, alignItems: "center", boxShadow: `3px 3px 0 ${PINK}` }}>
          <Check size={15} /> {toast}
        </div>
      )}
    </div>
  );
}

function Label({ children, inline }) {
  return <div style={{ fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: inline ? 0 : 6, marginRight: inline ? 4 : 0 }}>{children}</div>;
}
function Row({ children }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{children}</div>;
}
function Empty({ children }) {
  return <div style={{ border: `2px dashed ${INK}`, borderRadius: 12, padding: 16, fontSize: 14, opacity: 0.7, textAlign: "center" }}>{children}</div>;
}
