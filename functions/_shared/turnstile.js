// Verifies a Cloudflare Turnstile token (anti-bot for the free-teaser form).
// Skipped if TURNSTILE_SECRET is not set (useful for local dev).

const VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(token, secret, remoteIp) {
  if (!secret) return { success: true, skipped: true };
  if (!token) return { success: false, error: "missing-token" };

  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);
  if (remoteIp) formData.append("remoteip", remoteIp);

  const response = await fetch(VERIFY_URL, {
    method: "POST",
    body: formData,
  });
  const data = await response.json();
  return data;
}
