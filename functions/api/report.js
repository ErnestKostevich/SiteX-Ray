// GET /api/report?kind=free|paid&key=<id>
// Returns cached HTML or generates the report on-demand (poll triggers work).

import { ensureReport } from "../_shared/reportGenerate.js";

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

export async function onRequestGet(context) {
  const { env } = context;
  const url = new URL(context.request.url);
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