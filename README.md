# SiteX-Ray

AI-powered website audit. Visitor pastes their URL, gets a senior-consultant-grade report in their inbox within 2 minutes. Free 1-page teaser, full 10-15 page report for $39.

Built to run on **truly $0 upfront cost** — every piece sits on a free tier, *including AI inference*. Cloudflare Workers AI (Llama 3.1 8B) generates the audits for free. Anthropic Claude is an optional quality upgrade for the paid tier; even there, the $0.30 cost comes out of the $39 customer payment — never out of your pocket.

---

## What's in this repo

```
.
├── audit.py                       # Python CLI — local audits for manual fulfillment
├── src/                           # CLI implementation
│   ├── scraper.py                 # parses ~30 signals from a page
│   ├── analyzer.py                # calls Anthropic API
│   ├── report.py                  # renders HTML report
│   └── prompts/auditor_system.md  # the auditor prompt (the moat)
├── templates/report.html          # Jinja2 template for the Python CLI's report
├── requirements.txt               # Python deps
│
├── landing/                       # static assets — Cloudflare Pages build output dir
│   ├── index.html                 # marketing page + form + checkout
│   ├── sample-report.html         # "See sample report" link target
│   ├── success.html · cancel.html · 404.html · privacy.html · terms.html
│   └── favicon.svg · logo.svg · logo-mark.svg · og-image.svg
│
├── functions/                     # backend — Cloudflare Pages Functions (auto-routed)
│   ├── api/
│   │   ├── audit.js                  # POST /api/audit — free teaser endpoint
│   │   ├── create-invoice.js         # POST /api/create-invoice — creates NOWPayments checkout
│   │   └── nowpayments-webhook.js    # POST /api/nowpayments-webhook — paid order delivery
│   └── _shared/
│       ├── prompt.js          # JS mirror of the system prompt
│       ├── scraper.js         # site scraper (uses HTMLRewriter)
│       ├── analyzer.js        # Anthropic Claude API client (optional)
│       ├── cloudflareAI.js    # Cloudflare Workers AI client (free, default)
│       ├── auditFlow.js       # picks the cheapest available backend
│       ├── normalize.js       # normalizes AI output for the renderer
│       ├── renderer.js        # HTML report email body
│       ├── mailer.js          # Cloudflare Email Service client
│       ├── turnstile.js       # bot check verifier
│       └── nowpayments.js     # crypto payment processor + HMAC-SHA512
│
├── outreach/                      # day-1 sales materials
│   ├── linkedin_dm.md             # cold-DM templates + daily routine
│   ├── cold_email.md              # cold-email templates + funnel math
│   ├── niche_lists.md             # where to find prospects (free + paid)
│   └── onboarding_email.md        # post-purchase email sequence
│
├── PLAN.md                        # business model, pricing, channels
├── DEPLOY.md                      # 1-hour deployment guide ← START HERE
└── README.md
```

---

## How it works (the live product)

1. Visitor on `sitexray.xyz` pastes their URL and email
2. Cloudflare Pages Function (`functions/api/audit.js`) takes the request
3. It scrapes the homepage (HTMLRewriter), calls AI with the auditor prompt, gets back a structured JSON audit
4. Renders to an HTML email and sends via Cloudflare Email Service (`reports@sitexray.xyz`)
5. Visitor opens the report on their phone within 2 minutes

If they want the full report ($39), they click → NOWPayments crypto checkout → on payment, webhook hits `/api/nowpayments-webhook` → the same pipeline runs in full mode and delivers the audit.

The Python CLI (`audit.py`) does the exact same thing locally. Use it for testing, sales demos, or manual fulfillment of paid orders before you fully automate.

---

## Quick start — local Python CLI

For testing and manual fulfillment.

```powershell
cd "D:\Project 4"
pip install -r requirements.txt
copy .env.example .env
# Edit .env: paste your ANTHROPIC_API_KEY from console.anthropic.com

# Free teaser
python audit.py https://example.com --free --out teaser.html

# Full audit
python audit.py https://example.com --out report.html
```

Opens `report.html` in your browser. Save as PDF via Ctrl+P.

---

## Quick start — deploy live

See **[DEPLOY.md](DEPLOY.md)**. First-time setup: ~60 minutes. Costs $0 upfront (you need to put $5 on Anthropic for API credits, fully refunded by your first sale).

Required accounts (all free tier, no KYC, no card needed):
- [Cloudflare](https://dash.cloudflare.com) — hosting + backend + free AI inference (unlimited free)
- Cloudflare Email Service — email delivery (included with Cloudflare, no Resend)
- [NOWPayments](https://nowpayments.io) — accepts crypto payments (0.5% fee, crypto payouts to your wallet, no KYC for non-custodial flow)

Optional (quality upgrade once you have revenue):
- [Anthropic](https://console.anthropic.com) — Claude API for the $39 tier (~$0.30/report, $5 minimum prepay)

---

## Roadmap

- [x] MVP: Python CLI generating HTML reports
- [x] Production landing page (English, dark theme)
- [x] Cloudflare Pages backend (free teaser + paid webhook)
- [x] Sample report for "See sample" link
- [x] Deploy guide
- [x] Outreach playbook (LinkedIn DMs, cold email, niches)
- [ ] First 10 sales (manual fulfillment via CLI to validate prompt quality)
- [x] Cloudflare Email Service from `reports@sitexray.xyz`
- [ ] Add multi-page crawl option (currently homepage only)
- [ ] Add screenshots to the report via headless Chrome
- [ ] Agency white-label tier ($15/audit wholesale)

---

## Business model

See **[PLAN.md](PLAN.md)** for the full breakdown. TL;DR:

- **$0 free teaser** → lead magnet (cost: ~$0.05 API)
- **$39 full audit** → core SKU (net margin ~$36)
- **$299+ done-for-you** → upsell after the audit
- **$15/audit wholesale** → agencies, partnership tier (future)

Target: English-speaking SMBs in US, UK, Canada, Australia, Western EU. Not RU/CIS (per founder choice).

