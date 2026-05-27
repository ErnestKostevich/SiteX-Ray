// POST /api/create-invoice
// Body: { url, email }
// Creates a NOWPayments invoice for $39 and returns the hosted-checkout URL.
// The landing-page JS redirects the customer there.
//
// Customer audit metadata (URL + email) is encoded into the NOWPayments
// order_id as URL-safe base64 — see _shared/nowpayments.js. Webhook
// decodes it back when the payment confirms.

import { createInvoice, newOrderId } from "../_shared/nowpayments.js";

const PRICE_USD = 39;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

export const onRequestOptions = () =>
  new Response(null, { status: 204, headers: corsHeaders });

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }

  const url = (body.url || "").trim();
  const email = (body.email || "").trim();

  if (!url) return json(400, { ok: false, error: "URL is required" });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { ok: false, error: "Valid email is required" });
  }
  // Defensive: keep order_id under ~250 chars (base64-of-JSON of url+email)
  if (url.length > 300 || email.length > 150) {
    return json(400, { ok: false, error: "URL or email is unreasonably long" });
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(/^https?:\/\//i.test(url) ? url : "https://" + url);
  } catch {
    return json(400, { ok: false, error: "Invalid URL" });
  }

  if (!env.NOWPAYMENTS_API_KEY) {
    return json(503, {
      ok: false,
      error:
        "Payments not configured yet. Try the free teaser above, or email ernest2011kostevich@gmail.com to be a beta tester.",
    });
  }

  const origin = new URL(request.url).origin;
  const orderId = newOrderId(url, email);

  try {
    const invoice = await createInvoice({
      apiKey: env.NOWPAYMENTS_API_KEY,
      amount: PRICE_USD,
      orderId,
      orderDescription: `SiteX-Ray full audit · ${parsedUrl.hostname}`,
      ipnCallbackUrl: `${origin}/api/nowpayments-webhook`,
      successUrl: `${origin}/success.html`,
      cancelUrl: `${origin}/cancel.html`,
    });

    return json(200, {
      ok: true,
      url: invoice.url,
      orderId: invoice.orderId,
    });
  } catch (err) {
    console.error("NOWPayments invoice creation failed:", err && err.stack ? err.stack : err);
    return json(502, {
      ok: false,
      error: "Couldn't create checkout. Please try again, or contact support.",
    });
  }
}
