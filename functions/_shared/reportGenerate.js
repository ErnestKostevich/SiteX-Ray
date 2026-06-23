// On-demand report generation (triggered by /api/report poll or report-status waitUntil).

import { getCachedReport, getJob, putJob } from "./reportCache.js";
import { runAuditAndEmail } from "./auditFlow.js";

export function shouldStartGeneration(job) {
  if (!job || job.status === "error" || job.status === "done") return false;
  if (job.status === "processing" && job.startedAt) {
    return Date.now() - job.startedAt >= 120000;
  }
  return job.status === "pending" || job.status === "processing";
}

export async function ensureReport(kind, key, env) {
  const cached = await getCachedReport(kind, key);
  if (cached) return cached;

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

  const origin = env.SITE_URL || "https://sitexray.xyz";
  const reportUrl = `${origin.replace(/\/$/, "")}/api/report?kind=${kind}&key=${encodeURIComponent(key)}`;

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
    });
    return await getCachedReport(kind, key);
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    await putJob(kind, key, { ...working, status: "error", error: msg });
    throw err;
  }
}