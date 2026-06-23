// Add DNS CNAME records via Edge/Chrome (no Playwright browser download).
import { chromium } from "playwright";

const URL = "https://dash.cloudflare.com/6609012adc88f397f50eba13ea2c242f/sitexray.xyz/dns/records";

async function main() {
  const browser = await chromium.launch({
    channel: "msedge",
    headless: false,
  }).catch(() => chromium.launch({ channel: "chrome", headless: false }));

  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 120000 });
  console.log("URL:", page.url());
  await page.waitForTimeout(15000);
  await page.screenshot({ path: "D:/SiteXray/cf-dns-edge.png", fullPage: true });
  console.log("Screenshot saved. If logged in, tell me and I will automate clicks.");
  await browser.close();
}

main().catch(console.error);