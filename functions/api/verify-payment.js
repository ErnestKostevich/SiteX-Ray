// POST /api/verify-payment
// Verifies 39 USDT → grants lifetime full-access license (not a subscription).

import { verifyTurnstile } from "../_shared/turnstile.js";
import {
  grantLifetimeLicense,
  isLicensed,
  rotateUnlockToken,
} from "../_shared/licenses.js";
import { sendUnlockEmail } from "../_shared/unlockEmail.js";
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

  const email = (body.email || "").trim();
  const network = (body.network || "").trim().toLowerCase();
  const txHash = (body.txHash || body.tx_hash || "").trim();
  const turnstileToken = body.turnstileToken || body["cf-turnstile-response"];

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { ok: false, error: "Valid email is required" });
  }
  if (!txHash) return json(400, { ok: false, error: "Transaction hash is required" });
  if (!NETWORKS[network]) {
    return json(400, { ok: false, error: "Choose network: trc20 or erc20" });
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

  const siteUrl = env.SITE_URL || new URL(request.url).origin;
  let unlockToken;
  let alreadyLicensed = await isLicensed(email);

  if (alreadyLicensed) {
    unlockToken = await rotateUnlockToken(email);
  } else {
    unlockToken = await grantLifetimeLicense(email, {
      txHash: payment.txHash,
      network: payment.network,
      amount: payment.amount,
    });
  }

  let emailSent = false;
  let emailError = null;
  try {
    await sendUnlockEmail({ email, unlockToken, env, siteUrl });
    emailSent = true;
  } catch (err) {
    emailError = err && err.message ? err.message : String(err);
    console.error("Unlock email failed:", emailError);
  }

  return json(200, {
    ok: true,
    licensed: true,
    lifetime: true,
    alreadyLicensed,
    unlockToken,
    emailSent,
    emailError,
    message: alreadyLicensed
      ? `Already unlocked. New access code emailed to ${email}.`
      : `Lifetime full access unlocked for ${email}. Save your unlock code — not a subscription.`,
    txHash: payment.txHash,
    network: payment.network,
    priceUsdt: PRICE_USDT,
  });
}