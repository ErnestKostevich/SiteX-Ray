// POST /api/test-email  Body: { email? }
// Sends a test message via Brevo (for production diagnostics).

import { sendReportEmail } from "../_shared/mailer.js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const onRequestOptions = () =>
  new Response(null, { status: 204, headers: cors });

export async function onRequestPost(context) {
  const { env, request } = context;
  let body = {};
  try {
    body = await request.json();
  } catch {
    /* empty */
  }

  const to = (body.email || "ernest2011kostevich@gmail.com").trim();
  const hasBrevo = !!env.BREVO_API_KEY;
  const from =
    env.FROM_EMAIL ||
    env.BREVO_SENDER_EMAIL ||
    "SiteX-Ray <ernest2011kostevich@gmail.com>";

  try {
    const result = await sendReportEmail({
      toEmail: to,
      subject: "SiteX-Ray — email delivery test",
      html: "<p>If you received this, <strong>SiteX-Ray email delivery works</strong>.</p>",
      fromEmail: from,
      replyTo: env.REPLY_TO_EMAIL || "ernest2011kostevich@gmail.com",
      brevoApiKey: env.BREVO_API_KEY,
      apiToken: env.CLOUDFLARE_API_TOKEN,
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
    });
    return new Response(
      JSON.stringify({ ok: true, sent: true, hasBrevo, to, result }),
      { status: 200, headers: { "Content-Type": "application/json", ...cors } }
    );
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    return new Response(
      JSON.stringify({ ok: false, sent: false, hasBrevo, to, error: msg, from }),
      { status: 500, headers: { "Content-Type": "application/json", ...cors } }
    );
  }
}