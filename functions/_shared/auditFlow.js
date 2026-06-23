// End-to-end audit pipeline. Picks the right AI backend based on what's
// configured + the caller's BYOK preference, scrapes the site, generates
// the audit, emails the report.
//
// Backend selection (in priority order):
//   - BYOK Claude key (user-provided) → always wins. Uses user's Anthropic key,
//     even for the free-teaser endpoint. Costs the user, not the founder.
//   - Free teaser without BYOK: Cloudflare Workers AI (Llama 3.1, free to founder)
//   - Paid audit without BYOK: founder's ANTHROPIC_API_KEY if set, else Cloudflare AI
//   - Falls back gracefully if only one backend is configured.

import { scrapeSite } from "./scraper.js";
import { analyzeWithClaude } from "./analyzer.js";
import { analyzeWithCloudflareAI } from "./cloudflareAI.js";
import { normalizeReport } from "./normalize.js";
import {
  renderReport,
  renderEmailNotification,
  reportEmailSubject,
} from "./renderer.js";
import { sendReportEmail } from "./mailer.js";
import { cacheReport, cacheReportData } from "./reportCache.js";

export function buildReportUrl(kind, key, env, originHint) {
  const origin = (
    env.SITE_URL ||
    originHint ||
    "https://sitexray.xyz"
  ).replace(/\/$/, "");
  return `${origin}/api/report?kind=${kind}&key=${encodeURIComponent(key)}`;
}

function emailFromEnv(env) {
  const sender =
    env.BREVO_SENDER_EMAIL || env.FROM_EMAIL || "ernestkostevich@gmail.com";
  return sender.includes("@")
    ? `SiteX-Ray <${sender}>`
    : "SiteX-Ray <ernestkostevich@gmail.com>";
}

/** Send the report-link notification. Returns { emailSent, emailError, messageId }. */
export async function deliverReportEmail(opts) {
  const {
    email,
    report,
    free = true,
    ctaUrl = null,
    reportUrl,
    env,
  } = opts;

  if (!email) throw new Error("email is required");
  if (!report) throw new Error("report is required");
  if (!reportUrl) throw new Error("reportUrl is required");

  try {
    const result = await sendReportEmail({
      toEmail: email,
      subject: reportEmailSubject(report),
      html: renderEmailNotification(report, { free, reportUrl, ctaUrl }),
      emailBinding: env.EMAIL,
      fromEmail: emailFromEnv(env),
      replyTo: env.REPLY_TO_EMAIL || "ernest2011kostevich@gmail.com",
      brevoApiKey: env.BREVO_API_KEY,
      apiToken: env.CLOUDFLARE_API_TOKEN || env.CF_API_TOKEN,
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      brevoTags: ["audit-report"],
    });
    return {
      emailSent: true,
      emailError: null,
      messageId: result?.messageId || null,
    };
  } catch (emailErr) {
    const emailError =
      emailErr && emailErr.message ? emailErr.message : String(emailErr);
    console.error("Email delivery failed:", emailError);
    return { emailSent: false, emailError, messageId: null };
  }
}

async function pickBackendAndAnalyze(siteData, env, free, byokAnthropicKey) {
  const claudeKey = byokAnthropicKey || env.ANTHROPIC_API_KEY;
  const hasClaude = !!claudeKey;
  const hasCfAI = !!env.AI;

  // BYOK ALWAYS uses Claude — that's the whole point of the Pro tier.
  if (byokAnthropicKey) {
    return await analyzeWithClaude(siteData, byokAnthropicKey, {
      free,
      model: env.ANTHROPIC_MODEL || undefined,
    });
  }

  // Free teaser (no BYOK): cheapest backend.
  if (free) {
    if (hasCfAI) {
      return await analyzeWithCloudflareAI(siteData, env, { free: true });
    }
    if (hasClaude) {
      return await analyzeWithClaude(siteData, claudeKey, {
        free: true,
        model: env.ANTHROPIC_MODEL || undefined,
      });
    }
  } else {
    // Paid audit (no BYOK): best quality available.
    if (hasClaude) {
      return await analyzeWithClaude(siteData, claudeKey, {
        free: false,
        model: env.ANTHROPIC_MODEL || undefined,
      });
    }
    if (hasCfAI) {
      return await analyzeWithCloudflareAI(siteData, env, { free: false });
    }
  }

  throw new Error(
    "No AI backend configured. Either enable Cloudflare Workers AI (add [ai] binding in wrangler.toml) or set ANTHROPIC_API_KEY in environment variables."
  );
}

export async function runAuditAndEmail(opts) {
  const {
    url,
    email,
    free,
    env,
    ctaUrl = null,
    byokAnthropicKey = null,
    cacheKey = null,
    reportUrl = null,
  } = opts;

  if (!url) throw new Error("url is required");
  if (!email) throw new Error("email is required");

  const siteData = await scrapeSite(url);

  const rawReport = await pickBackendAndAnalyze(
    siteData,
    env,
    free,
    byokAnthropicKey
  );
  // Always pass the AI output through the normalizer so the renderer can
  // assume a consistent shape (severity values, missing sections, etc.).
  const report = normalizeReport(rawReport, siteData);

  const html = renderReport(report, { free, ctaUrl });

  // Email BEFORE cache — if the worker times out after caching, we must not
  // skip delivery on the next poll (ensureReport retries when emailSent=false).
  let emailSent = false;
  let emailError = null;
  let messageId = null;

  if (reportUrl) {
    const mail = await deliverReportEmail({
      email,
      report,
      free,
      ctaUrl,
      reportUrl,
      env,
    });
    emailSent = mail.emailSent;
    emailError = mail.emailError;
    messageId = mail.messageId;
    if (!emailSent && !cacheKey) {
      throw new Error(emailError || "Email delivery failed");
    }
  } else {
    try {
      const result = await sendReportEmail({
        toEmail: email,
        subject: reportEmailSubject(report),
        html,
        emailBinding: env.EMAIL,
        fromEmail: emailFromEnv(env),
        replyTo: env.REPLY_TO_EMAIL || "ernest2011kostevich@gmail.com",
        brevoApiKey: env.BREVO_API_KEY,
        apiToken: env.CLOUDFLARE_API_TOKEN || env.CF_API_TOKEN,
        accountId: env.CLOUDFLARE_ACCOUNT_ID,
        brevoTags: ["audit-report"],
      });
      emailSent = true;
      messageId = result?.messageId || null;
    } catch (emailErr) {
      emailError =
        emailErr && emailErr.message ? emailErr.message : String(emailErr);
      console.error("Email delivery failed:", emailError);
      if (!cacheKey) throw emailErr;
    }
  }

  if (cacheKey) {
    const kind = free ? "free" : "paid";
    await cacheReportData(kind, cacheKey, report);
    await cacheReport(kind, cacheKey, html);
  }

  return {
    domain: siteData.domain,
    overall_score: report.overall_score,
    emailSent,
    emailError,
    messageId,
  };
}
