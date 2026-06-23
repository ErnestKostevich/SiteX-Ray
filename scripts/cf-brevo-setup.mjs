/**
 * Add BREVO_API_KEY to Cloudflare Pages and test send.
 * Usage: node scripts/cf-brevo-setup.mjs <BREVO_API_KEY> [sender@email.com]
 *
 * Get free API key: https://app.brevo.com/settings/keys/api
 * Free tier: 300 emails/day. Verify sitexray.xyz domain in Brevo → Senders for best deliverability.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ACCOUNT = "6609012adc88f397f50eba13ea2c242f";
const PROJECT = "sitexray";
const API = "https://api.cloudflare.com/client/v4";
const BREVO_KEY = process.argv[2];
const SENDER = process.argv[3] || "reports@sitexray.xyz";
const TEST_TO = process.argv[4] || "ernest2011kostevich@gmail.com";

if (!BREVO_KEY || !BREVO_KEY.startsWith("xkeysib-")) {
  console.error("Usage: node cf-brevo-setup.mjs <xkeysib-...> [sender@domain] [test@email]");
  process.exit(1);
}

// Test Brevo first
const testRes = await fetch("https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: {
    "api-key": BREVO_KEY,
    "Content-Type": "application/json",
    accept: "application/json",
  },
  body: JSON.stringify({
    sender: { name: "SiteX-Ray", email: SENDER },
    to: [{ email: TEST_TO }],
    subject: "SiteX-Ray — Brevo email test",
    htmlContent: "<p>If you see this, <strong>Brevo email</strong> works for SiteX-Ray!</p>",
    textContent: "If you see this, Brevo email works for SiteX-Ray!",
  }),
});
const testJson = await testRes.json().catch(() => ({}));
if (!testRes.ok) {
  console.error("Brevo test FAILED:", testJson.message || testJson.code || testRes.status);
  console.error("Tip: verify sender", SENDER, "in Brevo → Senders, or pass your verified email as 3rd arg.");
  process.exit(1);
}
console.log("Brevo test: SENT to", TEST_TO);

const oauth = readFileSync(
  join(homedir(), "AppData/Roaming/xdg.config/.wrangler/config/default.toml"),
  "utf8"
).match(/oauth_token\s*=\s*"([^"]+)"/)[1];

const proj = await fetch(`${API}/accounts/${ACCOUNT}/pages/projects/${PROJECT}`, {
  headers: { Authorization: `Bearer ${oauth}` },
}).then((r) => r.json());

const ev = proj.result?.deployment_configs?.production?.env_vars || {};

const patch = await fetch(`${API}/accounts/${ACCOUNT}/pages/projects/${PROJECT}`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${oauth}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    deployment_configs: {
      production: {
        env_vars: {
          ...ev,
          BREVO_API_KEY: { type: "secret_text", value: BREVO_KEY },
          BREVO_SENDER_EMAIL: { type: "plain_text", value: SENDER },
          FROM_EMAIL: { type: "plain_text", value: `SiteX-Ray <${SENDER}>` },
          REPLY_TO_EMAIL: { type: "plain_text", value: "support@sitexray.xyz" },
          RESEND_API_KEY: null,
          RESEND_FROM_EMAIL: null,
        },
      },
    },
  }),
}).then((r) => r.json());

console.log("Pages patch:", patch.success ? "ok" : patch.errors?.[0]?.message);

const depId = proj.result?.latest_deployment?.id;
if (depId) {
  const retry = await fetch(
    `${API}/accounts/${ACCOUNT}/pages/projects/${PROJECT}/deployments/${depId}/retry`,
    { method: "POST", headers: { Authorization: `Bearer ${oauth}` } }
  ).then((r) => r.json());
  console.log("Retry deploy:", retry.success ? "started" : retry.errors?.[0]?.message);
}