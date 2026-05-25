// Calls Anthropic Messages API, parses JSON audit report.
import { AUDITOR_SYSTEM_PROMPT } from "./prompt.js";

const DEFAULT_MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 8000;

function extractJson(raw) {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error("Claude response was not valid JSON");
  }
}

export async function analyzeWithClaude(siteData, apiKey, opts = {}) {
  const { free = true, model = DEFAULT_MODEL } = opts;

  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const mode = free ? "TEASER" : "FULL";

  const userMessage =
    `Mode: ${mode}\n\n` +
    "Site data (JSON):\n```json\n" +
    JSON.stringify(siteData, null, 2) +
    "\n```\n\n" +
    "Generate the audit report as a single JSON object per the schema. Output JSON only, no commentary.";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      system: AUDITOR_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${body.slice(0, 500)}`);
  }

  const data = await response.json();
  const text = (data.content || [])
    .map((b) => b.text || "")
    .join("")
    .trim();

  return extractJson(text);
}
