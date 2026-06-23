// POST /api/test-email  Body: { email?, secret }
// Dev-only deliverability check. Disabled unless ADMIN_SECRET is set and matches.

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

  if (!env.ADMIN_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    /* empty */
  }

  if (body.secret !== env.ADMIN_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const to = (body.email || "").trim();
  if (!to) {
    return new Response(JSON.stringify({ ok: false, error: "email required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const hasBrevo = !!env.BREVO_API_KEY;
  const sender =
    env.BREVO_SENDER_EMAIL || env.FROM_EMAIL || "ernestkostevich@gmail.com";
  const from = sender.includes("@")
    ? `SiteX-Ray <${sender}>`
    : "SiteX-Ray <ernestkostevich@gmail.com>";

  try {
    const result = await sendReportEmail({
      toEmail: to,
      subject: "SiteX-Ray — admin email test",
      html: "<p>Admin test only. SiteX-Ray mailer is configured.</p>",
      fromEmail: from,
      replyTo: env.REPLY_TO_EMAIL || "ernest2011kostevich@gmail.com",
      brevoApiKey: env.BREVO_API_KEY,
      apiToken: env.CLOUDFLARE_API_TOKEN,
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      brevoTags: ["admin-test"],
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