# DEPLOY.md — turning this repo into a live, money-making site

Read top to bottom. Everything is **free-tier** until you make a sale. Plan on ~60 minutes the first time, then 5 minutes for updates.

The pieces:

1. [GitHub repo](#0-github) — already done ✅
2. [Anthropic API account](#1-anthropic-api) — for Claude
3. [Resend account](#2-resend-email) — for email delivery
4. [Cloudflare account + Pages](#3-cloudflare-pages) — for hosting landing + backend
5. [Lemon Squeezy account](#4-lemon-squeezy) — for accepting payments
6. [Cloudflare Turnstile](#5-cloudflare-turnstile) — anti-bot (optional but recommended)
7. [Wire it all together](#6-wire-everything-together)
8. [Test the full flow](#7-final-test)
9. [Go live](#8-go-live--start-selling)

---

## 0. GitHub

Already done. Your repo is at: https://github.com/ErnestKostevich/Project-4

You'll connect Cloudflare Pages to this repo in step 3 — it'll auto-deploy on every push.

---

## 1. Anthropic API

Anthropic is the company that makes Claude — the AI generating your audits.

1. Sign up: https://console.anthropic.com/
2. Add **$5 in credits** (Settings → Plans & billing). This is the only real upfront cost. $5 = ~16 full audits, paid back by your first sale.
3. Create an API key: Settings → API Keys → **Create Key** → name it `sitexray-prod`
4. **Copy the key**, you'll only see it once. Save it somewhere safe (e.g. password manager). Starts with `sk-ant-`.

Anthropic also lets you set a **monthly spend limit** — set it to e.g. $50/month so you can never get a surprise bill. Settings → Plans & billing → Usage limits.

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

## 3. Cloudflare Pages

This hosts the landing page **and** runs your backend (the JS files in `landing/functions/`). Free tier: unlimited bandwidth, 100,000 function requests/day.

1. Sign up: https://dash.cloudflare.com/sign-up
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

### Add environment variables

This is where your API keys live. Cloudflare encrypts them at rest.

**Cloudflare Dashboard** → Pages → your project → **Settings** → **Environment variables**

For **Production** environment, add:

| Variable name | Value | Encrypted? |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` from step 1 | ✅ yes |
| `RESEND_API_KEY` | `re_...` from step 2 | ✅ yes |
| `RESEND_FROM_EMAIL` | `SiteX-Ray <reports@yourdomain.com>` (or skip — defaults to onboarding@resend.dev) | no |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-5` (or leave blank for default) | no |
| `LEMON_WEBHOOK_SECRET` | (we'll fill in step 4) | ✅ yes |
| `LEMON_CHECKOUT_URL` | (we'll fill in step 4) | no |
| `TURNSTILE_SECRET` | (we'll fill in step 5) | ✅ yes |

After adding, click **Save** then **Redeploy** the latest deployment (top right of the project page → triple dot → Retry deployment) so functions pick up the new env vars.

### Pick a domain

Either:
- **Free:** use the `*.pages.dev` URL Cloudflare gave you (e.g. `project-4-abc.pages.dev`). Works fine, looks indie.
- **Custom:** buy a domain (~$10/year, e.g. `sitexray.com` via Cloudflare Registrar) → Pages → Custom domains → Add → follow the DNS instructions. Cloudflare provisions SSL automatically.

---

## 4. Lemon Squeezy

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
7. **Webhooks**:
   - Settings → **Webhooks** → **+ Add endpoint**
   - URL: `https://yourdomain.com/api/lemon-webhook` (or `https://project-4-abc.pages.dev/api/lemon-webhook`)
   - Events: check **order_created**
   - Save → it generates a **signing secret** → copy it

Now go back to Cloudflare → Pages → Settings → Environment variables and fill in:
- `LEMON_CHECKOUT_URL` = the checkout URL from step 6
- `LEMON_WEBHOOK_SECRET` = the signing secret from step 7

Also, edit `landing/index.html` — find the line:
```js
const LEMON_CHECKOUT_URL = "";
```
and paste your checkout URL between the quotes. Commit & push.

---

## 5. Cloudflare Turnstile

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

| Stage | Sales/month | Anthropic | Lemon Squeezy | Resend | CF Pages | Total cost | Revenue | Net |
|---|---|---|---|---|---|---|---|---|
| Bootstrapping | 0 | $0 | $0 | $0 | $0 | **$0** | $0 | $0 |
| First 10 sales | 10 | $5 | $40 (fees) | $0 | $0 | **$45** | $390 | **+$345** |
| 50 sales/mo | 50 | $20 | $200 | $0 | $0 | **$220** | $1,950 | **+$1,730** |
| 500 sales/mo | 500 | $200 | $2,000 | $20 | $0 | **$2,220** | $19,500 | **+$17,280** |

The model is robust. Every sale is profitable from #1.
