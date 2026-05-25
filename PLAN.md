# PLAN.md — SiteX-Ray business plan

## TL;DR
AI website auditor for SMBs in EU & North America. Sells one-shot reports for $39 via a static landing page. **$0 upfront cost** to the founder — every piece runs on a free tier or post-revenue commission. First sale should fully cover the cost of the next 100 reports.

---

## Constraints (founder rules)

- **Truly $0 upfront cost.** No paid hosting, no paid SaaS, no minimum-credit prepayment to any vendor, no marketing budget on day 1.
- **Founder never pays for user-generated traffic.** Free teasers run on Cloudflare Workers AI (free tier). Paid audits — when sold — pull from the $39 customer payment, never out of founder pocket.
- **English-speaking, high-purchasing-power audience only.** Targeting US, UK, Canada, Australia, Western Europe SMBs. No RU/CIS.
- **No SaaS subscriptions.** One-time payments, services, or ad/traffic-based revenue.

---

## The free-tier stack (every dollar accounted for)

| Layer | Tool | Cost on day 1 | Cost at scale |
|-------|------|---------------|---------------|
| Domain | use Cloudflare's `*.pages.dev` subdomain | $0 | $10/yr (custom) |
| Hosting (landing) | Cloudflare Pages | $0 (unlimited free) | $0 |
| Backend (form → audit) | Cloudflare Pages Functions (free 100k req/day) | $0 | $0 until 100k/day |
| **AI inference — free teaser** | **Cloudflare Workers AI / Llama 3.1 8B** | **$0 (free 10k Neurons/day)** | **~$0.001/teaser past free tier** |
| AI inference — paid audit (default) | Same Cloudflare Workers AI | $0 | ~$0.005/audit past free tier |
| AI inference — paid audit (OPTIONAL upgrade) | Anthropic Claude Sonnet | $5 prepay (only if you opt in) | ~$0.30/audit |
| Email delivery | Resend free tier (3000/mo) | $0 | $20/mo at scale |
| Payments | Lemon Squeezy | ~7% per sale, $0 upfront | ~7% per sale |
| Anti-bot | Cloudflare Turnstile | $0 | $0 |

**Truly $0 to launch.** Cloudflare gives free AI inference. The only money that ever leaves your account is the ~7% Lemon Squeezy takes per sale — deducted automatically from the $39 customer payment, never out-of-pocket.

### Net economics — Mode A (default, Cloudflare AI throughout)

Per $39 sale:
- Lemon Squeezy fee (~7%): -$2.73
- AI inference: -$0.00 (free tier covers indie volume)
- Email: -$0.00
- **Margin: ~$36.27 per sale**

### Net economics — Mode B (optional Claude upgrade for paid tier)

Per $39 sale:
- Lemon Squeezy fee (~7%): -$2.73
- Anthropic Claude API (~one full report): -$0.30
- Email: -$0.00
- **Margin: ~$35.97 per sale**

Mode B requires $5 prepay on Anthropic (refunded by first sale). The trade-off you pay $0.30 for: noticeably better writing in the paid report, more specific fixes, lower refund rate.

**Recommended path:** launch in Mode A → make first 5 sales → switch to Mode B for quality. Both modes are profitable from sale #1.

---

## Two operating modes (pick based on volume)

### Mode A: Manual fulfillment (week 1–4)
1. Customer pays $39 on landing page → Lemon Squeezy webhook → email to founder
2. Founder copy/pastes URL into `python audit.py <url>` on their laptop
3. Saves HTML as PDF (browser Ctrl+P), emails to customer
4. **Pros:** zero infrastructure, total quality control, ship today
5. **Cons:** founder is the bottleneck — caps at maybe 20 reports/day

### Mode B: Automated (after 50+ sales validates demand)
1. Customer pays → Lemon Squeezy webhook → Cloudflare Worker
2. Worker calls Claude API → renders HTML → PDF via Puppeteer or browserless free tier
3. Worker emails PDF via Resend
4. **Pros:** scales infinitely, founder sleeps
5. **Cons:** ~1 day of dev work, more moving parts to debug

**Decision rule:** stay manual until you hit 5 sales/day for 3 consecutive days. Then automate.

### Mode C (optional, alternative monetization): BYOK
Sell the Python tool itself on Gumroad for $19 ("audit any website with your own Anthropic key"). Targets dev-savvy customers and agencies. Smaller market, but $0 ongoing costs and instant scale.

---

## Target customer (English-speaking, high LTV)

