// GET /api/report?kind=paid&key=<txHash>
// Returns cached HTML report (backup download after USDT payment).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const onRequestOptions = () =>
  new Response(null, { status: 204, headers: corsHeaders });

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const kind = (url.searchParams.get("kind") || "paid").trim();
  const key = (url.searchParams.get("key") || "").trim().toLowerCase();

  if (!key || key.length < 32) {
    return new Response("Missing or invalid key", { status: 400, headers: corsHeaders });
  }

  const { getCachedReport } = await import("../_shared/reportCache.js");
  const html = await getCachedReport(kind, key);

  if (!html) {
    return new Response(
      JSON.stringify({ ok: false, ready: false }),
      {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": 'inline; filename="sitexray-report.html"',
      ...corsHeaders,
    },
  });
}