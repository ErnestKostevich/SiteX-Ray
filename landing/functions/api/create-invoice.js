// POST /api/create-invoice
// Body: { url, email }
// Creates a Cryptomus invoice for $39 and returns the hosted-checkout URL.
// The landing-page JS redirects the customer there.

import { createInvoice, newOrderId } from "../_shared/cryptomus.js";

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
  try {
    new URL(/^https?:\/\//i.test(url) ? url : "https://" + url);
  } catch {
    return json(400, { ok: false, error: "Invalid URL" });
  }

  if (!env.CRYPTOMUS_MERCHANT_ID || !env.CRYPTOMUS_API_KEY) {
    return json(503, {
      ok: false,
      error:
        "Payments not configured yet. Try the free teaser above, or email ernest2011kostevich@gmail.com to be a beta tester.",
    });
  }

  const origin = new URL(request.url).origin;
  const orderId = newOrderId();

  try {
    const invoice = await createInvoice({
      merchantId: env.CRYPTOMUS_MERCHANT_ID,
      apiKey: env.CRYPTOMUS_API_KEY,
      amount: PRICE_USD,
      orderId,
      urlCallback: `${origin}/api/cryptomus-webhook`,
      urlSuccess: `${origin}/success.html`,
      urlReturn: `${origin}/cancel.html`,
      customerUrl: url,
      customerEmail: email,
      toCurrency: env.CRYPTOMUS_TO_CURRENCY || "USDT",
    });

    return json(200, {
      ok: true,
      url: invoice.url,
      orderId: invoice.orderId,
    });
  } catch (err) {
    console.error("Cryptomus invoice creation failed:", err && err.stack ? err.stack : err);
    return json(502, {
      ok: false,
      error: "Couldn't create checkout. Please try again, or contact support.",
    });
  }
}
