// Sends an email via Resend (https://resend.com).
// Resend free tier: 3000 emails/month, 100/day.

export async function sendReportEmail(opts) {
  const {
    toEmail,
    subject,
    html,
    resendKey,
    fromEmail = "SiteX-Ray <onboarding@resend.dev>",
  } = opts;

  if (!resendKey) throw new Error("RESEND_API_KEY is not set");
  if (!toEmail) throw new Error("toEmail is required");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend ${response.status}: ${body.slice(0, 500)}`);
  }

  return await response.json();
}
