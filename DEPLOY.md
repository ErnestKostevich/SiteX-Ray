# DEPLOY.md — turning this repo into a live, money-making site

Read top to bottom. **Truly $0 upfront** — every required piece is on a free tier with no credit-card-on-file. Plan ~60 minutes the first time, then 5 minutes for updates.

## What you need

**Required** (free, no credit card):
- GitHub account
- Cloudflare account (hosts site + provides FREE Llama 3.1 AI inference)
- Resend account (free 3000 emails/month)

**Required only after you start selling** (no upfront cost):
- Lemon Squeezy account (collects $39 payments, takes ~7% fee per sale)

**Optional, recommended later** (small cost, only after first sale):
- Anthropic API account ($5 min credit) — upgrades the paid $39 audit from Llama to Claude Sonnet quality. Skip for launch; add once you have revenue.

## Sections

1. [GitHub repo](#0-github) — already done ✅
2. [Cloudflare account + Pages + AI binding](#1-cloudflare-pages--workers-ai)
3. [Resend account](#2-resend-email) — email delivery
4. [Lemon Squeezy account](#3-lemon-squeezy) — payments
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
| `LEMON_WEBHOOK_SECRET` | required to sell | (filled in step 3) | yes |
| `LEMON_CHECKOUT_URL` | required to sell | (filled in step 3) | no |
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

## 3. Lemon Squeezy

Lemon Squeezy handles checkout, payments, tax (incl. EU VAT), and webhooks. Their fee is ~5% + $0.50 per sale. **No setup fee, no monthly cost** until you sell.

1. Sign up: https://www.lemonsqueezy.com/
2. Verify email, fill in basic account info
3. **Products** → **+ New Product**:
   - Name: `SiteX-Ray Full Audit`
   - Price: $39 USD
   - Type: **Single payment**, digital product
   - Description: paste from your landing's pricing card
   - Save
4. Click the product → **Variants** tab → make sure default variant is published
5. **Custom checkout fields** (so you can collect the audit URL even if customer didn't fill it on the landing):
   - Product → **Checkout** tab → **Custom data** → add field with key `audit_url`, label "Website URL to audit"
6. Copy the **checkout URL**: Product → **Share** → **Pay link** → copy. Looks like `https://yourshop.lemonsqueezy.com/buy/abc-123-xyz`
7. **Thank-you redirect**: Product → **Checkout** tab → "Redirect URL after purchase" → enter `https://yourdomain.com/success` (or `https://project-4-abc.pages.dev/success`). This sends paying customers to the friendly `success.html` page while their full audit is being generated in the background.
   - **Cancel URL** (same tab, "Redirect URL on cancel"): enter `https://yourdomain.com/cancel`. Brings users who close the checkout back to a friendly "no charge" page that points them to the free teaser instead.
8. **Webhooks**:
   - Settings → **Webhooks** → **+ Add endpoint**
   - URL: `https://yourdomain.com/api/lemon-webhook` (or `https://project-4-abc.pages.dev/api/lemon-webhook`)
   - Events: check **order_created**
   - Save → it generates a **signing secret** → copy it

> ⚠️ If you renumber the steps above, also update the matching env-var names below — `LEMON_CHECKOUT_URL` is the URL from step 6, `LEMON_WEBHOOK_SECRET` is the secret from step 8.

Now go back to Cloudflare → Pages → Settings → Environment variables and fill in:
- `LEMON_CHECKOUT_URL` = the checkout URL from step 6
- `LEMON_WEBHOOK_SECRET` = the signing secret from step 7

Also, edit `landing/index.html` — find the line:
```js
const LEMON_CHECKOUT_URL = "";
```
and paste your checkout URL between the quotes. Commit & push.

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

### Test the paid flow (use Lemon Squeezy test mode)
1. Lemon Squeezy → Settings → **Test mode: ON**
2. Open your live site → click "Get full audit — $39"
3. You'll get redirected to Lemon's checkout. Use card `4242 4242 4242 4242`, any future expiry, any CVC
4. The custom field `audit_url` should be pre-filled
5. Complete checkout → you should receive the FULL report in your email
6. When everything works → Lemon Squeezy → Settings → **Test mode: OFF**

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
| Form submits, no email arrives | Missing `ANTHROPIC_API_KEY` or `RESEND_API_KEY` env var | Add it in Pages → Settings → env vars, then Retry deployment |
| Email arrives from `onboarding@resend.dev` | Custom Resend domain not verified | Verify domain in Resend, set `RESEND_FROM_EMAIL` env var |
| "Anthropic API 429" in logs | Out of Claude credits | Top up at console.anthropic.com |
| "Invalid signature" on Lemon webhook | Webhook secret mismatch | Re-copy from Lemon Squeezy → paste fresh into `LEMON_WEBHOOK_SECRET` |
| Site loads, no functions respond | Wrong build output dir | Pages → Settings → Build → set output dir to `landing` → Retry |
| Local form click → "Demo mode" alert | You haven't set `LEMON_CHECKOUT_URL` in `landing/index.html` yet | See step 6 above |

---

## Costs at scale (reality check)

### Mode A — pure $0 (Cloudflare AI only, no Anthropic at all)

| Stage | Sales/mo | Free teasers/mo | CF AI cost | Lemon | Resend | CF Pages | Total | Revenue | Net |
|---|---|---|---|---|---|---|---|---|---|
| Bootstrapping | 0 | 50 | $0 (free tier) | $0 | $0 | $0 | **$0** | $0 | $0 |
| 10 sales | 10 | 200 | $0 (free tier) | $40 | $0 | $0 | **$40** | $390 | **+$350** |
| 50 sales | 50 | 1000 | $0 (free tier) | $200 | $0 | $0 | **$200** | $1,950 | **+$1,750** |
| 500 sales | 500 | 10k | ~$10 | $2,000 | $20 | $0 | **$2,030** | $19,500 | **+$17,470** |

### Mode B — Anthropic upgrade (Claude for paid audits)

| Stage | Sales/mo | Anthropic | Lemon | Resend | CF | Total | Revenue | Net |
|---|---|---|---|---|---|---|---|---|
| First sales | 10 | $5 prepay + $3 | $40 | $0 | $0 | **$48** | $390 | **+$342** |
| 50 sales | 50 | $20 | $200 | $0 | $0 | **$220** | $1,950 | **+$1,730** |
| 500 sales | 500 | $200 | $2,000 | $20 | $0 | **$2,220** | $19,500 | **+$17,280** |

Both modes are profitable from sale #1. Mode A has the lowest possible launch friction; Mode B trades $5 upfront for better paid-audit quality (and likely higher conversion + lower refunds long-term).
