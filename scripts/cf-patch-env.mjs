import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ACCOUNT_ID = "6609012adc88f397f50eba13ea2c242f";
const PROJECT = "sitexray";
const API = "https://api.cloudflare.com/client/v4";

function loadToken() {
  const raw = readFileSync(
    join(homedir(), "AppData/Roaming/xdg.config/.wrangler/config/default.toml"),
    "utf8"
  );
  return raw.match(/oauth_token\s*=\s*"([^"]+)"/)[1];
}

const token = loadToken();

const get = await fetch(`${API}/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const project = await get.json();
console.log("Project id:", project.result?.id);
console.log("Production env:", Object.keys(project.result?.deployment_configs?.production?.env_vars || {}));

const body = {
  deployment_configs: {
    production: {
      env_vars: {
        FROM_EMAIL: { type: "plain_text", value: "SiteX-Ray <reports@sitexray.xyz>" },
        REPLY_TO_EMAIL: { type: "plain_text", value: "support@sitexray.xyz" },
        RESEND_API_KEY: null,
        RESEND_FROM_EMAIL: null,
      },
    },
  },
};

const patch = await fetch(`${API}/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});
const res = await patch.json();
console.log("PATCH:", JSON.stringify(res, null, 2));