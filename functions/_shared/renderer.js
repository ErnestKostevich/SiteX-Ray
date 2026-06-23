// Renders audit JSON → self-contained HTML (email + web download).
// Clean SiteX-Ray brand — professional audit report, Gmail/Outlook safe tables.

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const C = {
  outer: "#eef2f7",
  card: "#ffffff",
  soft: "#f8fafc",
  ink: "#0f172a",
  inkSoft: "#334155",
  muted: "#64748b",
  border: "#e2e8f0",
  accent: "#6366f1",
  accentSoft: "#eef2ff",
  accentDark: "#4f46e5",
};

function scoreColor(score) {
  const s = Number(score) || 0;
  if (s >= 80) return "#16a34a";
  if (s >= 60) return "#ca8a04";
  if (s >= 40) return "#ea580c";
  return "#dc2626";
}

function verdictColor(verdict) {
  const v = String(verdict || "").toLowerCase();
  if (v.includes("critical")) return "#dc2626";
  if (v.includes("needs")) return "#ea580c";
  if (v.includes("good")) return "#16a34a";
  if (v.includes("excellent")) return "#0891b2";
  return "#6366f1";
}

function severityColor(sev) {
  const s = String(sev || "").toLowerCase();
  return (
    { critical: "#dc2626", high: "#ea580c", medium: "#ca8a04", low: "#0284c7" }[s] ||
    "#6366f1"
  );
}

function brandHeader(free) {
  const badge = free ? "Free preview" : "Full report";
  const badgeBg = free ? C.accentSoft : "#f0fdf4";
  const badgeColor = free ? C.accentDark : "#166534";
  const badgeBorder = free ? "#c7d2fe" : "#bbf7d0";

  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:28px;">
    <tr>
      <td valign="middle">
        <table cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="40" height="40" align="center" valign="middle" style="width:40px;height:40px;border-radius:10px;background:${C.accent};color:#fff;font-size:18px;font-weight:800;">X</td>
          <td style="padding-left:12px;">
            <div style="font-size:20px;font-weight:800;color:${C.ink};letter-spacing:-0.03em;line-height:1.1;">Site<span style="color:${C.accent};">X</span>-Ray</div>
            <div style="font-size:11px;color:${C.muted};margin-top:2px;">AI website audit</div>
          </td>
        </tr></table>
      </td>
      <td align="right" valign="middle">
        <span style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;padding:6px 14px;border-radius:999px;background:${badgeBg};color:${badgeColor};border:1px solid ${badgeBorder};">${badge}</span>
      </td>
    </tr>
  </table>`;
}

function sectionTitle(text) {
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:32px 0 14px;">
    <tr><td style="font-size:18px;font-weight:700;color:${C.ink};padding-bottom:8px;border-bottom:2px solid ${C.ink};letter-spacing:-0.02em;">${text}</td></tr>
  </table>`;
}

function scoreBar(label, score) {
  const col = scoreColor(score);
  const pct = Math.min(100, Math.max(0, Number(score) || 0));
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:10px;">
    <tr>
      <td width="72" style="font-size:12px;font-weight:600;color:${C.muted};">${esc(label)}</td>
      <td style="padding:0 12px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.border};border-radius:99px;height:8px;">
          <tr><td width="${pct}%" style="background:${col};border-radius:99px;height:8px;font-size:0;line-height:0;">&nbsp;</td><td style="font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
      </td>
      <td width="36" align="right" style="font-size:14px;font-weight:800;color:${col};">${esc(score)}</td>
    </tr>
  </table>`;
}

function findingHtml(f, showFix = true) {
  if (!f) return "";
  const sev = String(f.severity || "medium").toLowerCase();
  const sevCol = severityColor(sev);
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:12px;border-collapse:separate;border-radius:10px;background:${C.soft};border:1px solid ${C.border};border-left:4px solid ${sevCol};">
    <tr><td style="padding:16px 18px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding-bottom:8px;">
        <span style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#fff;padding:3px 10px;border-radius:4px;font-weight:700;background:${sevCol};">${esc(sev)}</span>
        <span style="font-size:15px;font-weight:700;color:${C.ink};margin-left:8px;">${esc(f.title)}</span>
      </td></tr></table>
      <div style="font-size:14px;line-height:1.65;color:${C.inkSoft};">
        ${f.what ? `<p style="margin:4px 0;"><strong style="color:${C.ink};">What:</strong> ${esc(f.what)}</p>` : ""}
        ${f.why ? `<p style="margin:4px 0;"><strong style="color:${C.ink};">Why it matters:</strong> ${esc(f.why)}</p>` : ""}
        ${showFix && f.how ? `<p style="margin:4px 0;"><strong style="color:${C.accent};">How to fix:</strong> ${esc(f.how)}</p>` : ""}
      </div>
    </td></tr>
  </table>`;
}

