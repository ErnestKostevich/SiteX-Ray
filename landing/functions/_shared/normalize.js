// Normalizes the AI-generated audit report so the renderer can always
// rely on the same shape — even if the model omitted a field, returned
// the wrong type, or used a synonym for a severity level.
//
// Especially important when the backend is Llama 3.1 8B (less strict
// at JSON schema adherence than Claude Sonnet).

const SEVERITIES = new Set(["critical", "high", "medium", "low"]);
const VERDICTS = ["Critical", "Needs work", "Good", "Excellent"];
const SECTION_KEYS = ["seo", "ux", "content", "conversion", "technical"];

function clampScore(n) {
  const v = Number(n);
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function asString(v, maxLen = 4000) {
  if (v == null) return "";
  return String(v).slice(0, maxLen);
}

function normalizeVerdict(v) {
  const raw = String(v || "").trim();
  if (!raw) return "Needs work";
  const lower = raw.toLowerCase();
  for (const known of VERDICTS) {
    if (lower.includes(known.toLowerCase().split(" ")[0])) return known;
  }
  return raw.length > 40 ? "Needs work" : raw;
}

function normalizeSeverity(s) {
  const lower = String(s || "").trim().toLowerCase();
  if (SEVERITIES.has(lower)) return lower;
  // Common synonyms
  if (/sever|urgent|blocker|major/.test(lower)) return "high";
  if (/minor|trivial|nit/.test(lower)) return "low";
  return "medium";
}

function normalizeFinding(f) {
  if (!f || typeof f !== "object" || !f.title) return null;
  return {
    severity: normalizeSeverity(f.severity),
    title: asString(f.title, 200),
    what: asString(f.what),
    why: asString(f.why),
    how: asString(f.how),
  };
}

function normalizeQuickWin(qw) {
  if (!qw || typeof qw !== "object" || !qw.title) return null;
  return {
    title: asString(qw.title, 200),
    effort: asString(qw.effort || "30 minutes", 60),
    impact: asString(qw.impact || "medium", 30),
    how: asString(qw.how),
  };
}

function normalizeRecommendation(r) {
  if (!r || typeof r !== "object" || !r.title) return null;
  return {
    title: asString(r.title, 200),
    rationale: asString(r.rationale),
    estimated_effort: asString(r.estimated_effort || "weeks", 60),
  };
}

function normalizeSection(sec) {
  if (!sec || typeof sec !== "object") {
    return { score: 0, summary: "", findings: [] };
  }
  return {
    score: clampScore(sec.score),
    summary: asString(sec.summary),
    findings: (Array.isArray(sec.findings) ? sec.findings : [])
      .map(normalizeFinding)
      .filter(Boolean),
  };
}

export function normalizeReport(report, siteData = {}) {
  if (!report || typeof report !== "object") {
    throw new Error("AI returned non-object report");
  }

  const sections = {};
  for (const key of SECTION_KEYS) {
    sections[key] = normalizeSection(report.sections && report.sections[key]);
  }

  return {
    url: asString(report.url || siteData.final_url || "", 500),
    domain: asString(report.domain || siteData.domain || "", 200),
    overall_score: clampScore(report.overall_score),
    verdict: normalizeVerdict(report.verdict),
    tldr: asString(report.tldr),
    headline_finding: asString(report.headline_finding),
    sections,
    quick_wins: (Array.isArray(report.quick_wins) ? report.quick_wins : [])
      .map(normalizeQuickWin)
      .filter(Boolean),
    critical_issues: (Array.isArray(report.critical_issues) ? report.critical_issues : [])
      .map(normalizeFinding)
      .filter(Boolean),
    long_term: (Array.isArray(report.long_term) ? report.long_term : [])
      .map(normalizeRecommendation)
      .filter(Boolean),
  };
}
