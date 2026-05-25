# DEPLOY.md — turning this repo into a live, money-making site

Read top to bottom. **Truly $0 upfront** — every required piece is on a free tier with no credit-card-on-file. Plan ~60 minutes the first time, then 5 minutes for updates.

## What you need

**Required** (free, no KYC, no credit card):
- GitHub account
- Cloudflare account (hosts site + provides FREE Llama 3.1 AI inference)
- Resend account (free 3000 emails/month)

**Required only when you start selling** (no upfront cost, no KYC for low volumes):
- Cryptomus account (collects crypto payments, 0.5% fee per sale, payouts to your own wallet)

**Optional, recommended later** (small cost, only after first sale):
- Anthropic API account ($5 min credit) — upgrades the paid $39 audit from Llama to Claude Sonnet quality. Skip for launch; add once you have revenue.

## Sections

1. [GitHub repo](#0-github) — already done ✅
2. [Cloudflare account + Pages + AI binding](#1-cloudflare-pages--workers-ai)
3. [Resend account](#2-resend-email) — email delivery
4. [Cryptomus account](#3-cryptomus-no-kyc-crypto-payments) — accept payments without KYC
5. [Cloudflare Turnstile](#4-cloudflare-turnstile) — anti-bot (optional)
6. [Anthropic API](#5-anthropic-api-optional-quality-upgrade) — optional Claude upgrade
7. [Wire everything together](#6-wire-everything-together)
8. [Test the full flow](#7-final-test)
9. [Go live](#8-go-live--start-selling)

---

## 0. GitHub

Already done. Your repo is at: https://github.com/ErnestKostevich/Project-4

You'll connect Cloudflare Pages to this repo in step 3 — it'll auto-deploy on every push.

---

## 1. Cloudflare Pages + Workers AI

Cloudflare hosts the landing page, runs the backend (the JS in `landing/functions/`), AND provides **free Llama 3.1 inference** via Workers AI — that's how your free teasers cost you $0.

1. Sign up: https://dash.cloudflare.com/sign-up (free, no card required for Pages + Workers AI free tier)
2. **Workers & Pages** → **Create application** → **Pages** tab → **Connect to Git**
3. Authorize Cloudflare to read your GitHub
4. Pick the `Project-4` repo
5. Configure build:
   - **Production branch:** `main`
   - **Build command:** *(leave empty)*
   - **Build output directory:** `landing`
   - **Root directory:** *(leave as `/`)*
6. Click **Save and Deploy**. First deploy takes 1–2 minutes.
7. You now have a live URL like `https://project-4-abc.pages.dev` — open it, you should see the landing.

### Enable the Workers AI binding (THIS is what makes free teasers free)

After the first deploy:

- Pages → your project → **Settings** → **Functions** → **Workers AI bindings** → **Add binding**
- Variable name: `AI`
- Save → Retry the latest deployment so the binding takes effect

This binding gives your worker access to Cloudflare's Llama 3.1 8B model with **10,000 Neurons/day free** (≈ 50–200 audits/day). Past that, ~$0.01 per 1000 Neurons — basically free at any indie volume.

> 💡 If you skip this binding AND skip Anthropic, the backend will throw "No AI configured" on every request. At minimum, you need ONE AI source.

---

## 2. Resend (email)

Resend sends your reports to customers' inboxes. Free tier: 3,000 emails/month, 100/day. More than enough.

1. Sign up: https://resend.com/
2. Verify your email
3. (Optional but recommended) Add a custom domain so emails come from `reports@sitexray.com` instead of `onboarding@resend.dev`:
   - Resend → Domains → Add Domain → enter your domain → copy the DNS records they show
   - Add those records in Cloudflare DNS (step 3 below) — TXT and MX records
   - Wait 5–30 minutes, Resend verifies automatically
4. API Keys → **Create API Key** → permission: "Sending access" → name it `sitexray-prod`
5. Copy the key, starts with `re_`

> 💡 If you skip the custom domain, the `from` address will default to `onboarding@resend.dev` — works for testing but looks unprofessional. Set up the domain before your first sale.

---

### Add environment variables

This is where your API keys live. Cloudflare encrypts them at rest.

**Cloudflare Dashboard** → Pages → your project → **Settings** → **Environment variables**

For **Production** environment, add:

| Variable name | Required? | Value | Encrypted? |
|---|---|---|---|
| `RESEND_API_KEY` | ✅ required | `re_...` from step 2 | yes |
| `RESEND_FROM_EMAIL` | optional | `SiteX-Ray <reports@yourdomain.com>` (else defaults to onboarding@resend.dev) | no |
| `CRYPTOMUS_MERCHANT_ID` | required to sell | merchant UUID from step 3 | yes |
| `CRYPTOMUS_API_KEY` | required to sell | payment API key from step 3 | yes |
| `CRYPTOMUS_TO_CURRENCY` | optional | payout currency, default `USDT` | no |
| `TURNSTILE_SECRET` | recommended | (filled in step 4) | yes |
| `ANTHROPIC_API_KEY` | optional | `sk-ant-...` (skip = use free Cloudflare AI for everything) | yes |
| `ANTHROPIC_MODEL` | optional | `claude-sonnet-4-5` | no |
| `CF_AI_MODEL` | optional | overrides default `@cf/meta/llama-3.1-8b-instruct` | no |

After adding, click **Save** then **Redeploy** the latest deployment (top right of the project page → triple dot → Retry deployment) so functions pick up the new env vars.

### Pick a domain

Either:
- **Free:** use the `*.pages.dev` URL Cloudflare gave you (e.g. `project-4-abc.pages.dev`). Works fine, looks indie.
- **Custom:** buy a domain (~$10/year, e.g. `sitexray.com` via Cloudflare Registrar) → Pages → Custom domains → Add → follow the DNS instructions. Cloudflare provisions SSL automatically.

---

## 3. Cryptomus (no-KYC crypto payments)

Cryptomus is a crypto payment processor that lets you accept BTC, ETH, USDT, USDC and ~50 other coins. **No KYC required for low volumes** (their default limit at signup is around €1k/month and grows automatically with usage). Customer pays in any crypto, you receive in stablecoin (USDT/USDC) to your own wallet. Fee: 0.5% — eight times cheaper than card processors.

**The trade-off you accept:** the SMB owner has to be comfortable paying with crypto. Many are; many aren't. Crypto-paying customers tend to be: agency owners, indie founders, tech-savvy operators, anyone in countries with strict capital controls. Expect lower conversion than card processors but you keep all the upside (no chargebacks, no account freezes, no KYC for you OR the buyer).

### Setup (~15 minutes, no documents required)

1. Sign up: https://cryptomus.com → email + password. No identity verification at signup.
2. After login: **Personal area** → **Business** → **Create merchant** → name it `SiteX-Ray` → Save.
3. Open your merchant. Copy and save these two values:
   - **Merchant ID** (UUID format) — goes into env var `CRYPTOMUS_MERCHANT_ID`
   - **Payment API key** (Settings → API keys → "Payment" key, click "Show") — goes into env var `CRYPTOMUS_API_KEY`
4. Configure **payout currency** (Settings → Wallets):
   - Add your own USDT wallet address. Recommended chains: **Tron (TRC20)** for lowest fees (~$1), or **Solana** for instant settlement. Avoid Ethereum mainnet — fees are too high for small amounts.
   - Or just let payouts accumulate in your Cryptomus balance and withdraw manually later.
5. Set the webhook URL in your merchant settings:
   - **Settings** → **Notifications** / **Webhooks** → **Payment notifications URL**:
     `https://yourdomain.com/api/cryptomus-webhook` (or `https://project-4-abc.pages.dev/api/cryptomus-webhook`)
   - Save. The same `CRYPTOMUS_API_KEY` is used to sign the webhook, so no separate secret to manage.
6. **Test in sandbox first**: Cryptomus has a Testnet mode — switch on, send a test payment with testnet USDT (free from a faucet), verify your webhook fires and you get an email. Once it works → switch to **Production** mode.

> 💡 Cryptomus payouts of accumulated USDT to your own wallet don't trigger KYC under their default limits. If you go over the threshold, they'll ask you to verify — at that point you've already made >€1k and the KYC ask is fine. Receiving USDT to your own wallet is permissionless.

### Add the env vars to Cloudflare Pages

Cloudflare Pages → Settings → Environment variables → add:
- `CRYPTOMUS_MERCHANT_ID` (encrypted) — the merchant UUID from step 3
- `CRYPTOMUS_API_KEY` (encrypted) — the payment API key from step 3
- `CRYPTOMUS_TO_CURRENCY` = `USDT` (or `USDC` — optional, defaults to `USDT`)

Then **Retry deployment** so functions pick up the env vars. The landing's "Get full audit — $39" button is already wired to call `/api/create-invoice`, which uses these vars to create a hosted Cryptomus checkout and redirects the customer there. After payment, Cryptomus webhooks `/api/cryptomus-webhook` and your full audit is delivered by email.

No edits to `landing/index.html` required — checkout is fully server-side.

---

## 4. Cloudflare Turnstile

Stops bots from spamming your free-teaser endpoint and burning your Claude credits.

1. Cloudflare Dashboard → **Turnstile** → **Add site**
2. Site name: `SiteX-Ray`
3. Hostnames: your domain(s) — e.g. `project-4-abc.pages.dev`, `sitexray.com`
4. Widget mode: **Managed** (good defaults)
5. Save → it gives you a **Site Key** (public, goes in HTML) and **Secret Key** (private, goes in env vars)

Update two places:

**Cloudflare Pages env vars:**
- `TURNSTILE_SECRET` = the secret key

**`landing/index.html`** — find:
```js
const TURNSTILE_SITE_KEY = "";
```
and paste the site key between the quotes. Commit & push.

---

## 5. Anthropic API (optional, quality upgrade)

**Skip this section for launch.** Come back after your first 5–10 sales when you want to upgrade the $39 audit from Llama-quality to Claude-quality.

What changes when you add Anthropic:
- Free teasers stay on free Cloudflare AI (no change, $0 cost)
- Paid $39 audits switch to **Claude Sonnet** — noticeably better writing, more specific fixes, more reliable structure
- Your cost per paid report becomes ~$0.30, paid out of the $39 customer payment (still net positive: ~$36 margin)

To set up:
1. Sign up: https://console.anthropic.com/
2. Add **$5 in credits** (Settings → Plans & billing). $5 = ~16 audits.
3. Create an API key: Settings → API Keys → **Create Key** → name it `sitexray-prod` → copy the key (starts with `sk-ant-`).
4. **Set a monthly spend cap** so you never get a surprise bill: Settings → Plans & billing → Usage limits → set to e.g. $50/month.
5. Cloudflare Pages → Settings → Environment variables → add `ANTHROPIC_API_KEY` (encrypted) → Retry deployment.

Once set, paid orders automatically use Claude. No code changes needed.

---

## 6. Wire everything together

By now you should have committed two small edits to `landing/index.html` (LEMON_CHECKOUT_URL and TURNSTILE_SITE_KEY). Both are public-safe — they go in the HTML.

```powershell
git -C "D:\Project 4" add landing/index.html
git -C "D:\Project 4" commit -m "config: production checkout URL and Turnstile site key"
git -C "D:\Project 4" push
```

Cloudflare auto-deploys on push. Wait 1–2 min, refresh the site.

---

## 7. Final test

Run through the **full happy path** once before announcing.

### Test the free teaser
1. Open your live site
2. Enter `https://stripe.com` as the URL and your own email
3. Pass the bot check (if Turnstile is on)
4. Click "Get my free report"
5. Wait 1–2 minutes
6. Check your inbox — you should get a teaser report
7. Open it on phone and desktop, eyeball that it looks ok

If nothing arrives in 5 minutes:
- Cloudflare → Pages → your project → **Logs** → look for the most recent invocation of `/api/audit` and read the error
- Common culprits: missing env var, wrong API key, Resend domain not verified, Claude credit balance is $0

### Test the paid flow (use Cryptomus testnet mode)
1. Cryptomus dashboard → Settings → switch to **Test / sandbox mode**
2. Open your live site → fill in URL + email → click "Get full audit — $39"
3. You'll get redirected to a Cryptomus checkout page. Pick any crypto.
4. Use testnet USDT from a faucet (Cryptomus provides one in test mode) to pay
5. Once confirmed, you should get redirected to `/success.html` and the FULL audit should arrive by email within 2–3 minutes
6. When everything works → Cryptomus → Settings → switch to **Production mode**

---

## 8. Go live & start selling

The product is live. Open `outreach/linkedin_dm.md` and `outreach/cold_email.md` — copy-paste templates with placeholders.

**Your day-1 task:** send 50 personalized LinkedIn DMs to US small-business owners (dentists, lawyers, plumbers, real-estate brokers). Each DM should include a **specific** observation from running their site through the free teaser. Goal: 1–3 sales in week 1.

Track your pipeline however you want (a spreadsheet works) — see `outreach/niche_lists.md` for prospect sources.

---

## (Optional) Local development with Wrangler

If you want to test the backend on your own laptop before pushing to Cloudflare:

```powershell
npm install -g wrangler
wrangler login                            # opens browser, logs you in to Cloudflare

copy .dev.vars.example .dev.vars          # then paste your real keys into .dev.vars
wrangler pages dev landing                # serves http://localhost:8788
```

`.dev.vars` is gitignored — only lives on your machine. Production env vars are managed in the Cloudflare dashboard.

The local server runs the **same Functions code** that production runs. If something works locally, it'll work after deploy.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Free-teaser form submits, no email arrives | Missing AI binding or `RESEND_API_KEY` env var | Pages → Settings → Functions → add Workers AI binding `AI`; check `RESEND_API_KEY` is set; Retry deployment |
| Email arrives from `onboarding@resend.dev` | Custom Resend domain not verified | Verify domain in Resend, set `RESEND_FROM_EMAIL` env var |
| "Anthropic API 429" in logs | Out of Claude credits | Top up at console.anthropic.com (only relevant if you opted into Anthropic) |
| "Couldn't create checkout" when clicking $39 button | Missing `CRYPTOMUS_MERCHANT_ID` / `CRYPTOMUS_API_KEY` | Add both in Pages → Settings → env vars; Retry deployment |
| "Invalid signature" on Cryptomus webhook | Webhook signed with a different key than the one in env | Re-copy `CRYPTOMUS_API_KEY` from Cryptomus → paste fresh into Cloudflare env vars |
| Cryptomus webhook fires but no email goes out | Audit pipeline crashed; check Cloudflare → Pages → Functions logs | Likely a malformed `additional_data` field or missing AI backend |
| Site loads, no functions respond | Wrong build output dir | Pages → Settings → Build → set output dir to `landing` → Retry |

---

## Costs at scale (reality check)

### Mode A — pure $0 (Cloudflare AI only, no Anthropic at all)

| Stage | Sales/mo | Free teasers/mo | CF AI | Cryptomus 0.5% | Resend | CF Pages | Total | Revenue | Net |
|---|---|---|---|---|---|---|---|---|---|
| Bootstrapping | 0 | 50 | $0 | $0 | $0 | $0 | **$0** | $0 | $0 |
| 10 sales | 10 | 200 | $0 | ~$2 | $0 | $0 | **$2** | $390 | **+$388** |
| 50 sales | 50 | 1000 | $0 | ~$10 | $0 | $0 | **$10** | $1,950 | **+$1,940** |
| 500 sales | 500 | 10k | ~$10 | ~$100 | $20 | $0 | **$130** | $19,500 | **+$19,370** |

### Mode B — Anthropic upgrade (Claude for paid audits)

| Stage | Sales/mo | Anthropic | Cryptomus | Resend | CF | Total | Revenue | Net |
|---|---|---|---|---|---|---|---|---|
| First sales | 10 | $5 prepay + $3 | $2 | $0 | $0 | **$10** | $390 | **+$380** |
| 50 sales | 50 | $20 | $10 | $0 | $0 | **$30** | $1,950 | **+$1,920** |
| 500 sales | 500 | $200 | $100 | $20 | $0 | **$320** | $19,500 | **+$19,180** |

Both modes profitable from sale #1. Cryptomus's 0.5% fee leaves dramatically more margin than the 7% card processors take — this is the upside of crypto.
