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
import { renderReport } from "./renderer.js";
import { sendReportEmail } from "./mailer.js";

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

  const subject = free
    ? `Your free site audit — ${siteData.domain}`
    : byokAnthropicKey
      ? `Your full SiteX-Ray audit (Claude · BYOK) — ${siteData.domain}`
      : `Your full SiteX-Ray report — ${siteData.domain}`;

  await sendReportEmail({
    toEmail: email,
    subject,
    html,
    emailBinding: env.EMAIL,
    fromEmail: env.FROM_EMAIL || env.RESEND_FROM_EMAIL,
    replyTo: env.REPLY_TO_EMAIL || "support@sitexray.xyz",
  });

  return { domain: siteData.domain, overall_score: report.overall_score };
}
