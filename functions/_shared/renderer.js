// Renders audit JSON → self-contained HTML email (table layout, Gmail/Outlook safe).

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const THEMES = {
  free: {
    badge: "ORBIT SCAN · FREE PREVIEW",
    badgeBg: "#312e81",
    badgeColor: "#c7d2fe",
    outerBg: "#07090d",
    cardBg: "#0e1117",
    cardBorder: "#312e81",
    ink: "#f0f6fc",
    inkSoft: "#c9d1d9",
    muted: "#8b949e",
    accent: "#818cf8",
    accent2: "#c084fc",
    scoreRing: "#6366f1",
    sectionBg: "#12161d",
    sectionBorder: "#21262d",
    upsellBg: "#312e81",
    upsellBorder: "#4f46e5",
    footer: "#636e7b",
    h2Border: "#818cf8",
  },
  paid: {
    badge: "FULL MISSION REPORT · PREMIUM",
    badgeBg: "#3b2f1e",
    badgeColor: "#fde68a",
    outerBg: "#050508",
    cardBg: "#0a0c12",
    cardBorder: "#a78bfa",
    ink: "#fafafa",
    inkSoft: "#e2e8f0",
    muted: "#94a3b8",
    accent: "#a78bfa",
    accent2: "#f472b6",
    scoreRing: "#fbbf24",
    sectionBg: "#111318",
    sectionBorder: "#3f3f46",
    upsellBg: null,
    upsellBorder: null,
    footer: "#71717a",
    h2Border: "#fbbf24",
    premiumBar: "#fbbf24",
  },
};

function scoreColor(score) {
  const s = Number(score) || 0;
  if (s >= 80) return "#34d399";
  if (s >= 60) return "#fbbf24";
  if (s >= 40) return "#fb923c";
  return "#f87171";
}

function verdictColor(verdict) {
  const v = String(verdict || "").toLowerCase();
  if (v.includes("critical")) return "#f87171";
  if (v.includes("needs")) return "#fb923c";
  if (v.includes("good")) return "#34d399";
  if (v.includes("excellent")) return "#22d3ee";
  return "#818cf8";
}

function severityColor(sev) {
  const s = String(sev || "").toLowerCase();
  return (
    { critical: "#f87171", high: "#fb923c", medium: "#fbbf24", low: "#38bdf8" }[s] ||
    "#818cf8"
  );
}

function sectionHeading(text, t) {
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:36px 0 16px;">
    <tr><td style="font-size:20px; font-weight:700; color:${t.ink}; padding-bottom:10px; border-bottom:2px solid ${t.h2Border}; letter-spacing:-0.02em;">${text}</td></tr>
  </table>`;
}

function findingHtml(f, t) {
  if (!f) return "";
  const sev = String(f.severity || "medium").toLowerCase();
  const sevColor = severityColor(sev);
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:14px; border-collapse:separate; border-radius:10px; background:${t.sectionBg}; border:1px solid ${t.sectionBorder}; border-left:4px solid ${sevColor};">
  <tr><td style="padding:16px 18px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
      <td style="padding-bottom:8px;">
        <span style="font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:#fff; padding:3px 10px; border-radius:999px; font-weight:700; background:${sevColor};">${esc(sev)}</span>
        <span style="font-size:16px; font-weight:700; color:${t.ink}; margin-left:8px;">${esc(f.title)}</span>
      </td>
    </tr></table>
    <div style="font-size:14px; line-height:1.6; color:${t.inkSoft};">
      ${f.what ? `<p style="margin:6px 0;"><span style="color:${t.accent}; font-weight:600;">Signal:</span> ${esc(f.what)}</p>` : ""}
      ${f.why ? `<p style="margin:6px 0;"><span style="color:${t.accent}; font-weight:600;">Impact:</span> ${esc(f.why)}</p>` : ""}
      ${f.how ? `<p style="margin:6px 0;"><span style="color:${t.accent}; font-weight:600;">Fix:</span> ${esc(f.how)}</p>` : ""}
    </div>
  </td></tr>
</table>`;
}

