// POST /api/resend-email  Body: { kind?, key }
// Resends the report notification email for a completed audit.

import { getCachedReportData, getJob, putJob } from "../_shared/reportCache.js";
import { buildReportUrl, deliverReportEmail } from "../_shared/auditFlow.js";

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
  if (job.status === "error") {
    return json(409, { ok: false, error: job.error || "Report generation failed" });
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

  const reportUrl = buildReportUrl(kind, key, env, new URL(request.url).origin);
  const mail = await deliverReportEmail({
    email,
    report,
    free: !!job.free,
    ctaUrl: job.ctaUrl || null,
    reportUrl,
    env,
  });

  if (!mail.emailSent) {
    await putJob(kind, key, { ...job, emailSent: false, emailError: mail.emailError });
    return json(500, {
      ok: false,
      sent: false,
      error: mail.emailError || "Send failed",
      email,
    });
  }

  await putJob(kind, key, {
    ...job,
    status: "done",
    emailSent: true,
    emailError: null,
    emailMessageId: mail.messageId || null,
    emailResentAt: Date.now(),
  });

  return json(200, {
    ok: true,
    sent: true,
    email,
    messageId: mail.messageId || null,
  });
}