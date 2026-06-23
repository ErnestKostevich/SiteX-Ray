// On-demand report generation (triggered by /api/report poll or report-status waitUntil).

import {
  cacheReport,
  getCachedReport,
  getCachedReportData,
  getJob,
  isLegacyWhiteReport,
  putJob,
} from "./reportCache.js";
import {
  buildReportUrl,
  deliverReportEmail,
  runAuditAndEmail,
} from "./auditFlow.js";
import { renderReport } from "./renderer.js";

export async function ensureEmailDelivered(kind, key, env, job) {
  if (!job || job.emailSent || !job.email) return job;

  const data = await getCachedReportData(kind, key);
  if (!data) return job;

  const reportUrl = buildReportUrl(kind, key, env);
  const mail = await deliverReportEmail({
    email: job.email,
    report: data,
    free: job.free ?? kind === "free",
    ctaUrl: job.ctaUrl || null,
    reportUrl,
    env,
  });

  const updated = {
    ...job,
    status: "done",
    emailSent: !!mail.emailSent,
    emailError: mail.emailError || null,
    emailMessageId: mail.messageId || null,
    emailDeliveredAt: mail.emailSent ? Date.now() : job.emailDeliveredAt || null,
  };
  await putJob(kind, key, updated);
  return updated;
}

export function shouldStartGeneration(job) {
  if (!job || job.status === "error" || job.status === "done") return false;
  if (job.status === "processing" && job.startedAt) {
    return Date.now() - job.startedAt >= 120000;
  }
  return job.status === "pending" || job.status === "processing";
}

async function refreshLegacyTheme(kind, key, env) {
  const html = await getCachedReport(kind, key);
  if (!html || !isLegacyWhiteReport(html)) return html;

  const data = await getCachedReportData(kind, key);
  const job = await getJob(kind, key);
  if (!data) return html;

  const refreshed = renderReport(data, {
    free: job?.free ?? kind === "free",
    ctaUrl: job?.ctaUrl || null,
  });
  await cacheReport(kind, key, refreshed);
  return refreshed;
}

export async function ensureReport(kind, key, env) {
  const cached = await refreshLegacyTheme(kind, key, env);
  if (cached) {
    let job = await getJob(kind, key);
    if (job) {
      job = await ensureEmailDelivered(kind, key, env, job);
      if (job.status !== "done") {
        await putJob(kind, key, { ...job, status: "done" });
      }
    }
    return cached;
  }

  const job = await getJob(kind, key);
  if (!job) return null;

  if (job.status === "error") {
    throw new Error(job.error || "Report generation failed");
  }

  if (
    job.status === "processing" &&
    job.startedAt &&
    Date.now() - job.startedAt < 120000
  ) {
    return null;
  }

  const working = { ...job, status: "processing", startedAt: Date.now() };
  await putJob(kind, key, working);

  const reportUrl = buildReportUrl(kind, key, env);

  try {
    const result = await runAuditAndEmail({
      url: working.url,
      email: working.email,
      free: working.free,
      env,
      ctaUrl: working.ctaUrl || null,
      byokAnthropicKey: working.byokAnthropicKey || null,
      cacheKey: key,
      reportUrl,
    });
    await putJob(kind, key, {
      ...working,
      status: "done",
      emailSent: !!result.emailSent,
      emailError: result.emailError || null,
      emailMessageId: result.messageId || null,
      emailDeliveredAt: result.emailSent ? Date.now() : null,
    });
    return await getCachedReport(kind, key);
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    await putJob(kind, key, { ...working, status: "error", error: msg });
    throw err;
  }
}