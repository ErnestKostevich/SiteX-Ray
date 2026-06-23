// Full Cloudflare setup: DNS + Pages bindings + Email via API.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ACCOUNT_ID = "6609012adc88f397f50eba13ea2c242f";
const PROJECT = "sitexray";
const DOMAIN = "sitexray.xyz";
const ZONE_ID = "54e86ad24eefe96b27c59280f416735e";
const API = "https://api.cloudflare.com/client/v4";

function loadToken() {
  const raw = readFileSync(
    join(homedir(), "AppData/Roaming/xdg.config/.wrangler/config/default.toml"),
    "utf8"
  );
  return raw.match(/oauth_token\s*=\s*"([^"]+)"/)[1];
}

async function api(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return { status: res.status, json };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const token = loadToken();

  // 1) Create short-lived API token with Zone DNS Edit (if OAuth allows)
  console.log("=== Create API token for DNS ===");
  const tokenRes = await api(token, "POST", "/user/tokens", {
    name: `sitexray-setup-${Date.now()}`,
    policies: [
      {
        effect: "allow",
        resources: {
          [`com.cloudflare.api.account.zone.${ZONE_ID}`]: "*",
        },
        permission_groups: [
          { id: "82e64a83756745bbbb1c4c9a486f4b0f" }, // Zone DNS Edit - may vary
        ],
      },
    ],
    not_before: null,
    expires_on: new Date(Date.now() + 3600_000).toISOString(),
  });
  console.log("Token create:", JSON.stringify(tokenRes.json, null, 2));

  let dnsToken = tokenRes.json.result?.value || token;

  // 2) DNS records
  console.log("\n=== DNS records ===");
  const list = await api(dnsToken, "GET", `/zones/${ZONE_ID}/dns_records?per_page=100`);
  console.log("List:", list.json.success, list.json.errors?.[0]?.message || `${(list.json.result || []).length} records`);

  for (const r of list.json.result || []) {
    if (r.type === "A" && (r.name === DOMAIN || r.name === `www.${DOMAIN}`)) {
      const del = await api(dnsToken, "DELETE", `/zones/${ZONE_ID}/dns_records/${r.id}`);
      console.log(`  deleted A ${r.name}: ${del.json.success}`);
    }
  }

  const want = [
    { type: "CNAME", name: DOMAIN, content: "sitexray.pages.dev" },
    { type: "CNAME", name: `www.${DOMAIN}`, content: "sitexray.pages.dev" },
  ];

  for (const w of want) {
    const exists = (list.json.result || []).find(
      (r) => r.type === w.type && r.name === w.name && r.content === w.content
    );
    if (exists) {
      console.log(`  exists: ${w.name} -> ${w.content}`);
      continue;
    }
    const add = await api(dnsToken, "POST", `/zones/${ZONE_ID}/dns_records`, {
      ...w,
      proxied: true,
      ttl: 1,
    });
    console.log(
      `  add ${w.name}:`,
      add.json.success ? "ok" : add.json.errors?.map((e) => e.message).join("; ")
    );
  }

  // 3) Pages bindings via PATCH project
  console.log("\n=== Pages production bindings ===");
  const proj = await api(token, "GET", `/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}`);
  const prod = proj.json.result?.deployment_configs?.production || {};
  console.log("Current ai_bindings:", prod.ai_bindings);
  console.log("Current env_vars keys:", Object.keys(prod.env_vars || {}));

  const patch = await api(token, "PATCH", `/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}`, {
    deployment_configs: {
      production: {
        compatibility_date: "2025-01-01",
        ai_bindings: { AI: { project_id: ACCOUNT_ID } },
        env_vars: {
          FROM_EMAIL: { type: "plain_text", value: `SiteX-Ray <reports@${DOMAIN}>` },
          REPLY_TO_EMAIL: { type: "plain_text", value: `support@${DOMAIN}` },
        },
      },
    },
  });
  console.log("PATCH project:", patch.json.success ? "ok" : patch.json.errors?.[0]?.message);

  // 4) Email sending - try account endpoints
  console.log("\n=== Email sending ===");
  const endpoints = [
    ["GET", `/accounts/${ACCOUNT_ID}/email/sending/domains`],
    ["POST", `/zones/${ZONE_ID}/email/sending/subdomains`, { name: DOMAIN }],
    ["POST", `/accounts/${ACCOUNT_ID}/email/sending/domains/${DOMAIN}/enable`],
  ];
  for (const [method, path, body] of endpoints) {
    const res = await api(token, method, path, body);
    console.log(`${method} ${path}:`, res.json.success, res.json.errors?.[0]?.message || "");
  }

  // 5) Poll domain status
  console.log("\n=== Domain activation ===");
  for (let i = 0; i < 18; i++) {
    const { json } = await api(
      token,
      "GET",
      `/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}/domains`
    );
    const rows = (json.result || []).map((d) => `${d.name}:${d.status}`).join(", ");
    console.log(`  [${i + 1}] ${rows}`);
    if ((json.result || []).every((d) => d.status === "active")) break;
    await sleep(10000);
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});