// POST /api/resend-email  Body: { kind?, key }
// Resends the report notification email for a completed audit.

import {
  getCachedReportData,
  getJob,
  putJob,
} from "../_shared/reportCache.js";
import { renderEmailNotification } from "../_shared/renderer.js";
import { sendReportEmail } from "../_shared/mailer.js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });

export const onRequestOptions = () =>
  new Response(null, { status: 204, headers: cors });

export async function onRequestPost(context) {
  const { env, request } = context;
  let body = {};
  try {
    body = await request.json();
  } catch {
    /* empty */
  }

  const kind = (body.kind || "free").trim();
  const key = (body.key || "").trim().toLowerCase();

  if (!key || key.length < 16) {
    return json(400, { ok: false, error: "Invalid key" });
  }

  const job = await getJob(kind, key);
  if (!job) {
    return json(404, { ok: false, error: "Report not found" });
  }
  if (job.status !== "done") {
    return json(409, { ok: false, error: "Report not ready yet" });
  }

  const email = job.email;
  if (!email) {
    return json(400, { ok: false, error: "No email on file for this report" });
  }

  const report = await getCachedReportData(kind, key);
  if (!report) {
    return json(404, {
      ok: false,
      error: "Report data unavailable — open via the web button instead",
    });
  }

  const origin = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, "");
  const reportUrl = `${origin}/api/report?kind=${kind}&key=${encodeURIComponent(key)}`;
  const sender =
    env.BREVO_SENDER_EMAIL || env.FROM_EMAIL || "ernestkostevich@gmail.com";
  const fromEmail = sender.includes("@")
    ? `SiteX-Ray <${sender}>`
    : "SiteX-Ray <ernestkostevich@gmail.com>";

  const subject = job.free
    ? `Your audit is ready — open report (${report.domain})`
    : `Your full audit is ready — open report (${report.domain})`;

  try {
    await sendReportEmail({
      toEmail: email,
      subject,
      html: renderEmailNotification(report, {
        free: !!job.free,
        reportUrl,
        ctaUrl: job.ctaUrl || null,
      }),
      fromEmail,
      replyTo: env.REPLY_TO_EMAIL || "ernest2011kostevich@gmail.com",
      brevoApiKey: env.BREVO_API_KEY,
      apiToken: env.CLOUDFLARE_API_TOKEN || env.CF_API_TOKEN,
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
    });

    await putJob(kind, key, {
      ...job,
      emailSent: true,
      emailError: null,
      emailResentAt: Date.now(),
    });

    return json(200, { ok: true, sent: true, email });
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    await putJob(kind, key, { ...job, emailSent: false, emailError: msg });
    return json(500, { ok: false, sent: false, error: msg, email });
  }
}