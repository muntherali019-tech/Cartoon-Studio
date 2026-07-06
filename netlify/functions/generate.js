// Netlify serverless equivalent of the Express POST /api/generate route.
// Reuses the same server/prompt.js builder, so validation + prompts match the
// Express backend exactly. The key stays in Netlify's env; the client can only
// send { action, ...params }.
//
// NOTE: this serverless path does NOT enforce the per-IP / daily rate caps that
// the Express server does (those need a shared store like Redis). For a public
// deploy, either enable Netlify's platform rate limiting, front it with an
// Upstash-backed limiter, or use the Render deployment (Express + Redis) as the
// API and proxy /api/* to it (see netlify.toml).
import Anthropic from "@anthropic-ai/sdk";
import { buildRequest, BadInput } from "../../server/prompt.js";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
const apiKey = process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

const json = (statusCode, obj) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(obj),
});

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed." });
  if (!client) return json(500, { error: "Server is missing ANTHROPIC_API_KEY." });

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON." });
  }

  let request;
  try {
    request = buildRequest(body);
  } catch (err) {
    if (err instanceof BadInput) return json(400, { error: err.message });
    throw err;
  }

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: request.system,
      messages: request.messages,
    });
    return json(200, message);
  } catch (err) {
    console.error("Anthropic API error:", err?.message || err);
    return json(err?.status || 500, {
      error: err?.message || "The studio AI didn't respond. Try that step again.",
    });
  }
};
