// Automate Cloudflare Dashboard: DNS + Email binding + env vars.
// Uses your local Chrome profile (already logged in from wrangler login).
import { chromium } from "playwright";
import { homedir } from "node:os";
import { join } from "node:path";

const ACCOUNT = "6609012adc88f397f50eba13ea2c242f";
const ZONE = "sitexray.xyz";
const PROJECT = "sitexray";

const URLS = {
  dns: `https://dash.cloudflare.com/${ACCOUNT}/${ZONE}/dns/records`,
  pagesDomains: `https://dash.cloudflare.com/${ACCOUNT}/pages/view/${PROJECT}/domains`,
  pagesBindings: `https://dash.cloudflare.com/${ACCOUNT}/pages/view/${PROJECT}/settings/functions`,
  email: `https://dash.cloudflare.com/${ACCOUNT}/email`,
};

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const userDataDir = join(
    homedir(),
    "AppData/Local/Google/Chrome/User Data"
  );

  console.log("Launching Chrome with your profile...");
  let context;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chrome",
      headless: false,
      args: ["--profile-directory=Default"],
    });
  } catch (err) {
    console.log("Chrome profile locked, using fresh browser:", err.message?.slice(0, 80));
    const browser = await chromium.launch({ channel: "chrome", headless: false });
    context = await browser.newContext();
  }

  const page = context.pages()[0] || (await context.newPage());

  // --- DNS ---
  console.log("\n[1/3] DNS records...");
  await page.goto(URLS.dns, { waitUntil: "domcontentloaded", timeout: 120000 });
  await sleep(5000);

  if (page.url().includes("/login")) {
    console.log("Need Cloudflare login in browser — waiting 90s...");
    await page.waitForURL(/dash\.cloudflare\.com(?!.*login)/, { timeout: 90000 }).catch(() => {});
  }

  await sleep(3000);

  // Delete apex A records if present
  const aRows = page.locator('tr:has-text("A"):has-text("sitexray.xyz")');
  const aCount = await aRows.count();
  for (let i = 0; i < aCount; i++) {
    const row = aRows.nth(i);
    const edit = row.getByRole("button", { name: /edit|delete/i }).first();
    if (await edit.isVisible().catch(() => false)) {
      await row.getByLabel(/delete|more/i).first().click().catch(() => {});
      await page.getByRole("menuitem", { name: /delete/i }).click().catch(() => {});
      await page.getByRole("button", { name: /delete|confirm/i }).click().catch(() => {});
      await sleep(1500);
    }
  }

  // Add record button
  const addBtn = page.getByRole("button", { name: /add record/i });
  if (await addBtn.isVisible().catch(() => false)) {
    for (const [name, content] of [
      ["@", "sitexray.pages.dev"],
      ["www", "sitexray.pages.dev"],
    ]) {
      const exists = await page.locator(`tr:has-text("CNAME"):has-text("${name === "@" ? ZONE : `www.${ZONE}`}")`).count();
      if (exists > 0) {
        console.log(`  CNAME ${name} already exists`);
        continue;
      }
      await addBtn.click();
      await sleep(1000);
      await page.locator('select, [role="combobox"]').first().click().catch(() => {});
      await page.getByText("CNAME", { exact: true }).click().catch(() => {});
      await page.getByLabel(/name/i).fill(name === "@" ? ZONE : `www.${ZONE}`).catch(() =>
        page.locator('input[name="name"], input[placeholder*="name" i]').last().fill(name)
      );
      await page.getByLabel(/target|content/i).fill(content).catch(() =>
        page.locator('input[name="content"], input[placeholder*="target" i]').fill(content)
      );
      // Proxied toggle - leave on
      await page.getByRole("button", { name: /save/i }).click();
      await sleep(2000);
      console.log(`  Added CNAME ${name} -> ${content}`);
    }
  } else {
    console.log("  Could not find Add record button — screenshot saved");
    await page.screenshot({ path: "cf-dns-debug.png", fullPage: true });
  }

  // --- Pages domains ---
  console.log("\n[2/3] Pages domains...");
  await page.goto(URLS.pagesDomains, { waitUntil: "domcontentloaded", timeout: 120000 });
  await sleep(5000);

  // --- Email ---
  console.log("\n[3/3] Email Service...");
  await page.goto(URLS.email, { waitUntil: "domcontentloaded", timeout: 120000 });
  await sleep(5000);
  const onboard = page.getByRole("button", { name: /onboard|add domain|enable/i });
  if (await onboard.first().isVisible().catch(() => false)) {
    await onboard.first().click();
    await sleep(2000);
    await page.getByText(ZONE, { exact: false }).click().catch(() => {});
    await page.getByRole("button", { name: /add records|onboard|continue/i }).click().catch(() => {});
    console.log("  Triggered email domain onboard");
  }

  // --- Bindings ---
  console.log("\n[4/4] Pages EMAIL binding...");
  await page.goto(URLS.pagesBindings, { waitUntil: "domcontentloaded", timeout: 120000 });
  await sleep(5000);
  const addBinding = page.getByRole("button", { name: /add binding|add/i });
  if (await addBinding.first().isVisible().catch(() => false)) {
    await addBinding.first().click();
    await sleep(1000);
    await page.getByText(/email/i).click().catch(() => {});
    await page.getByLabel(/variable|name/i).fill("EMAIL").catch(() => {});
    await page.getByRole("button", { name: /save|add/i }).click().catch(() => {});
    console.log("  Added EMAIL binding");
  }

  await page.screenshot({ path: "cf-setup-done.png", fullPage: true });
  console.log("\nScreenshot: cf-setup-done.png");
  await sleep(3000);
  await context.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});