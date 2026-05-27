// POST /api/audit — free teaser endpoint (or full Claude report if BYOK).
// Body: { url, email, turnstileToken?, anthropicApiKey? }
//
// If `anthropicApiKey` is provided and valid (starts with sk-ant-), we
// run the FULL report through the user's own Claude key. The founder
// pays $0, the user pays a few cents to Anthropic on their own bill.
// This is the "Pro / BYOK" tier — power users get the full report free.
//
// Without BYOK: standard 1-page Llama teaser, used as a lead magnet.
//
// Returns 200 immediately, generates + emails the report via waitUntil().

import { verifyTurnstile } from "../_shared/turnstile.js";
import { runAuditAndEmail } from "../_shared/auditFlow.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

export const onRequestOptions = () =>
  new Response(null, { status: 204, headers: corsHeaders });

export async function onRequestPost(context) {
  const { request, env, waitUntil } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON body" });
  }

  const url = (body.url || "").trim();
  const email = (body.email || "").trim();
  const turnstileToken = body.turnstileToken || body["cf-turnstile-response"];
  const byokKeyRaw = (body.anthropicApiKey || "").trim();

  if (!url) return jsonResponse(400, { ok: false, error: "URL is required" });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse(400, { ok: false, error: "Valid email is required" });
  }
  try {
    new URL(/^https?:\/\//i.test(url) ? url : "https://" + url);
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid URL" });
  }

  // Validate BYOK Anthropic key format if provided.
  let byokAnthropicKey = null;
  if (byokKeyRaw) {
    if (!/^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(byokKeyRaw)) {
      return jsonResponse(400, {
        ok: false,
        error:
          "Anthropic API key looks invalid. It should start with 'sk-ant-' followed by your key. Get one at console.anthropic.com.",
      });
    }
    byokAnthropicKey = byokKeyRaw;
  }

  // Verify anti-bot.
  if (env.TURNSTILE_SECRET) {
    const ts = await verifyTurnstile(
      turnstileToken,
      env.TURNSTILE_SECRET,
      request.headers.get("CF-Connecting-IP")
    );
    if (!ts.success) {
      return jsonResponse(403, {
        ok: false,
        error: "Bot check failed. Please refresh and try again.",
      });
    }
  }

  // BYOK Claude key → unlock the full 10-15 page report.
  // Without BYOK → standard free 1-page teaser.
  const isFullReport = !!byokAnthropicKey;

  // CTA for the email body upsell — only relevant for teaser emails.
  // Generic landing-pricing link; no Lemon Squeezy stuff anymore.
  const origin = new URL(request.url).origin;
  const ctaUrl = `${origin}/#pricing`;

  waitUntil(
    runAuditAndEmail({
      url,
      email,
      free: !isFullReport,
      env,
      ctaUrl,
      byokAnthropicKey,
    }).catch((err) => {
      // We don't have logging infra; surface to CF logs.
      console.error("Audit failed:", err && err.stack ? err.stack : err);
    })
  );

  return jsonResponse(200, {
    ok: true,
    message: isFullReport
      ? "Your full Claude-powered audit is being generated. It will arrive in your inbox within 2–3 minutes."
      : "Your free teaser report is being generated. It will arrive in your inbox within 2 minutes.",
  });
}
