// Sends a failure-notification email to the founder so they can manually
// re-fulfill a paid order that the automated pipeline couldn't deliver.
//
// Called from `nowpayments-webhook.js` whenever runAuditAndEmail throws.
// Best-effort: if THIS email also fails, we just log and move on (so the
// notify-attempt never throws up the stack and breaks the webhook).

import { sendReportEmail } from "./mailer.js";

const FOUNDER_EMAIL =
  // Hardcoded fallback. Can be overridden via FOUNDER_EMAIL env var if you
  // want failure alerts to land somewhere else.
  "ernest2011kostevich@gmail.com";

export async function notifyFounderOfFailure(env, ctx) {
  const {
    orderId,
    paymentId,
    customerEmail,
    customerUrl,
    error,
    extra = {},
  } = ctx || {};

  const to = env.FOUNDER_EMAIL || FOUNDER_EMAIL;
  const safeErr = String(error || "(unknown)").slice(0, 2000);

  const html = `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif; color:#0f172a; max-width:640px; margin:0 auto; padding:24px;">
  <div style="background:#fef3c7; border:1px solid #fde68a; color:#92400e; padding:12px 16px; border-radius:8px; margin-bottom:24px;">
    <strong>⚠ Paid order failed to deliver.</strong> A customer paid via NOWPayments
    but the automated pipeline could not generate or email their audit.
    You'll need to fulfill this manually.
  </div>

  <h2 style="margin:0 0 12px; font-size:18px;">Order details</h2>
  <table cellpadding="6" cellspacing="0" style="font-size:14px; border-collapse:collapse; width:100%;">
    <tr><td><strong>Customer email</strong></td><td><code>${escapeHtml(customerEmail || "(missing)")}</code></td></tr>
    <tr><td><strong>Site URL to audit</strong></td><td><code>${escapeHtml(customerUrl || "(missing)")}</code></td></tr>
    <tr><td><strong>Order ID</strong></td><td><code>${escapeHtml(orderId || "(missing)")}</code></td></tr>
    <tr><td><strong>NOWPayments payment ID</strong></td><td><code>${escapeHtml(paymentId || "(missing)")}</code></td></tr>
    <tr><td><strong>When</strong></td><td>${new Date().toUTCString()}</td></tr>
  </table>

  <h2 style="margin:24px 0 12px; font-size:18px;">Error</h2>
  <pre style="background:#0f172a; color:#f1f5f9; padding:14px; border-radius:8px; font-size:12.5px; overflow-x:auto;">${escapeHtml(safeErr)}</pre>

  <h2 style="margin:24px 0 12px; font-size:18px;">How to fulfill manually</h2>
  <ol style="font-size:14px; line-height:1.6;">
    <li>Open Cloudflare Pages → sitexray → Logs to see the full error trace.</li>
    <li>Verify payment in NOWPayments dashboard → Payments → search by order_id.</li>
    <li>On your local machine: <code>python audit.py ${escapeHtml(customerUrl || "URL")} --out report.html</code></li>
    <li>Open <code>report.html</code> in your browser, save as PDF (Ctrl+P).</li>
    <li>Email the PDF to <code>${escapeHtml(customerEmail || "the customer")}</code> with a brief apology.</li>
  </ol>

  ${
    extra && Object.keys(extra).length
      ? `<h2 style="margin:24px 0 12px; font-size:18px;">Extra context</h2>
         <pre style="background:#f1f5f9; padding:12px; border-radius:8px; font-size:12px;">${escapeHtml(JSON.stringify(extra, null, 2))}</pre>`
      : ""
  }

  <p style="margin-top:32px; color:#64748b; font-size:12px;">
    Auto-sent by your SiteX-Ray backend. To disable: remove the
    notifyFounderOfFailure call from functions/api/nowpayments-webhook.js.
  </p>
</body></html>`;

  try {
    await sendReportEmail({
      toEmail: to,
      subject: `🚨 SiteX-Ray order failed — ${customerEmail || "unknown customer"} (${orderId || "no id"})`,
      html,
      resendKey: env.RESEND_API_KEY,
      fromEmail: env.RESEND_FROM_EMAIL,
    });
  } catch (mailErr) {
    // Last resort — if even THIS email failed, just log it.
    console.error(
      "notifyFounderOfFailure: also failed to email founder:",
      mailErr && mailErr.stack ? mailErr.stack : mailErr
    );
  }
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
