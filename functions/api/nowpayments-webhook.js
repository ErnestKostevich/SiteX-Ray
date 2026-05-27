// POST /api/nowpayments-webhook
// Receives NOWPayments IPN (Instant Payment Notifications).
// Verifies the x-nowpayments-sig HMAC-SHA512 header.
// On payment success, fires the full audit for the customer.

import { verifyWebhookSignature, extractAuditData } from "../_shared/nowpayments.js";
import { runAuditAndEmail } from "../_shared/auditFlow.js";
import { notifyFounderOfFailure } from "../_shared/notifyFounder.js";

// NOWPayments payment_status values that count as "delivered":
//   waiting, confirming, confirmed, sending, partially_paid, finished,
//   failed, refunded, expired
// We fire the audit on the first "money received" state.
const PAID_STATUSES = new Set(["finished", "confirmed", "partially_paid"]);

export async function onRequestPost(context) {
  const { request, env, waitUntil } = context;

  const rawBody = await request.text();
  const signature = request.headers.get("x-nowpayments-sig");

  if (!env.NOWPAYMENTS_IPN_SECRET) {
    return new Response("NOWPAYMENTS_IPN_SECRET not configured", { status: 500 });
  }

  const valid = await verifyWebhookSignature(
    rawBody,
    signature,
    env.NOWPAYMENTS_IPN_SECRET
  );
  if (!valid) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const status = String(event.payment_status || "").toLowerCase();
  if (!PAID_STATUSES.has(status)) {
    // Acknowledge so NOWPayments doesn't retry; nothing to do for
    // waiting/confirming/failed/refunded/expired states here.
    return new Response(`ignored: status=${status}`, { status: 200 });
  }

  // Decode audit metadata (URL + email) from the order_id we encoded
  // when creating the invoice.
  let auditData;
  try {
    auditData = extractAuditData(event.order_id);
  } catch (err) {
    console.error("Failed to decode order_id:", event.order_id, err);
    return new Response("malformed order_id", { status: 200 });
  }

  const auditUrl = auditData && auditData.url;
  const email = auditData && auditData.email;

  if (!auditUrl || !email) {
    console.error("Missing audit_url or email in decoded order_id:", auditData);
    return new Response("missing data", { status: 200 });
  }

  // Generate + email asynchronously so we can ACK NOWPayments fast.
  // If the worker dies, NOWPayments retries the webhook.
  //
  // If the audit pipeline itself fails (AI down, Resend down, scrape blocked,
  // etc.), we don't want to silently lose a paid order — so the catch handler
  // emails the founder with all the context they need to manually fulfil.
  waitUntil(
    runAuditAndEmail({ url: auditUrl, email, free: false, env })
      .catch(async (err) => {
        console.error(
          "Full audit failed (NOWPayments order):",
          err && err.stack ? err.stack : err
        );
        await notifyFounderOfFailure(env, {
          orderId: event.order_id,
          paymentId: event.payment_id,
          customerEmail: email,
          customerUrl: auditUrl,
          error: err && err.message ? err.message : String(err),
          extra: { payment_status: status, payment_amount: event.payment_amount },
        });
      })
  );

  return new Response("ok", { status: 200 });
}
