/** Patch BREVO_API_KEY to Pages (no local send test — avoids IP block). */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ACCOUNT = "6609012adc88f397f50eba13ea2c242f";
const PROJECT = "sitexray";
const API = "https://api.cloudflare.com/client/v4";
const BREVO_KEY = process.argv[2];
const SENDER = process.argv[3] || "ernest2011kostevich@gmail.com";

if (!BREVO_KEY?.startsWith("xkeysib-")) {
  console.error("Usage: node cf-brevo-patch.mjs <xkeysib-...> [sender@email]");
  process.exit(1);
}

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
          FROM_EMAIL: { type: "plain_text", value: SENDER },
          REPLY_TO_EMAIL: { type: "plain_text", value: SENDER },
        },
      },
    },
  }),
}).then((r) => r.json());

console.log("Patch:", patch.success ? "ok" : patch.errors?.[0]?.message);

const depId = proj.result?.latest_deployment?.id;
if (depId && patch.success) {
  const retry = await fetch(
    `${API}/accounts/${ACCOUNT}/pages/projects/${PROJECT}/deployments/${depId}/retry`,
    { method: "POST", headers: { Authorization: `Bearer ${oauth}` } }
  ).then((r) => r.json());
  console.log("Retry:", retry.success ? "started" : retry.errors?.[0]?.message);
}