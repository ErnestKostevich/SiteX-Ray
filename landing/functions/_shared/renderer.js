// Renders the audit JSON report to a self-contained HTML email body.

function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function scoreColor(score) {
  const s = Number(score) || 0;
  if (s >= 80) return "#16a34a";
  if (s >= 60) return "#ca8a04";
  if (s >= 40) return "#ea580c";
  return "#dc2626";
}

function verdictColor(verdict) {
  const v = String(verdict || "").toLowerCase();
  if (v.includes("critical") || v.includes("критич")) return "#dc2626";
  if (v.includes("needs") || v.includes("доработ")) return "#ea580c";
  if (v.includes("good") || v.includes("хорош")) return "#16a34a";
  if (v.includes("excellent") || v.includes("отлич")) return "#059669";
  return "#475569";
}

function severityColor(sev) {
  const s = String(sev || "").toLowerCase();
  return (
    {
      critical: "#dc2626",
      high: "#ea580c",
      medium: "#ca8a04",
      low: "#0369a1",
    }[s] || "#475569"
  );
}

function findingHtml(f) {
  if (!f) return "";
  const sev = String(f.severity || "medium").toLowerCase();
  const sevColor = severityColor(sev);
  return `<div style="border-left:4px solid ${sevColor}; padding:12px 16px; margin-bottom:14px; background:#f8fafc; border-radius:0 8px 8px 0;">
  <div>
    <span style="display:inline-block; font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:#fff; padding:2px 8px; border-radius:4px; margin-right:8px; font-weight:600; background:${sevColor};">${esc(sev)}</span>
    <strong style="font-size:16px;">${esc(f.title)}</strong>
  </div>
  <div style="margin-top:8px; font-size:14px; line-height:1.55;">
    ${f.what ? `<p style="margin:6px 0;"><strong>What:</strong> ${esc(f.what)}</p>` : ""}
    ${f.why ? `<p style="margin:6px 0;"><strong>Why it matters:</strong> ${esc(f.why)}</p>` : ""}
    ${f.how ? `<p style="margin:6px 0;"><strong>How to fix:</strong> ${esc(f.how)}</p>` : ""}
  </div>
</div>`;
}

function quickWinHtml(qw) {
  if (!qw) return "";
  return `<div style="border:1px solid #e2e8f0; border-radius:10px; padding:16px; margin-bottom:12px;">
  <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
    <strong style="font-size:16px;">${esc(qw.title)}</strong>
    <span style="font-size:12px; color:#64748b;">
      <span style="display:inline-block; padding:2px 8px; background:#f8fafc; border-radius:999px;">⏱ ${esc(qw.effort)}</span>
      <span style="display:inline-block; padding:2px 8px; background:#f8fafc; border-radius:999px; margin-left:6px;">📈 ${esc(qw.impact)}</span>
    </span>
  </div>
  <div style="font-size:14px; line-height:1.55;">${esc(qw.how)}</div>
</div>`;
}

