import { sendReportEmail } from "./mailer.js";

export function renderUnlockEmail(opts) {
  const { unlockToken, siteUrl = "https://sitexray.xyz" } = opts;
  const link = `${siteUrl.replace(/\/$/, "")}/?unlock=${encodeURIComponent(unlockToken)}`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#111;margin:0;padding:20px;">
<p><strong>SiteX-Ray — lifetime full access unlocked</strong></p>
<p>You paid 39 USDT once. This is <strong>not a subscription</strong> — your email is unlocked <strong>forever</strong>.</p>
<p><strong>What you get:</strong> unlimited full audits with your own Anthropic API key (BYOK). We use Claude Sonnet 4.6, effort medium. Your key is used only for that request and is never stored on our servers.</p>
<p><a href="${link}" style="color:#6d28d9;"><strong>Activate on SiteX-Ray</strong></a></p>
<p style="color:#555;font-size:14px;">Save this unlock code (treat like a password):<br>
<code style="word-break:break-all;">${unlockToken}</code></p>
<p style="color:#888;font-size:13px;">Free tier stays Llama teaser only. Full Claude audits require this unlock + your key.<br>SiteX-Ray · sitexray.xyz</p>
</body></html>`;
}

export async function sendUnlockEmail(opts) {
  const { email, unlockToken, env, siteUrl } = opts;
  const sender =
    env.BREVO_SENDER_EMAIL || env.FROM_EMAIL || "ernestkostevich@gmail.com";
  const fromEmail = sender.includes("@")
    ? `SiteX-Ray <${sender}>`
    : "SiteX-Ray <ernestkostevich@gmail.com>";

  return sendReportEmail({
    toEmail: email,
    subject: "SiteX-Ray — lifetime full access unlocked (save this email)",
    html: renderUnlockEmail({ unlockToken, siteUrl }),
    fromEmail,
    replyTo: env.REPLY_TO_EMAIL || "ernest2011kostevich@gmail.com",
    brevoApiKey: env.BREVO_API_KEY,
    apiToken: env.CLOUDFLARE_API_TOKEN || env.CF_API_TOKEN,
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    brevoTags: ["lifetime-unlock"],
  });
}