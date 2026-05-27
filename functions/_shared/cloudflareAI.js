// Calls Cloudflare Workers AI (free Llama inference) and parses the audit JSON.
// Used as the default backend so the founder pays $0 per request.
//
// Free tier: 10,000 Neurons/day on a Cloudflare Free plan (≈ 50–200 audits/day
// depending on prompt size). After that, ~$0.01 per 1k Neurons.

import { AUDITOR_SYSTEM_PROMPT } from "./prompt.js";

const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const TEASER_MAX_TOKENS = 2000;
const FULL_MAX_TOKENS = 6000;

function parseJsonFromText(text) {
  let cleaned = (text || "").trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fallback: grab the outermost { ... } substring
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch (e2) {
        throw new Error("Cloudflare AI returned unparseable JSON: " + e2.message);
      }
    }
    throw new Error(
      "Cloudflare AI response had no JSON object: " + cleaned.slice(0, 200)
    );
  }
}

export async function analyzeWithCloudflareAI(siteData, env, opts = {}) {
  const { free = true, model } = opts;

  if (!env.AI) {
    throw new Error(
      "Cloudflare Workers AI binding is not available. Add [ai] binding=\"AI\" to wrangler.toml or enable it in the Pages dashboard (Settings → Functions → Workers AI binding)."
    );
  }

  const mode = free ? "TEASER" : "FULL";
  const chosenModel = model || env.CF_AI_MODEL || DEFAULT_MODEL;

  const userMessage =
    `Mode: ${mode}\n\n` +
    "Site data (JSON):\n```json\n" +
    JSON.stringify(siteData, null, 2) +
    "\n```\n\n" +
    "Generate the audit report as a single JSON object per the schema. Output JSON only, no commentary, no markdown fences.";

  const baseRequest = {
    messages: [
      { role: "system", content: AUDITOR_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    max_tokens: free ? TEASER_MAX_TOKENS : FULL_MAX_TOKENS,
  };

  let response;
  try {
    // Try JSON mode first (supported by most Llama variants on Workers AI)
    response = await env.AI.run(chosenModel, {
      ...baseRequest,
      response_format: { type: "json_object" },
    });
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (/response_format|json_object|unknown|unsupported/i.test(msg)) {
      // Fallback: ask for JSON in the prompt itself
      response = await env.AI.run(chosenModel, {
        ...baseRequest,
        messages: [
          baseRequest.messages[0],
          {
            role: "user",
            content:
              userMessage +
              "\n\nIMPORTANT: Output ONLY a valid raw JSON object. No prose, no markdown fences.",
          },
        ],
      });
    } else {
      throw e;
    }
  }

  const rawText = response && response.response ? response.response : "";
  return parseJsonFromText(rawText);
}
