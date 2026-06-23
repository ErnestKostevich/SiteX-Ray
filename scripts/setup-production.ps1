# SiteX-Ray production setup — run once after `npx wrangler login`
# Domain: sitexray.xyz | Pages project: sitexray

$ErrorActionPreference = "Stop"
$Domain = "sitexray.xyz"
$Project = "sitexray"

Write-Host "=== SiteX-Ray production setup ===" -ForegroundColor Cyan
Write-Host "Domain: $Domain"
Write-Host ""

# 1. Email sending
Write-Host "[1/4] Enabling Cloudflare Email Sending for $Domain..." -ForegroundColor Yellow
npx wrangler email sending enable $Domain
npx wrangler email sending dns get $Domain

# 2. Deploy latest code (includes EMAIL binding from wrangler.toml)
Write-Host "[2/4] Deploying to Cloudflare Pages..." -ForegroundColor Yellow
npx wrangler pages deploy landing --project-name=$Project --commit-dirty=true

# 3. Custom domain (may already exist — wrangler will report status)
Write-Host "[3/4] Adding custom domain $Domain to Pages project..." -ForegroundColor Yellow
npx wrangler pages project domain add $Domain --project-name=$Project 2>$null
npx wrangler pages project domain add "www.$Domain" --project-name=$Project 2>$null

# 4. Test email
Write-Host "[4/4] Sending test email (optional)..." -ForegroundColor Yellow
Write-Host "  npx wrangler email sending send --from reports@$Domain --to YOUR_EMAIL --subject 'SiteX-Ray test' --text 'Email works!'"

Write-Host ""
Write-Host "=== Manual steps in Cloudflare Dashboard ===" -ForegroundColor Green
Write-Host "1. Pages -> $Project -> Settings -> Bindings -> Add EMAIL binding (name: EMAIL)"
Write-Host "2. Pages -> $Project -> Settings -> Environment variables:"
Write-Host "     FROM_EMAIL = SiteX-Ray <reports@$Domain>"
Write-Host "     NOWPAYMENTS_API_KEY, NOWPAYMENTS_IPN_SECRET, TURNSTILE_SECRET"
Write-Host "3. Remove RESEND_API_KEY if still present"
Write-Host "4. NOWPayments IPN URL: https://$Domain/api/nowpayments-webhook"
Write-Host "5. Retry latest deployment"
Write-Host ""
Write-Host "Done. Test: https://$Domain" -ForegroundColor Cyan