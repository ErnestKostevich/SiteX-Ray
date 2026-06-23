// POST /api/verify-payment
// Body: { url, email, network: "trc20"|"erc20", txHash, turnstileToken? }
// Verifies on-chain USDT payment and delivers full audit by email.

import { verifyTurnstile } from "../_shared/turnstile.js";
import { putJob } from "../_shared/reportCache.js";
import {
  verifyUsdtPayment,
  markTxUsed,
  PRICE_USDT,
  NETWORKS,
} from "../_shared/usdtVerify.js";


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
  const network = (body.network || "").trim().toLowerCase();
  const txHash = (body.txHash || body.tx_hash || "").trim();
  const turnstileToken = body.turnstileToken || body["cf-turnstile-response"];

  if (!url) return json(400, { ok: false, error: "URL is required" });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { ok: false, error: "Valid email is required" });
  }
  if (!txHash) return json(400, { ok: false, error: "Transaction hash is required" });
  if (!NETWORKS[network]) {
    return json(400, { ok: false, error: "Choose network: trc20 or erc20" });
  }

  try {
    new URL(/^https?:\/\//i.test(url) ? url : "https://" + url);
  } catch {
    return json(400, { ok: false, error: "Invalid URL" });
  }

  if (env.TURNSTILE_SECRET) {
    const ts = await verifyTurnstile(
      turnstileToken,
      env.TURNSTILE_SECRET,
      request.headers.get("CF-Connecting-IP")
    );
    if (!ts.success) {
      return json(403, { ok: false, error: "Bot check failed. Please refresh and try again." });
    }
  }

  let payment;
  try {
    payment = await verifyUsdtPayment(network, txHash);
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    return json(400, { ok: false, error: msg });
  }

  await markTxUsed(payment.network, payment.txHash);

  await putJob("paid", payment.txHash, {
    status: "pending",
    url,
    email,
    free: false,
    ctaUrl: null,
    createdAt: Date.now(),
    network: payment.network,
    amount: payment.amount,
  });

  return json(200, {
    ok: true,
    message: `Payment verified (${PRICE_USDT} USDT). Your full audit is generating — check ${email} in 2–3 minutes.`,
    txHash: payment.txHash,
    network: payment.network,
    reportKey: payment.txHash,
  });
}