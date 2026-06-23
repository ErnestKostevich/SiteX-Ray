// Cloudflare production setup via API (uses wrangler OAuth token).
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ACCOUNT_ID = "6609012adc88f397f50eba13ea2c242f";
const PROJECT = "sitexray";
const DOMAIN = "sitexray.xyz";
const API = "https://api.cloudflare.com/client/v4";

function loadToken() {
  const cfgPath = join(
    homedir(),
    "AppData/Roaming/xdg.config/.wrangler/config/default.toml"
  );
  const raw = readFileSync(cfgPath, "utf8");
  const m = raw.match(/oauth_token\s*=\s*"([^"]+)"/);
  if (!m) throw new Error("No oauth_token — run: npx wrangler login");
  return m[1];
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

  // Zone lookup
  const zones = await api(token, "GET", `/zones?name=${DOMAIN}`);
  const zone = zones.json.result?.[0];
  if (!zone) throw new Error(`Zone ${DOMAIN} not found in Cloudflare account`);
  const zoneId = zone.id;
  console.log(`Zone: ${DOMAIN} (${zoneId})`);

  // Pages custom domains
  console.log("\n=== Pages custom domains ===");
  for (const name of [DOMAIN, `www.${DOMAIN}`]) {
    const { json } = await api(
      token,
      "POST",
      `/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}/domains`,
      { name }
    );
    if (json.success) {
      console.log(`  + ${name}: ${json.result.status}`);
    } else {
      console.log(`  ~ ${name}: ${json.errors?.map((e) => e.message).join("; ")}`);
    }
  }

  // Poll until active (max ~2 min)
  for (let i = 0; i < 12; i++) {
    const { json } = await api(
      token,
      "GET",
      `/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}/domains`
    );
    const rows = (json.result || []).map((d) => `${d.name}:${d.status}`).join(", ");
    console.log(`  status [${i + 1}/12]: ${rows}`);
    const allActive = (json.result || []).every((d) => d.status === "active");
    if (allActive && json.result?.length >= 2) break;
    await sleep(10000);
  }

  // DNS audit — remove apex A records that cause 525 without Pages origin
  console.log("\n=== DNS records ===");
  const dns = await api(token, "GET", `/zones/${zoneId}/dns_records?per_page=100`);
  for (const r of dns.json.result || []) {
    console.log(`  ${r.type} ${r.name} -> ${r.content} (proxied: ${r.proxied})`);
  }

  const apexA = (dns.json.result || []).filter(
    (r) => r.type === "A" && r.name === DOMAIN && r.proxied
  );
  if (apexA.length) {
    console.log("\n  Removing conflicting apex A records (cause Error 525)...");
    for (const r of apexA) {
      const del = await api(token, "DELETE", `/zones/${zoneId}/dns_records/${r.id}`);
      console.log(`    deleted ${r.id}: ${del.json.success ? "ok" : del.json.errors?.[0]?.message}`);
    }
  }

  // Ensure CNAME apex -> sitexray.pages.dev (Cloudflare CNAME flattening)
  const pagesCname = (dns.json.result || []).find(
    (r) => r.type === "CNAME" && r.name === DOMAIN
  );
  if (!pagesCname) {
    console.log("  Adding CNAME @ -> sitexray.pages.dev");
    const add = await api(token, "POST", `/zones/${zoneId}/dns_records`, {
      type: "CNAME",
      name: DOMAIN,
      content: "sitexray.pages.dev",
      proxied: true,
      ttl: 1,
    });
    console.log(`    ${add.json.success ? "ok" : add.json.errors?.[0]?.message}`);
  }

  const wwwCname = (dns.json.result || []).find(
    (r) => r.type === "CNAME" && r.name === `www.${DOMAIN}`
  );
  if (!wwwCname) {
    console.log("  Adding CNAME www -> sitexray.pages.dev");
    const add = await api(token, "POST", `/zones/${zoneId}/dns_records`, {
      type: "CNAME",
      name: "www",
      content: "sitexray.pages.dev",
      proxied: true,
      ttl: 1,
    });
    console.log(`    ${add.json.success ? "ok" : add.json.errors?.[0]?.message}`);
  }

  // Email sending (zone-level subdomain API)
  console.log("\n=== Email Sending ===");
  const subdomains = await api(
    token,
    "GET",
    `/zones/${zoneId}/email/sending/subdomains`
  );
  const existing = (subdomains.json.result || []).find((s) => s.name === DOMAIN);
  if (existing?.enabled) {
    console.log(`  Already enabled for ${DOMAIN}`);
  } else {
    const enable = await api(
      token,
      "POST",
      `/zones/${zoneId}/email/sending/subdomains`,
      { name: DOMAIN }
    );
    if (enable.json.success) {
      console.log(`  Enabled email sending for ${DOMAIN}`);
    } else {
      console.log(`  ${enable.json.errors?.map((e) => e.message).join("; ")}`);
    }
  }

  const subs = await api(token, "GET", `/zones/${zoneId}/email/sending/subdomains`);
  for (const s of subs.json.result || []) {
    console.log(`  subdomain: ${s.name} enabled=${s.enabled}`);
  }

  console.log("\n=== Done ===");
  console.log(`https://${DOMAIN}`);
  console.log("Still manual: Pages → sitexray → Bindings → Add EMAIL → Retry deployment");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});