function recommendationHtml(r) {
  if (!r) return "";
  return `<div style="border:1px solid #e2e8f0; border-radius:10px; padding:16px; margin-bottom:12px;">
  <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
    <strong style="font-size:16px;">${esc(r.title)}</strong>
    <span style="display:inline-block; padding:2px 8px; background:#f8fafc; border-radius:999px; font-size:12px; color:#64748b;">⏱ ${esc(r.estimated_effort)}</span>
  </div>
  <div style="font-size:14px; line-height:1.55;">${esc(r.rationale)}</div>
</div>`;
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

  const sectionsGrid = Object.entries(SECTION_SHORT)
    .map(([key, label]) => {
      const sec = (report.sections && report.sections[key]) || {};
      const score = sec.score ?? 0;
      return `<td style="padding:0 6px;"><div style="border:1px solid #e2e8f0; border-radius:10px; padding:16px 14px; text-align:center; background:#fff;">
        <div style="font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:#64748b; margin-bottom:8px;">${esc(label)}</div>
        <div style="font-size:28px; font-weight:700; color:${scoreColor(score)};">${esc(score)}</div>
      </div></td>`;
    })
    .join("");

  const upsell = free
    ? `<div style="margin:40px 0; padding:24px; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; border-radius:12px; text-align:center;">
        <h2 style="color:#fff; border:none; margin:0 0 8px; font-size:22px;">This was the free teaser</h2>
        <p style="margin:0 0 16px; opacity:.95;">In the full report: deep dives on all 5 dimensions, 5–7 quick wins, every critical issue, and a 90-day strategic plan. 10–15 pages.</p>
        ${ctaUrl ? `<a href="${esc(ctaUrl)}" style="display:inline-block; padding:12px 24px; background:#fff; color:#6366f1; border-radius:8px; font-weight:600; text-decoration:none;">Get the full audit — $39</a>` : ""}
      </div>`
    : "";

  const sectionBlocks = !free
    ? Object.entries(SECTION_LABELS)
        .map(([key, label]) => {
          const sec = (report.sections && report.sections[key]) || {};
          if (!sec.score && !(sec.findings || []).length) return "";
          const findings = (sec.findings || []).map(findingHtml).join("");
          return `<div style="margin-bottom:32px;">
          <h3 style="font-size:17px; margin:24px 0 8px;">${esc(label)} <span style="color:${scoreColor(sec.score)};">— ${esc(sec.score)}/100</span></h3>
          ${sec.summary ? `<p style="color:#64748b; margin-bottom:16px;">${esc(sec.summary)}</p>` : ""}
          ${findings}
        </div>`;
        })
        .join("")
    : "";

  const quickWins = (report.quick_wins || []).map(quickWinHtml).join("");
  const criticals = (report.critical_issues || []).map(findingHtml).join("");
  const longTerm = !free
    ? (report.long_term || []).map(recommendationHtml).join("")
    : "";

  const headerColor = scoreColor(report.overall_score);
  const verdictBgColor = verdictColor(report.verdict);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Site audit — ${esc(report.domain)}</title>
</head>
<body style="margin:0; padding:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; color:#0f172a; background:#fff; line-height:1.55; font-size:15px;">
<div style="max-width:820px; margin:0 auto; padding:48px 28px;">

  <div style="font-size:13px; letter-spacing:.08em; text-transform:uppercase; color:#64748b; margin-bottom:8px;">AI Site Audit</div>
  <h1 style="font-size:32px; margin:0 0 8px; letter-spacing:-.02em;">${esc(report.domain)}</h1>
  <div style="color:#64748b; font-size:14px; margin-bottom:32px; word-break:break-all;"><a href="${esc(report.url)}" style="color:#6366f1; text-decoration:none;">${esc(report.url)}</a></div>

  <div style="display:flex; gap:24px; align-items:stretch; padding:24px; background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; margin-bottom:32px;">
    <div style="flex:0 0 140px; height:140px; border-radius:50%; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; background:${headerColor};">
      <div style="font-size:48px; font-weight:700; line-height:1;">${esc(report.overall_score)}</div>
      <div style="font-size:13px; opacity:.8; margin-top:4px;">out of 100</div>
    </div>
    <div style="flex:1; display:flex; flex-direction:column; justify-content:center;">
      <span style="display:inline-block; padding:4px 12px; border-radius:999px; color:#fff; font-size:13px; font-weight:600; margin-bottom:12px; align-self:flex-start; background:${verdictBgColor};">${esc(report.verdict)}</span>
      <p style="font-size:17px; line-height:1.5; margin:0 0 8px;">${esc(report.tldr)}</p>
      ${report.headline_finding ? `<p style="color:#64748b; font-size:14px; margin:0;">→ ${esc(report.headline_finding)}</p>` : ""}
    </div>
  </div>

  <table cellpadding="0" cellspacing="0" border="0" style="width:100%; margin-bottom:40px; border-collapse:separate; border-spacing:6px 0;">
    <tr>${sectionsGrid}</tr>
  </table>

  ${
    quickWins
      ? `<h2 style="font-size:22px; margin:40px 0 16px; padding-bottom:8px; border-bottom:2px solid #0f172a;">${free ? "Top quick wins" : "Quick wins — ship today"}</h2>${quickWins}`
      : ""
  }

  ${
    criticals
      ? `<h2 style="font-size:22px; margin:40px 0 16px; padding-bottom:8px; border-bottom:2px solid #0f172a;">${free ? "Most critical issue" : "Critical issues"}</h2>${criticals}`
      : ""
  }

  ${upsell}

  ${
    sectionBlocks
      ? `<h2 style="font-size:22px; margin:40px 0 16px; padding-bottom:8px; border-bottom:2px solid #0f172a;">Detailed analysis</h2>${sectionBlocks}`
      : ""
  }

  ${
    longTerm
      ? `<h2 style="font-size:22px; margin:40px 0 16px; padding-bottom:8px; border-bottom:2px solid #0f172a;">90-day strategic plan</h2>${longTerm}`
      : ""
  }

  <div style="margin-top:56px; padding-top:24px; border-top:1px solid #e2e8f0; color:#64748b; font-size:12px; text-align:center;">
    SiteX-Ray · AI audit generated ${new Date().toUTCString()} · Powered by Claude
  </div>

</div>
</body>
</html>`;
}
