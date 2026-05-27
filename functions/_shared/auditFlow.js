// End-to-end audit pipeline. Picks the right AI backend based on what's
// configured, scrapes the site, generates the audit, emails the report.
//
// Backend selection (in priority order):
//   - Free teaser: Cloudflare Workers AI (free for the founder)
//   - Paid audit: Claude via Anthropic if ANTHROPIC_API_KEY is set
//                 (best quality, ~$0.30/report, covered by the $39 sale)
//   - Fallback in both directions if only one backend is configured.

import { scrapeSite } from "./scraper.js";
import { analyzeWithClaude } from "./analyzer.js";
import { analyzeWithCloudflareAI } from "./cloudflareAI.js";
import { normalizeReport } from "./normalize.js";
import { renderReport } from "./renderer.js";
import { sendReportEmail } from "./mailer.js";

async function pickBackendAndAnalyze(siteData, env, free) {
  const hasClaude = !!env.ANTHROPIC_API_KEY;
  const hasCfAI = !!env.AI;

  // Free teaser: cheapest backend that's available.
  if (free) {
    if (hasCfAI) {
      return await analyzeWithCloudflareAI(siteData, env, { free: true });
    }
    if (hasClaude) {
      return await analyzeWithClaude(siteData, env.ANTHROPIC_API_KEY, {
        free: true,
        model: env.ANTHROPIC_MODEL || undefined,
      });
    }
  } else {
    // Paid audit: best quality available.
    if (hasClaude) {
      return await analyzeWithClaude(siteData, env.ANTHROPIC_API_KEY, {
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
  const { url, email, free, env, ctaUrl = null } = opts;

  if (!url) throw new Error("url is required");
  if (!email) throw new Error("email is required");

  const siteData = await scrapeSite(url);

  const rawReport = await pickBackendAndAnalyze(siteData, env, free);
  // Always pass the AI output through the normalizer so the renderer can
  // assume a consistent shape (severity values, missing sections, etc.).
  const report = normalizeReport(rawReport, siteData);

  const html = renderReport(report, { free, ctaUrl });

  const subject = free
    ? `Your free site audit — ${siteData.domain}`
    : `Your full SiteX-Ray report — ${siteData.domain}`;

  await sendReportEmail({
    toEmail: email,
    subject,
    html,
    resendKey: env.RESEND_API_KEY,
    fromEmail: env.RESEND_FROM_EMAIL,
  });

  return { domain: siteData.domain, overall_score: report.overall_score };
}
