// POST /api/audit — free teaser endpoint (or full Claude report if BYOK).
// Body: { url, email, turnstileToken?, anthropicApiKey? }
//
// Returns immediately with reportKey. Client polls GET /api/report?kind=free&key=...
// Generation runs on-demand when the poll hits (works on Workers Free — no long waitUntil).

import { verifyTurnstile } from "../_shared/turnstile.js";
import { putJob } from "../_shared/reportCache.js";

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
  const { request, env } = context;

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

  const isFullReport = !!byokAnthropicKey;
  const origin = new URL(request.url).origin;
  const ctaUrl = `${origin}/#pricing`;

  const reportKey = await crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(`${email}|${url}|${Date.now()}`))
    .then((buf) =>
      Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 32)
    );

  await putJob("free", reportKey, {
    status: "pending",
    url,
    email,
    free: !isFullReport,
    ctaUrl,
    byokAnthropicKey,
    createdAt: Date.now(),
  });

  return jsonResponse(200, {
    ok: true,
    reportKey,
    message: isFullReport
      ? "Generating full audit — stay on this page. You'll get a private link + email (no account)."
      : "Generating free teaser — stay on this page. Private link appears here + email sent.",
  });
}