function quickWinHtml(qw, index) {
  if (!qw) return "";
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:10px;border-collapse:separate;border-radius:10px;background:${C.card};border:1px solid ${C.border};">
    <tr><td style="padding:16px 18px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td width="28" valign="top">
          <div style="width:24px;height:24px;border-radius:6px;background:${C.accent};color:#fff;font-size:12px;font-weight:800;text-align:center;line-height:24px;">${index}</div>
        </td>
        <td style="padding-left:12px;">
          <div style="font-size:15px;font-weight:700;color:${C.ink};margin-bottom:6px;">${esc(qw.title)}</div>
          <div style="font-size:13px;color:${C.muted};margin-bottom:8px;">
            <span style="display:inline-block;padding:2px 8px;background:${C.soft};border-radius:999px;margin-right:6px;">⏱ ${esc(qw.effort)}</span>
            <span style="display:inline-block;padding:2px 8px;background:${C.soft};border-radius:999px;">Impact: ${esc(qw.impact)}</span>
          </div>
          <div style="font-size:14px;line-height:1.6;color:${C.inkSoft};">${esc(qw.how)}</div>
        </td>
      </tr></table>
    </td></tr>
  </table>`;
}

function recommendationHtml(r, index) {
  if (!r) return "";
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:10px;border-collapse:separate;border-radius:10px;background:${C.soft};border:1px solid ${C.border};">
    <tr><td style="padding:16px 18px;">
      <div style="font-size:15px;font-weight:700;color:${C.ink};margin-bottom:6px;">${index}. ${esc(r.title)}</div>
      <div style="font-size:13px;color:${C.muted};margin-bottom:8px;">Effort: ${esc(r.estimated_effort)}</div>
      <div style="font-size:14px;line-height:1.6;color:${C.inkSoft};">${esc(r.rationale)}</div>
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
  conversion: "Convert",
  technical: "Tech",
};

export function renderReport(report, opts = {}) {
  const { free = false, ctaUrl = null } = opts;
  const premium = !free;

  const headerCol = scoreColor(report.overall_score);
  const verdictBg = verdictColor(report.verdict);

  const dimensionBars = Object.entries(SECTION_SHORT)
    .map(([key, label]) => {
      const sec = (report.sections && report.sections[key]) || {};
      return scoreBar(label, sec.score ?? 0);
    })
    .join("");

  const upsell = free
    ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:32px 0;border-collapse:separate;border-radius:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);">
        <tr><td style="padding:28px 24px;text-align:center;">
          <div style="font-size:20px;font-weight:800;color:#fff;margin:0 0 8px;">Want the full picture?</div>
          <p style="margin:0 0 18px;color:rgba(255,255,255,0.9);font-size:15px;line-height:1.55;">This was the free teaser. The full report includes every issue, all 5 dimensions, and a 90-day action plan.</p>
          ${ctaUrl ? `<a href="${esc(ctaUrl)}" style="display:inline-block;padding:14px 28px;background:#fff;color:${C.accentDark};border-radius:10px;font-weight:700;text-decoration:none;font-size:15px;">Get full audit — $39 USDT</a>` : `<span style="display:inline-block;padding:14px 28px;background:#fff;color:${C.accentDark};border-radius:10px;font-weight:700;font-size:15px;">Get full audit — $39 USDT at sitexray.xyz</span>`}
        </td></tr>
      </table>`
    : "";

  const sectionBlocks = premium
    ? Object.entries(SECTION_LABELS)
        .map(([key, label]) => {
          const sec = (report.sections && report.sections[key]) || {};
          if (!sec.score && !(sec.findings || []).length) return "";
          const findings = (sec.findings || []).map((f) => findingHtml(f, true)).join("");
          return `<div style="margin-bottom:24px;">
            <div style="font-size:16px;font-weight:700;color:${C.ink};margin-bottom:6px;">${esc(label)} <span style="color:${scoreColor(sec.score)};">${esc(sec.score)}/100</span></div>
            ${sec.summary ? `<p style="color:${C.muted};margin:0 0 12px;font-size:14px;line-height:1.55;">${esc(sec.summary)}</p>` : ""}
            ${findings}
          </div>`;
        })
        .join("")
    : "";

  const quickWins = (report.quick_wins || [])
    .map((qw, i) => quickWinHtml(qw, i + 1))
    .join("");
  const criticals = (report.critical_issues || [])
    .map((f) => findingHtml(f, premium))
    .join("");
  const longTerm = premium
    ? (report.long_term || []).map((r, i) => recommendationHtml(r, i + 1)).join("")
    : "";

  const paidRibbon = premium
    ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:20px;">
        <tr><td style="padding:12px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;text-align:center;">
          <span style="color:#166534;font-size:13px;font-weight:600;">✓ Full audit report — all dimensions, issues, and 90-day plan included</span>
        </td></tr>
      </table>`
    : "";

  const cardInner = `
  <table cellpadding="0" cellspacing="0" border="0" width="640" style="max-width:640px;width:100%;background:${C.card};border-radius:16px;border:1px solid ${C.border};box-shadow:0 4px 24px rgba(15,23,42,0.08);">
  <tr><td style="height:4px;background:linear-gradient(90deg,${C.accent},#8b5cf6);border-radius:16px 16px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr><td style="padding:36px 32px 40px;">

    ${brandHeader(free)}
    ${paidRibbon}

    <h1 style="font-size:28px;margin:0 0 4px;color:${C.ink};font-weight:800;letter-spacing:-0.03em;line-height:1.15;">${esc(report.domain)}</h1>
    <div style="font-size:13px;margin-bottom:24px;"><a href="${esc(report.url)}" style="color:${C.accent};text-decoration:none;">${esc(report.url)}</a></div>

    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:28px;background:${C.soft};border:1px solid ${C.border};border-radius:12px;">
      <tr>
        <td width="120" align="center" valign="middle" style="padding:24px 12px;">
          <table cellpadding="0" cellspacing="0" border="0" width="96" height="96" style="border-radius:50%;background:${headerCol};">
            <tr><td align="center" valign="middle" style="color:#fff;">
              <div style="font-size:38px;font-weight:800;line-height:1;">${esc(report.overall_score)}</div>
              <div style="font-size:11px;margin-top:2px;opacity:0.9;">/ 100</div>
            </td></tr>
          </table>
        </td>
        <td valign="middle" style="padding:20px 20px 20px 0;">
          <span style="display:inline-block;padding:5px 12px;border-radius:999px;color:#fff;font-size:11px;font-weight:700;letter-spacing:0.04em;background:${verdictBg};margin-bottom:10px;">${esc(report.verdict)}</span>
          <p style="font-size:16px;line-height:1.55;margin:0 0 8px;color:${C.ink};font-weight:500;">${esc(report.tldr)}</p>
          ${report.headline_finding ? `<p style="color:${C.muted};font-size:13px;margin:0;line-height:1.5;border-left:3px solid ${C.accent};padding-left:12px;">${esc(report.headline_finding)}</p>` : ""}
        </td>
      </tr>
    </table>

    ${sectionTitle("Scores by dimension")}
    ${dimensionBars}

    ${quickWins ? sectionTitle(free ? "Top quick wins" : "Quick wins — ship today") + quickWins : ""}
    ${criticals ? sectionTitle(free ? "Most critical issue" : "Critical issues") + criticals : ""}
    ${upsell}
    ${sectionBlocks ? sectionTitle("Detailed analysis") + sectionBlocks : ""}
    ${longTerm ? sectionTitle("90-day strategic plan") + longTerm : ""}

    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:36px;border-top:1px solid ${C.border};">
      <tr><td style="padding-top:20px;text-align:center;color:${C.muted};font-size:12px;line-height:1.6;">
        <span style="color:${C.accent};font-weight:700;">SiteX-Ray</span> · AI website audit<br>
        Generated ${new Date().toUTCString()}
      </td></tr>
    </table>

  </td></tr>
  </table>`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>SiteX-Ray — ${esc(report.domain)}</title>
<style>
  @media screen {
    body { margin: 0; padding: 24px 16px; background: ${C.outer}; }
  }
  @media print {
    body { background: #fff; padding: 0; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.outer};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-text-size-adjust:100%;">
<table cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${C.outer}" style="background:${C.outer};">
  <tr><td align="center" style="padding:32px 16px 48px;">
    ${cardInner}
  </td></tr>
</table>
</body>
</html>`;
}