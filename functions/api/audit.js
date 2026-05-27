// POST /api/audit — free teaser endpoint.
// Body: { url, email, turnstileToken? }
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

  if (!url) return jsonResponse(400, { ok: false, error: "URL is required" });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse(400, { ok: false, error: "Valid email is required" });
  }
  try {
    new URL(/^https?:\/\//i.test(url) ? url : "https://" + url);
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid URL" });
  }

  // Verify anti-bot
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

  // Fire the actual audit in the background — return immediately.
  const ctaUrl = env.LEMON_CHECKOUT_URL
    ? `${env.LEMON_CHECKOUT_URL}?checkout[custom][audit_url]=${encodeURIComponent(url)}&checkout[email]=${encodeURIComponent(email)}`
    : null;

  waitUntil(
    runAuditAndEmail({ url, email, free: true, env, ctaUrl }).catch((err) => {
      // We don't have logging infra; surface to CF logs.
      console.error("Free-teaser audit failed:", err && err.stack ? err.stack : err);
    })
  );

  return jsonResponse(200, {
    ok: true,
    message: "Your free teaser report is being generated. It will arrive in your inbox within 2 minutes.",
  });
}