function quickWinHtml(qw, t, premium = false) {
  if (!qw) return "";
  const border = premium ? t.premiumBar || t.accent : t.sectionBorder;
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:12px; border-collapse:separate; border-radius:12px; background:${t.sectionBg}; border:1px solid ${border};">
  <tr><td style="padding:18px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
      <td style="font-size:16px; font-weight:700; color:${t.ink}; vertical-align:top;">${premium ? "◆ " : "▸ "}${esc(qw.title)}</td>
      <td align="right" style="font-size:11px; color:${t.muted}; white-space:nowrap; vertical-align:top; padding-left:10px;">
        <span style="padding:3px 10px; background:#1a1f27; border-radius:999px; border:1px solid ${t.sectionBorder};">${esc(qw.effort)}</span>
        <span style="padding:3px 10px; background:#1a1f27; border-radius:999px; border:1px solid ${t.sectionBorder}; margin-left:4px;">${esc(qw.impact)}</span>
      </td>
    </tr></table>
    <div style="font-size:14px; line-height:1.6; color:${t.inkSoft}; margin-top:10px;">${esc(qw.how)}</div>
  </td></tr>
</table>`;
}

function recommendationHtml(r, t) {
  if (!r) return "";
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:12px; border-collapse:separate; border-radius:12px; background:${t.sectionBg}; border:1px solid ${t.premiumBar || t.accent};">
  <tr><td style="padding:18px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
      <td style="font-size:16px; font-weight:700; color:${t.ink};">✦ ${esc(r.title)}</td>
      <td align="right" style="font-size:11px; color:${t.muted}; padding-left:10px;">
        <span style="padding:3px 10px; background:#1a1f27; border-radius:999px; border:1px solid ${t.sectionBorder};">${esc(r.estimated_effort)}</span>
      </td>
    </tr></table>
    <div style="font-size:14px; line-height:1.6; color:${t.inkSoft}; margin-top:10px;">${esc(r.rationale)}</div>
  </td></tr>
</table>`;
}

const SECTION_LABELS = {
  seo: "SEO",
  ux: "UX & usability",
  content: "Content & tone",
  conversion: "Conversion & CTAs",
  technical: "Technical health",
};

const SECTION_SHORT = {
  seo: "SEO",
  ux: "UX",
  content: "Content",
  conversion: "CTA",
  technical: "Tech",
};

