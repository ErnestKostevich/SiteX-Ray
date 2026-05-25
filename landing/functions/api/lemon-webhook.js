// POST /api/lemon-webhook — Lemon Squeezy webhook for paid full audits.
// Expects header X-Signature (HMAC-SHA256 of the raw body, hex).
// On order_created → generate full audit + email to the customer.

import { verifyLemonSignature } from "../_shared/lemon.js";
import { runAuditAndEmail } from "../_shared/auditFlow.js";

export async function onRequestPost(context) {
  const { request, env, waitUntil } = context;

  const signature = request.headers.get("X-Signature");
  const rawBody = await request.text();

  if (!env.LEMON_WEBHOOK_SECRET) {
    return new Response("LEMON_WEBHOOK_SECRET not configured", { status: 500 });
  }
  const valid = await verifyLemonSignature(rawBody, signature, env.LEMON_WEBHOOK_SECRET);
  if (!valid) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventName = event?.meta?.event_name;

  // Only act on completed paid orders
  const PAID_EVENTS = new Set(["order_created", "subscription_created"]);
  if (!PAID_EVENTS.has(eventName)) {
    return new Response("ignored", { status: 200 });
  }

  // Extract audit URL from custom_data and customer email
  const customData = event?.meta?.custom_data || {};
  const auditUrl = customData.audit_url || customData.url;
  const email =
    event?.data?.attributes?.user_email ||
    event?.data?.attributes?.customer_email;

  if (!auditUrl || !email) {
    console.error("Lemon webhook missing audit_url or email", { customData, eventName });
    return new Response("missing audit_url or email in custom_data", { status: 400 });
  }

  // For paid orders we accept the webhook fast (LS retries on non-200),
  // and do the actual work in the background. If the worker dies, LS will retry.
  waitUntil(
    runAuditAndEmail({ url: auditUrl, email, free: false, env }).catch((err) => {
      console.error("Full audit failed:", err && err.stack ? err.stack : err);
    })
  );

  return new Response("ok", { status: 200 });
}
