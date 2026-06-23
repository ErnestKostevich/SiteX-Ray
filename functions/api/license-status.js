// GET /api/license-status?email=&token=
// POST /api/license-status  Body: { email, unlockToken } — same check

import { isLicensed, normalizeEmail, verifyLicense } from "../_shared/licenses.js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });

export const onRequestOptions = () =>
  new Response(null, { status: 204, headers: cors });

async function check(email, token) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return json(400, { ok: false, error: "Email is required" });
  }

  if (token) {
    const valid = await verifyLicense(normalized, token);
    return json(200, {
      ok: true,
      licensed: valid,
      verified: valid,
      email: normalized,
      lifetime: valid,
    });
  }

  const licensed = await isLicensed(normalized);
  return json(200, {
    ok: true,
    licensed,
    verified: false,
    email: normalized,
    lifetime: licensed,
  });
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  return check(
    url.searchParams.get("email"),
    url.searchParams.get("token") || url.searchParams.get("unlockToken")
  );
}

export async function onRequestPost(context) {
  let body = {};
  try {
    body = await context.request.json();
  } catch {
    /* empty */
  }
  return check(body.email, body.unlockToken || body.token);
}