export function renderReport(report, opts = {}) {
  const { free = false, ctaUrl = null } = opts;
  const t = free ? THEMES.free : THEMES.paid;
  const premium = !free;

  const sectionsGrid = Object.entries(SECTION_SHORT)
    .map(([key, label]) => {
      const sec = (report.sections && report.sections[key]) || {};
      const score = sec.score ?? 0;
      const col = scoreColor(score);
      return `<td width="20%" align="center" style="padding:4px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${t.sectionBg}; border:1px solid ${t.sectionBorder}; border-radius:10px;">
          <tr><td align="center" style="padding:14px 8px;">
            <div style="font-size:10px; text-transform:uppercase; letter-spacing:.1em; color:${t.muted}; margin-bottom:6px;">${esc(label)}</div>
            <div style="font-size:26px; font-weight:800; color:${col}; line-height:1;">${esc(score)}</div>
          </td></tr>
        </table>
      </td>`;
    })
    .join("");

  const upsell = free
    ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:36px 0; border-collapse:separate; border-radius:14px; background:${t.upsellBg}; border:1px solid ${t.upsellBorder};">
        <tr><td style="padding:28px 24px; text-align:center;">
          <div style="font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:#a5b4fc; margin-bottom:8px;">Unlock full orbit scan</div>
          <h2 style="color:#fff; margin:0 0 10px; font-size:22px; font-weight:800;">This was your free preview</h2>
          <p style="margin:0 0 18px; color:#c7d2fe; font-size:15px; line-height:1.55;">Full mission report: 5 deep-dive sectors, every critical issue, 5–7 quick wins, and a 90-day flight plan.</p>
          ${ctaUrl ? `<a href="${esc(ctaUrl)}" style="display:inline-block; padding:14px 28px; background:#f0f6fc; color:#312e81; border-radius:10px; font-weight:700; text-decoration:none; font-size:15px;">Get full audit — $39</a>` : ""}
        </td></tr>
      </table>`
    : "";

  const paidBanner = premium
    ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;">
        <tr><td align="center" style="padding:12px 16px; background:#1a1508; border:1px solid #fbbf24; border-radius:10px; color:#fde68a; font-size:13px; font-weight:600; letter-spacing:.04em;">
          ✦ Premium mission complete — full strategic intelligence below
        </td></tr>
      </table>`
    : "";

  const sectionBlocks = premium
    ? Object.entries(SECTION_LABELS)
        .map(([key, label]) => {
          const sec = (report.sections && report.sections[key]) || {};
          if (!sec.score && !(sec.findings || []).length) return "";
          const findings = (sec.findings || []).map((f) => findingHtml(f, t)).join("");
          return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:28px;">
            <tr><td>
              <div style="font-size:17px; font-weight:700; color:${t.ink}; margin-bottom:8px;">${esc(label)} <span style="color:${scoreColor(sec.score)};">${esc(sec.score)}/100</span></div>
              ${sec.summary ? `<p style="color:${t.muted}; margin-bottom:14px; font-size:14px; line-height:1.55;">${esc(sec.summary)}</p>` : ""}
              ${findings}
            </td></tr>
          </table>`;
        })
        .join("")
    : "";

  const quickWins = (report.quick_wins || [])
    .map((qw) => quickWinHtml(qw, t, premium))
    .join("");
  const criticals = (report.critical_issues || [])
    .map((f) => findingHtml(f, t))
    .join("");
  const longTerm = premium
    ? (report.long_term || []).map((r) => recommendationHtml(r, t)).join("")
    : "";

  const headerColor = scoreColor(report.overall_score);
  const verdictBg = verdictColor(report.verdict);

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>SiteX-Ray — ${esc(report.domain)}</title>
</head>
<body style="margin:0; padding:0; background:${t.outerBg}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; -webkit-text-size-adjust:100%;">
<table cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${t.outerBg}" style="background:${t.outerBg};"><tr><td align="center" style="padding:32px 12px;">

  <!-- Brand header -->
  <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px; width:100%; margin-bottom:12px;">
    <tr><td align="center" style="padding-bottom:8px;">
      <span style="font-size:22px; font-weight:800; letter-spacing:-0.03em; color:${t.ink};">Site<span style="color:${t.accent};">X</span>-Ray</span>
    </td></tr>
    <tr><td align="center">
      <span style="font-size:10px; letter-spacing:.14em; text-transform:uppercase; padding:6px 14px; border-radius:999px; background:${t.badgeBg}; color:${t.badgeColor}; font-weight:700;">${t.badge}</span>
    </td></tr>
  </table>

  <!-- Main card -->
  <table cellpadding="0" cellspacing="0" border="0" width="600" bgcolor="${t.cardBg}" style="max-width:600px; width:100%; background:${t.cardBg}; border-radius:16px; border:1px solid ${t.cardBorder};">
  <tr><td style="padding:36px 28px;">

    <h1 style="font-size:26px; margin:0 0 6px; color:${t.ink}; font-weight:800; letter-spacing:-0.02em; line-height:1.2;">${esc(report.domain)}</h1>
    <div style="font-size:13px; margin-bottom:24px;"><a href="${esc(report.url)}" style="color:${t.accent}; text-decoration:none;">${esc(report.url)}</a></div>

    ${paidBanner}

    <!-- Score hero -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:28px; background:${t.sectionBg}; border:1px solid ${t.sectionBorder}; border-radius:14px;">
      <tr>
        <td width="110" align="center" valign="middle" style="padding:20px 10px;">
          <table cellpadding="0" cellspacing="0" border="0" width="96" height="96" style="border-radius:50%; background:${headerColor}; border:3px solid ${t.scoreRing};">
            <tr><td align="center" valign="middle" style="color:#fff;">
              <div style="font-size:36px; font-weight:800; line-height:1;">${esc(report.overall_score)}</div>
              <div style="font-size:10px; margin-top:2px; opacity:.9;">/100</div>
            </td></tr>
          </table>
        </td>
        <td valign="middle" style="padding:18px 14px 18px 0;">
          <span style="display:inline-block; padding:5px 12px; border-radius:999px; color:#fff; font-size:11px; font-weight:700; letter-spacing:.04em; background:${verdictBg}; margin-bottom:10px;">${esc(report.verdict)}</span>
          <p style="font-size:16px; line-height:1.55; margin:0 0 8px; color:${t.ink}; font-weight:500;">${esc(report.tldr)}</p>
          ${report.headline_finding ? `<p style="color:${t.muted}; font-size:13px; margin:0; line-height:1.5; border-left:2px solid ${t.accent}; padding-left:10px;">${esc(report.headline_finding)}</p>` : ""}
        </td>
      </tr>
    </table>

    <!-- Sector scores -->
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:8px;">
      <tr><td style="font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:${t.muted}; padding-bottom:10px;">Sector scan</td></tr>
    </table>
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:28px;"><tr>${sectionsGrid}</tr></table>

    ${quickWins ? sectionHeading(free ? "Top quick wins" : "Quick wins — deploy now", t) + quickWins : ""}
    ${criticals ? sectionHeading(free ? "Critical signal" : "Critical issues", t) + criticals : ""}
    ${upsell}
    ${sectionBlocks ? sectionHeading("Deep sector analysis", t) + sectionBlocks : ""}
    ${longTerm ? sectionHeading("90-day mission plan", t) + longTerm : ""}

    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:36px; border-top:1px solid ${t.sectionBorder};">
      <tr><td style="padding-top:20px; text-align:center; color:${t.footer}; font-size:12px; line-height:1.6;">
        <span style="color:${t.accent}; font-weight:700;">SiteX-Ray</span> · AI-powered website audit<br>
        <span style="color:${t.muted};">${new Date().toUTCString()}</span>
      </td></tr>
    </table>

  </td></tr>
  </table>

</td></tr></table>
</body>
</html>`;
}