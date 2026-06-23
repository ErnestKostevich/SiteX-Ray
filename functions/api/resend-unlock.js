// POST /api/resend-unlock  Body: { email }
// Sends a new unlock token if this email has a lifetime license.

import { isLicensed, normalizeEmail, rotateUnlockToken } from "../_shared/licenses.js";
import { sendUnlockEmail } from "../_shared/unlockEmail.js";

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

  const email = normalizeEmail(body.email);
  if (!email || !email.includes("@")) {
    return new Response(JSON.stringify({ ok: false, error: "Valid email required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  if (!(await isLicensed(email))) {
    return new Response(
      JSON.stringify({ ok: false, error: "No lifetime license for this email" }),
      { status: 404, headers: { "Content-Type": "application/json", ...cors } }
    );
  }

  const unlockToken = await rotateUnlockToken(email);
  if (!unlockToken) {
    return new Response(JSON.stringify({ ok: false, error: "Could not rotate token" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  try {
    await sendUnlockEmail({
      email,
      unlockToken,
      env,
      siteUrl: env.SITE_URL || new URL(request.url).origin,
    });
    return new Response(
      JSON.stringify({ ok: true, sent: true, email }),
      { status: 200, headers: { "Content-Type": "application/json", ...cors } }
    );
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, sent: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }
}