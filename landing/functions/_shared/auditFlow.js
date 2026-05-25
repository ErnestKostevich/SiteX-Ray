// End-to-end audit pipeline shared between the free-teaser and the paid-webhook handlers.
// scrape → analyze → render → email.

import { scrapeSite } from "./scraper.js";
import { analyzeWithClaude } from "./analyzer.js";
import { renderReport } from "./renderer.js";
import { sendReportEmail } from "./mailer.js";

export async function runAuditAndEmail(opts) {
  const {
    url,
    email,
    free,
    env,
    ctaUrl = null,
  } = opts;

  if (!url) throw new Error("url is required");
  if (!email) throw new Error("email is required");

  const siteData = await scrapeSite(url);

  const report = await analyzeWithClaude(siteData, env.ANTHROPIC_API_KEY, {
    free,
    model: env.ANTHROPIC_MODEL || undefined,
  });

  // Merge URL/domain if model didn't echo them
  report.url = report.url || siteData.final_url;
  report.domain = report.domain || siteData.domain;

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
