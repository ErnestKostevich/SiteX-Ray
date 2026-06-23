import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ACCOUNT = "6609012adc88f397f50eba13ea2c242f";
const PROJECT = "sitexray";
const oauth = readFileSync(
  join(homedir(), "AppData/Roaming/xdg.config/.wrangler/config/default.toml"),
  "utf8"
).match(/oauth_token\s*=\s*"([^"]+)"/)[1];

const proj = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/pages/projects/${PROJECT}`,
  { headers: { Authorization: `Bearer ${oauth}` } }
).then((r) => r.json());

const ev = proj.result?.deployment_configs?.production?.env_vars || {};
console.log("Env keys:", Object.keys(ev).sort().join(", "));
console.log("Latest deploy:", proj.result?.latest_deployment?.id, proj.result?.latest_deployment?.deployment_trigger?.metadata?.commit_hash);