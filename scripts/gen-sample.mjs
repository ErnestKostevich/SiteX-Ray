import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderReport } from "../functions/_shared/renderer.js";

const sample = {
  domain: "acmedental.com",
  url: "https://acmedental.com",
  overall_score: 34,
  verdict: "Critical — needs urgent fixes",
  tldr: "The site loses patients at the first screen: slow load, weak mobile UX, and no clear booking CTA above the fold.",
  headline_finding: "Homepage H1 is generic; service pages lack local SEO signals.",
  quick_wins: [
    {
      title: "Add click-to-call + Book button in header",
      effort: "30 min",
      impact: "High",
      how: "Sticky header on mobile with tel: link and primary Book Appointment CTA.",
    },
    {
      title: "Compress hero images",
      effort: "1 hr",
      impact: "High",
      how: "Convert hero to WebP, lazy-load below-fold gallery.",
    },
    {
      title: "Fix meta titles on service pages",
      effort: "45 min",
      impact: "Medium",
      how: "Unique title + meta description per service with city name.",
    },
  ],
  critical_issues: [
    {
      severity: "critical",
      title: "No primary CTA above the fold on mobile",
      what: "Users must scroll to find how to book.",
      why: "Most dental traffic is mobile; delayed CTA kills conversions.",
      how: "Place Book Appointment + phone in fixed header; repeat CTA after hero.",
    },
  ],
  sections: {
    seo: { score: 28, summary: "Thin local signals.", findings: [] },
    ux: { score: 52, summary: "Readable but cluttered nav.", findings: [] },
    content: { score: 31, summary: "Generic copy.", findings: [] },
    conversion: { score: 22, summary: "Weak CTAs.", findings: [] },
    technical: { score: 61, summary: "Heavy images.", findings: [] },
  },
  long_term: [
    {
      title: "Local SEO content hub",
      estimated_effort: "2–3 weeks",
      rationale: "Build city + service landing pages with schema markup.",
    },
  ],
};

const html = renderReport(sample, { free: false, ctaUrl: "https://sitexray.xyz/#pricing" });
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "landing", "sample-report.html");
writeFileSync(out, html.replace(
  "<title>SiteX-Ray — acmedental.com</title>",
  "<title>Sample report — SiteX-Ray</title>\n<meta name=\"robots\" content=\"noindex\">"
));
console.log("Wrote", out);