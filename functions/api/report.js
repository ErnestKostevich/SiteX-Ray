// GET /api/report?kind=free|paid&key=<id>
// Returns cached HTML or generates the report on-demand (poll triggers work).

import { getCachedReport, getJob, putJob } from "../_shared/reportCache.js";
import { runAuditAndEmail } from "../_shared/auditFlow.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

export const onRequestOptions = () =>
  new Response(null, { status: 204, headers: corsHeaders });

async function ensureReport(kind, key, env) {
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

  try {
    await runAuditAndEmail({
      url: working.url,
      email: working.email,
      free: working.free,
      env,
      ctaUrl: working.ctaUrl || null,
      byokAnthropicKey: working.byokAnthropicKey || null,
      cacheKey: key,
    });
    await putJob(kind, key, { ...working, status: "done" });
    return await getCachedReport(kind, key);
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    await putJob(kind, key, { ...working, status: "error", error: msg });
    throw err;
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const kind = (url.searchParams.get("kind") || "paid").trim();
  const key = (url.searchParams.get("key") || "").trim().toLowerCase();

  if (!key || key.length < 16) {
    return json(400, { ok: false, error: "Missing or invalid key" });
  }

  try {
    const html = await ensureReport(kind, key, env);
    if (!html) {
      return json(202, { ok: false, ready: false, status: "processing" });
    }

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": 'inline; filename="sitexray-report.html"',
        ...corsHeaders,
      },
    });
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    return json(500, { ok: false, ready: false, error: msg });
  }
}