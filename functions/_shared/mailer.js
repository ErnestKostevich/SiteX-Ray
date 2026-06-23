// Sends transactional email via Cloudflare Email Service (Workers binding).
// Requires: [[send_email]] name = "EMAIL" in wrangler.toml + domain onboarded
// in Cloudflare Email Service. No third-party API keys.

const DEFAULT_FROM = {
  email: "reports@sitexray.xyz",
  name: "SiteX-Ray",
};

/** Parse "Name <addr@domain>" or bare address into { email, name }. */
export function parseFromAddress(fromEmail) {
  if (!fromEmail) return { ...DEFAULT_FROM };

  const trimmed = String(fromEmail).trim();
  const named = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
  if (named) {
    return { name: named[1].trim(), email: named[2].trim() };
  }
  if (trimmed.includes("@")) {
    return { email: trimmed, name: DEFAULT_FROM.name };
  }
  return { ...DEFAULT_FROM };
}

/** Minimal HTML → plain text for deliverability (spam filters expect both). */
export function htmlToPlainText(html) {
  return String(html || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function sendReportEmail(opts) {
  const {
    toEmail,
    subject,
    html,
    emailBinding,
    fromEmail,
    replyTo,
  } = opts;

  if (!emailBinding) {
    throw new Error(
      "EMAIL binding is not configured. Add send_email binding in wrangler.toml and Cloudflare Pages → Settings → Bindings."
    );
  }
  if (!toEmail) throw new Error("toEmail is required");
  if (!subject) throw new Error("subject is required");

  const from = parseFromAddress(fromEmail);
  const text = htmlToPlainText(html);

  try {
    const response = await emailBinding.send({
      to: toEmail,
      from,
      subject,
      html,
      text: text || subject,
      ...(replyTo ? { replyTo } : {}),
    });
    return response;
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    throw new Error(`Cloudflare Email Service: ${msg}`);
  }
}