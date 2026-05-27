// NOWPayments crypto-payment integration.
// https://documenter.getpostman.com/view/7907941/2s93JusNJt
//
// Why NOWPayments:
//  - 0.5% fee per sale (vs 7% on card)
//  - Crypto payouts to YOUR wallet — no KYC required for non-fiat withdrawal
//  - Hosted checkout, customer pays in 100+ cryptocurrencies
//  - HMAC-SHA512 webhook signing (Web Crypto native, no MD5 required)
//
// Setup the founder does once in NOWPayments dashboard:
//   1. Create API key (Settings → API keys)
//   2. Create IPN secret (Settings → IPN) — separate from API key
//   3. Set webhook URL: https://yourdomain.com/api/nowpayments-webhook
//   4. Add payout wallet (e.g. USDT-TRC20 for low fees)
//
// Audit metadata: NOWPayments doesn't have an `additional_data` field
// on invoices, so we encode {url, email} into `order_id` as URL-safe
// base64. Webhook decodes it back. Stateless — no KV store needed.

const API_BASE = "https://api.nowpayments.io/v1";

// ─────────────────────────────────────────────────────────────────
// Base64URL helpers (encode audit metadata into order_id)
// ─────────────────────────────────────────────────────────────────
function base64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64urlDecode(s) {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(padded + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// ─────────────────────────────────────────────────────────────────
// HMAC-SHA512 via Web Crypto (used for webhook signature verification)
// ─────────────────────────────────────────────────────────────────
async function hmacSha512Hex(key, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// NOWPayments sorts JSON keys alphabetically before signing — we must
// reproduce that ordering exactly when verifying.
function sortKeysDeep(obj) {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return obj;
  const out = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = sortKeysDeep(obj[key]);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────

/**
 * Build a self-contained order_id that encodes {url, email, timestamp}
 * as URL-safe base64. The webhook decodes it back — no KV store needed.
 */
export function newOrderId(auditUrl, email, prefix = "sxa") {
  const payload = JSON.stringify({ url: auditUrl, email, ts: Date.now() });
  return `${prefix}_${base64urlEncode(payload)}`;
}

/**
 * Decode the audit metadata back out of an order_id.
 * Throws if the order_id is malformed.
 */
export function extractAuditData(orderId) {
  const idx = orderId.indexOf("_");
  if (idx < 0) throw new Error("order_id missing prefix separator");
  const encoded = orderId.slice(idx + 1);
  const json = base64urlDecode(encoded);
  return JSON.parse(json);
}

/**
 * Creates an invoice via NOWPayments and returns the hosted-checkout URL.
 *
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {number|string} opts.amount     USD amount, e.g. 39
 * @param {string} opts.orderId            unique order id (use newOrderId())
 * @param {string} [opts.orderDescription] human-readable, shown on checkout
 * @param {string} opts.ipnCallbackUrl    your /api/nowpayments-webhook URL
 * @param {string} opts.successUrl         redirect target on payment success
 * @param {string} opts.cancelUrl          redirect target on cancel
 * @returns {Promise<{id:string, url:string, orderId:string}>}
 */
export async function createInvoice(opts) {
  const {
    apiKey, amount, orderId, orderDescription,
    ipnCallbackUrl, successUrl, cancelUrl,
  } = opts;

  if (!apiKey) {
    throw new Error("NOWPAYMENTS_API_KEY missing");
  }

  const body = {
    price_amount: Number(amount),
    price_currency: "usd",
    order_id: orderId,
    order_description: orderDescription || "SiteX-Ray full audit",
    ipn_callback_url: ipnCallbackUrl,
    success_url: successUrl,
    cancel_url: cancelUrl,
    is_fixed_rate: false,
    is_fee_paid_by_user: false,
  };

  const resp = await fetch(`${API_BASE}/invoice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`NOWPayments API ${resp.status}: ${text.slice(0, 400)}`);
  }
  const data = await resp.json();
  if (!data.invoice_url) {
    throw new Error(`NOWPayments returned no invoice_url: ${JSON.stringify(data).slice(0, 400)}`);
  }
  return {
    id: data.id,
    url: data.invoice_url,
    orderId: data.order_id,
  };
}

/**
 * Verifies the `x-nowpayments-sig` header on an incoming IPN.
 * Returns true if the signature matches.
 *
 * Algorithm per NOWPayments docs:
 *   sig = HMAC_SHA512( JSON.stringify(sorted(body)), ipn_secret )
 */
export async function verifyWebhookSignature(rawBody, signature, ipnSecret) {
  if (!rawBody || !signature || !ipnSecret) return false;
  let parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return false;
  }
  const sortedJson = JSON.stringify(sortKeysDeep(parsed));
  const expected = await hmacSha512Hex(ipnSecret, sortedJson);
  return expected === String(signature).toLowerCase();
}
