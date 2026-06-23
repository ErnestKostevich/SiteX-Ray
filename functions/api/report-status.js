// GET /api/report-status?kind=free|paid&key=<id>

import { getCachedReport, getJob } from "../_shared/reportCache.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const onRequestOptions = () =>
  new Response(null, { status: 204, headers: corsHeaders });

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const kind = (url.searchParams.get("kind") || "free").trim();
  const key = (url.searchParams.get("key") || "").trim().toLowerCase();

  if (!key || key.length < 16) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid key" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const job = await getJob(kind, key);
  const html = await getCachedReport(kind, key);
  const ready = !!html || job?.status === "done";

  return new Response(
    JSON.stringify({
      ok: true,
      ready,
      status: job?.status || (html ? "done" : "pending"),
      email: job?.email || null,
      emailSent: !!job?.emailSent,
      emailError: job?.emailError || null,
    }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
}