// POST /api/audit
// Free (no unlock): URL + email → Llama teaser
// Licensed (unlock): always full audit — Llama by default, Claude Sonnet 4.6 if BYOK key pasted

import { verifyTurnstile } from "../_shared/turnstile.js";
import { putJob } from "../_shared/reportCache.js";
import { verifyLicense } from "../_shared/licenses.js";
import { stashByokKey } from "../_shared/ephemeralKey.js";

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
  const unlockToken = (body.unlockToken || "").trim();
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

  if (byokKeyRaw && !unlockToken) {
    return jsonResponse(403, {
      ok: false,
      error:
        "Claude BYOK requires lifetime unlock ($39 USDT). Free tier is Llama teaser only.",
      needsUnlock: true,
    });
  }

  let licensed = false;
  if (unlockToken) {
    const valid = await verifyLicense(email, unlockToken);
    if (!valid) {
      return jsonResponse(403, {
        ok: false,
        error:
          "Invalid unlock code for this email. Use the code from your payment email, or pay 39 USDT.",
        needsUnlock: true,
      });
    }
    licensed = true;
  }

  let useClaude = false;
  if (byokKeyRaw) {
    if (!/^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(byokKeyRaw)) {
      return jsonResponse(400, {
        ok: false,
        error:
          "Anthropic API key looks invalid. Get one at console.anthropic.com.",
      });
    }
    useClaude = true;
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

  const origin = new URL(request.url).origin;
  const ctaUrl = `${origin}/#pricing`;
  const reportKind = licensed ? "full" : "free";

  const reportKey = await crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(`${email}|${url}|${Date.now()}`))
    .then((buf) =>
      Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 32)
    );

  if (useClaude) {
    await stashByokKey(reportKey, byokKeyRaw);
  }

  await putJob(reportKind, reportKey, {
    status: "pending",
    url,
    email,
    free: !licensed,
    licensedFull: licensed,
    engine: licensed ? (useClaude ? "claude" : "llama") : "llama-teaser",
    ctaUrl,
    createdAt: Date.now(),
  });

  const engineLabel = useClaude
    ? "Claude Sonnet 4.6"
    : licensed
      ? "Llama (full report)"
      : "Llama (teaser)";

  return jsonResponse(200, {
    ok: true,
    reportKey,
    kind: reportKind,
    full: licensed,
    engine: useClaude ? "claude" : licensed ? "llama" : "teaser",
    message: licensed
      ? `Generating full audit (${engineLabel}) — stay on this page. Link + email when ready.`
      : "Generating free Llama teaser — stay on this page. Link + email when ready.",
  });
}