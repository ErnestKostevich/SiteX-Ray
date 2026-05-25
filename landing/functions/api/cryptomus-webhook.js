// POST /api/cryptomus-webhook
// Receives Cryptomus payment notifications. Verifies the in-body `sign`
// field, then triggers the full audit for the customer if status is paid.

import { verifyWebhookSign } from "../_shared/cryptomus.js";
import { runAuditAndEmail } from "../_shared/auditFlow.js";

const PAID_STATUSES = new Set(["paid", "paid_over"]);

export async function onRequestPost(context) {
  const { request, env, waitUntil } = context;

  const rawBody = await request.text();

  if (!env.CRYPTOMUS_API_KEY) {
    return new Response("CRYPTOMUS_API_KEY not configured", { status: 500 });
  }

  if (!verifyWebhookSign(rawBody, env.CRYPTOMUS_API_KEY)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Only fire the audit on successful payments. Pending / failed / cancelled
  // events are acknowledged but ignored.
  const status = String(event.status || "").toLowerCase();
  if (!PAID_STATUSES.has(status)) {
    return new Response("ignored: status=" + status, { status: 200 });
  }

  // additional_data is a JSON string we stuffed during invoice creation
  let customData = {};
  if (event.additional_data) {
    try {
      customData = typeof event.additional_data === "string"
        ? JSON.parse(event.additional_data)
        : event.additional_data;
    } catch {
      customData = {};
    }
  }
  const auditUrl = customData.audit_url || customData.url;
  const email = customData.email;

  if (!auditUrl || !email) {
    console.error("Cryptomus webhook missing audit_url or email", { customData });
    // Still return 200 so Cryptomus doesn't retry forever on a malformed event.
    return new Response("missing audit_url or email", { status: 200 });
  }

  // Acknowledge fast — do the actual audit work in the background.
  // If the worker dies, Cryptomus has already accepted the payment, so we
  // rely on email-alerting (Cryptomus retries on non-200 only).
  waitUntil(
    runAuditAndEmail({ url: auditUrl, email, free: false, env }).catch((err) => {
      console.error("Full audit failed (Cryptomus order):", err && err.stack ? err.stack : err);
    })
  );

  return new Response("ok", { status: 200 });
}
