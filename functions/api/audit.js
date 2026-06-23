// POST /api/audit
// Free: URL + email → Llama teaser
// Full: lifetime unlock + BYOK Anthropic key → Claude Sonnet 4.6 full audit

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
        "Full Claude audits require lifetime unlock ($39 USDT). Free tier is Llama teaser only.",
      needsUnlock: true,
    });
  }

  if (unlockToken && !byokKeyRaw) {
    return jsonResponse(400, {
      ok: false,
      error: "Paste your Anthropic API key for full audits (BYOK).",
      needsKey: true,
    });
  }

  let licensedFull = false;
  if (byokKeyRaw) {
    if (!/^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(byokKeyRaw)) {
      return jsonResponse(400, {
        ok: false,
        error:
          "Anthropic API key looks invalid. Get one at console.anthropic.com.",
      });
    }
    const valid = await verifyLicense(email, unlockToken);
    if (!valid) {
      return jsonResponse(403, {
        ok: false,
        error: "Invalid unlock code for this email. Pay 39 USDT or use the code from your unlock email.",
        needsUnlock: true,
      });
    }
    licensedFull = true;
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
  const reportKind = licensedFull ? "full" : "free";

  const reportKey = await crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(`${email}|${url}|${Date.now()}`))
    .then((buf) =>
      Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 32)
    );

  if (licensedFull) {
    await stashByokKey(reportKey, byokKeyRaw);
  }

  await putJob(reportKind, reportKey, {
    status: "pending",
    url,
    email,
    free: !licensedFull,
    licensedFull,
    ctaUrl,
    createdAt: Date.now(),
  });

  return jsonResponse(200, {
    ok: true,
    reportKey,
    kind: reportKind,
    full: licensedFull,
    message: licensedFull
      ? "Generating full Claude audit — stay on this page. Private link + email when ready."
      : "Generating free Llama teaser — stay on this page. Private link + email when ready.",
  });
}