import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ACCOUNT_ID = "6609012adc88f397f50eba13ea2c242f";
const PROJECT = "sitexray";
const DOMAIN = "sitexray.xyz";
const API = "https://api.cloudflare.com/client/v4";

function loadToken() {
  const raw = readFileSync(
    join(homedir(), "AppData/Roaming/xdg.config/.wrangler/config/default.toml"),
    "utf8"
  );
  return raw.match(/oauth_token\s*=\s*"([^"]+)"/)[1];
}

async function api(token, path) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

const token = loadToken();

const domains = await api(
  token,
  `/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}/domains`
);
console.log("Pages domains:", JSON.stringify(domains, null, 2));

const zones = await api(token, `/zones?name=${DOMAIN}`);
const zoneId = zones.result?.[0]?.id;
console.log("\nZone ID:", zoneId);

if (zoneId) {
  const dns = await api(token, `/zones/${zoneId}/dns_records?per_page=100`);
  console.log("\nDNS success:", dns.success, "errors:", dns.errors);
  console.log("DNS records:", JSON.stringify(dns.result, null, 2));

  const email = await api(token, `/zones/${zoneId}/email/sending/subdomains`);
  console.log("\nEmail subdomains:", JSON.stringify(email, null, 2));
}