// Transactional email — free-tier friendly provider chain:
//   1. Brevo API (300 emails/day free, no Workers Paid)
//   2. Cloudflare Email binding (Workers Paid only)
//   3. Cloudflare Email REST API (Workers Paid only)

const DEFAULT_FROM = {
  email: "ernestkostevich@gmail.com",
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

const DEFAULT_ACCOUNT_ID = "6609012adc88f397f50eba13ea2c242f";

async function sendViaBrevo(opts) {
  const { toEmail, subject, html, fromEmail, replyTo, apiKey } = opts;
  const from = parseFromAddress(fromEmail);
  const text = htmlToPlainText(html);

  const reply = replyTo ? parseFromAddress(replyTo) : null;
  const body = {
    sender: { name: from.name, email: from.email },
    to: [{ email: toEmail }],
    subject,
    htmlContent: html,
    textContent: text || subject,
    ...(reply?.email ? { replyTo: { email: reply.email, ...(reply.name ? { name: reply.name } : {}) } } : {}),
  };

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json.message || json.error || `Brevo HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

async function sendViaRestApi(opts) {
  const { toEmail, subject, html, fromEmail, replyTo, accountId, apiToken } = opts;
  const from = parseFromAddress(fromEmail);
  const text = htmlToPlainText(html);

  const body = {
    to: toEmail,
    from: from.name
      ? { address: from.email, name: from.name }
      : from.email,
    subject,
    html,
    text: text || subject,
    ...(replyTo ? { reply_to: replyTo } : {}),
  };

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  const json = await res.json();
  if (!json.success) {
    const msg = json.errors?.[0]?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json.result;
}

export async function sendReportEmail(opts) {
  const {
    toEmail,
    subject,
    html,
    emailBinding,
    fromEmail,
    replyTo,
    accountId = DEFAULT_ACCOUNT_ID,
    apiToken,
    brevoApiKey,
  } = opts;

  if (!toEmail) throw new Error("toEmail is required");
  if (!subject) throw new Error("subject is required");

  const from = parseFromAddress(fromEmail);
  const text = htmlToPlainText(html);
  const brevoKey = brevoApiKey;

  if (brevoKey) {
    try {
      return await sendViaBrevo({
        toEmail,
        subject,
        html,
        fromEmail: fromEmail || `${from.name} <${from.email}>`,
        replyTo,
        apiKey: brevoKey,
      });
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      throw new Error(`Brevo: ${msg}`);
    }
  }

  if (emailBinding) {
    try {
      return await emailBinding.send({
        to: toEmail,
        from,
        subject,
        html,
        text: text || subject,
        ...(replyTo ? { replyTo } : {}),
      });
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      throw new Error(`Cloudflare Email Service: ${msg}`);
    }
  }

  const token = apiToken;
  if (token) {
    try {
      return await sendViaRestApi({
        toEmail,
        subject,
        html,
        fromEmail,
        replyTo,
        accountId,
        apiToken: token,
      });
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      throw new Error(`Cloudflare Email REST API: ${msg}`);
    }
  }

  throw new Error(
    "Email not configured. Add BREVO_API_KEY (free at brevo.com — 300 emails/day) in Pages → Settings → Environment variables, then Retry deployment."
  );
}