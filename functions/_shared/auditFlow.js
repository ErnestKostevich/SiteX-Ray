// Audit pipeline: free = Llama teaser; full = BYOK Claude Sonnet 4.6 (licensed users only).

import { scrapeSite } from "./scraper.js";
import { analyzeWithClaude, DEFAULT_EFFORT, DEFAULT_MODEL } from "./analyzer.js";
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

export async function deliverReportEmail(opts) {
  const { email, report, free = true, ctaUrl = null, reportUrl, env } = opts;

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
  if (byokAnthropicKey) {
    return await analyzeWithClaude(siteData, byokAnthropicKey, {
      free: false,
      model: env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      effort: env.ANTHROPIC_EFFORT || DEFAULT_EFFORT,
    });
  }

  if (free) {
    if (!env.AI) {
      throw new Error(
        "Free teaser requires Cloudflare Workers AI. Enable the AI binding in Pages settings."
      );
    }
    return await analyzeWithCloudflareAI(siteData, env, { free: true });
  }

  throw new Error("Full audits require your Anthropic API key (BYOK) and lifetime unlock.");
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
    reportKind = "free",
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
  const report = normalizeReport(rawReport, siteData);

  const html = renderReport(report, { free, ctaUrl });

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
  }

  if (cacheKey) {
    await cacheReportData(reportKind, cacheKey, report);
    await cacheReport(reportKind, cacheKey, html);
  }

  return {
    domain: siteData.domain,
    overall_score: report.overall_score,
    emailSent,
    emailError,
    messageId,
  };
}