- US/UK/CA/AU local services: dentists, lawyers, plumbers, real-estate brokers, dental practices, accountants
- Western European SMBs running their own e-commerce
- Solopreneurs and consultants with personal sites that aren't converting
- Small marketing agencies needing quick audits as sales tools (partnership angle)

**Where they live (channels by priority):**
1. **LinkedIn cold outreach** — search "owner [niche] [city]", DM with a pre-generated free teaser audit as a personalized hook. ~$0 cost, founder time.
2. **Reddit niche subs** — r/Entrepreneur, r/smallbusiness, r/Plumbing etc. Post case-study "I audited 10 plumber sites, here's what I found." Soft CTA in comments.
3. **Twitter/X mini-audits** — public threads "Auditing a random SMB site live." Each thread = 1–3 leads.
4. **Cold email** to scraped lists (Apollo free tier = 50 emails/day).
5. **SEO content** — long-tail "[niche] website audit checklist 2026" posts. Slow but compounds.

---

## Pricing ladder

| Tier | Price | What | Margin |
|------|-------|------|--------|
| Free teaser | $0 | 1 page, hook the lead | -$0.05 (API cost as marketing) |
| Full audit | **$39** | 10–15 page PDF | ~$36 |
| Done-for-you | $299–$499 | Audit + we implement fixes | ~$200–$400 (founder time) |
| Agency partnership | $15/audit wholesale (50+) | White-label audits | ~$12 |

**Why $39:**
- Below "I need to think about it" threshold ($50) → impulse-buy zone
- Above "must be junk" threshold ($9) → signals quality
- Comparable: PageSpeed is free, consultants are $2000+ — we fit in a previously empty gap

---

## 4-week roadmap (specific)

### Week 1 — Build & ship landing
- [x] MVP CLI (`audit.py`) working
- [x] Landing page (`landing/index.html`)
- [ ] Deploy landing to Cloudflare Pages (subdomain)
- [ ] Connect Lemon Squeezy checkout to landing
- [ ] Buy $5 Anthropic API credit
- [ ] Run audits on 10 friends' / acquaintances' sites → gather feedback → refine prompt

### Week 2 — First sales (manual mode)
- [ ] LinkedIn cold outreach: 50 DMs/day to US dentists, lawyers, plumbers with personalized free teaser
- [ ] Post one mini-audit thread on Twitter/X
- [ ] Post one case study on r/smallbusiness or r/Entrepreneur
- [ ] **Goal: 5 sales = $195**

### Week 3 — Iterate & scale
- [ ] Identify which channel converted best, double down
- [ ] Improve prompt based on customer feedback ("not specific enough" / "too long")
- [ ] Add testimonials section to landing (from real buyers)
- [ ] **Goal: 15 sales = $585 cumulative**

### Week 4 — Automate & upsell
- [ ] If hitting 5+ sales/day, automate with Cloudflare Worker
- [ ] Add post-purchase upsell page → "Want us to fix it? $299"
- [ ] First done-for-you project: ~$300
- [ ] **Goal: 25 audits + 1 service = $1275 cumulative**

---

## Metrics that matter

- **Landing → free teaser conversion:** target 8–15%
- **Teaser → paid conversion:** target 5–10%
- **LinkedIn DM → reply rate:** target 10%
- **Cost per acquired customer (CAC):** target < $5 (founder time only on day 1)
- **Refund rate:** must stay below 5%
- **Time to first sale:** target < 14 days from landing live

---

## Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Claude generates generic advice | Tight prompt with banned phrases, evidence-cited findings, sample reports reviewed before each prompt update |
| Cloudflare / Lemon Squeezy / Resend changes free-tier limits | Architecture is portable: swap to Vercel / Stripe / Mailgun, all have similar free tiers |
| Founder can't fulfill 20 reports/day manually | Hit that limit only after $780/day MRR; automate at that point |
| Competitors copy the idea | First-mover advantage compounds via SEO + reviews. Prompt is the moat — keep iterating on it. |
| Customers expect ongoing service | Position clearly as one-shot. Upsell to done-for-you for relationship-style buyers. |
| Sites block our scraper | User-Agent rotation, fallback to taking raw HTML from buyer |

---

## What we're explicitly NOT doing

- ❌ SaaS subscription
- ❌ Paid ads before validating with cold outreach
- ❌ Building for RU/CIS market (lower ARPU, payment friction)
- ❌ Multi-page deep crawls in MVP (homepage = 80% of insights)
- ❌ Native mobile app
- ❌ White-label dashboard before first 100 sales
