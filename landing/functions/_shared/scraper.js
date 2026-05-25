// Site scraper for Cloudflare Workers — uses HTMLRewriter (built-in, streaming).
// Returns the same shape as the Python scraper (src/scraper.py).

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/125.0 Safari/537.36 SiteXRay/1.0";
const TIMEOUT_MS = 15000;
const MAX_TEXT_CHARS = 8000;

const CTA_PATTERN =
  /\b(buy|order|get|book|start|try|sign\s*up|subscribe|contact|call|request|download|register|schedule|quote|reserve|join|begin|free)\b/i;

function textCollector(targetArr, maxItems = 50, maxLen = 200) {
  let current = "";
  return {
    element(el) {
      current = "";
      el.onEndTag(() => {
        const trimmed = current.trim().replace(/\s+/g, " ");
        if (trimmed && targetArr.length < maxItems) {
          targetArr.push(trimmed.slice(0, maxLen));
        }
        current = "";
      });
    },
    text(text) {
      current += text.text;
    },
  };
}

export async function scrapeSite(rawUrl) {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const startTime = Date.now();
  let response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
  const responseTimeMs = Date.now() - startTime;

  if (!response.ok && response.status !== 304) {
    throw new Error(`Site returned HTTP ${response.status}`);
  }

  const finalUrl = response.url || url;
  const parsedFinal = new URL(finalUrl);
  const baseDomain = parsedFinal.hostname;

  const data = {
    url,
    final_url: finalUrl,
    domain: baseDomain,
    status_code: response.status,
    response_time_ms: responseTimeMs,
    html_size_kb: 0,

    title: null,
    meta_description: null,
    meta_keywords: null,
    canonical: null,
    language: null,

    h1: [],
    h2: [],
    h3: [],
    text_sample: "",
    text_total_chars: 0,
    word_count: 0,

    nav_items: [],
    cta_buttons: [],
    forms_count: 0,
    forms_field_counts: [],

    links_internal_count: 0,
    links_external_count: 0,
    images_total: 0,
    images_no_alt: 0,

    has_viewport: false,
    has_og_title: false,
    has_og_image: false,
    has_twitter_card: false,
    has_favicon: false,
    has_schema_org: false,
    has_phone: false,
    has_email: false,
    has_address: false,

    https: parsedFinal.protocol === "https:",
  };

  // Accumulators
  const accH1 = [];
  const accH2 = [];
  const accH3 = [];
  const accNav = [];
  const accButtons = [];
  const accLinkTexts = [];
  let titleBuf = "";
  let bodyBuf = "";
  let inNav = false;
  let inForm = false;
  let currentFormFields = 0;

  // We need the HTML for size, plus to feed HTMLRewriter.
  // Clone the response: one for size, one for the rewriter.
  const sizeClone = response.clone();

  const rewriter = new HTMLRewriter()
    .on("html", {
      element(el) {
        const lang = el.getAttribute("lang");
        if (lang) data.language = lang;
      },
    })
    .on("title", {
      text(text) {
        titleBuf += text.text;
      },
    })
    .on("meta", {
      element(el) {
        const name = (el.getAttribute("name") || "").toLowerCase();
        const property = (el.getAttribute("property") || "").toLowerCase();
        const content = el.getAttribute("content");
        if (name === "description") data.meta_description = content;
        else if (name === "keywords") data.meta_keywords = content;
        else if (name === "viewport") data.has_viewport = true;
        else if (property === "og:title") data.has_og_title = true;
        else if (property === "og:image") data.has_og_image = true;
        else if (name === "twitter:card") data.has_twitter_card = true;
      },
    })
    .on('link[rel="canonical"]', {
      element(el) {
        data.canonical = el.getAttribute("href");
      },
    })
    .on('link[rel*="icon" i]', {
      element() {
        data.has_favicon = true;
      },
    })
    .on("h1", textCollector(accH1, 10))
    .on("h2", textCollector(accH2, 20))
    .on("h3", textCollector(accH3, 20))
    .on("img", {
      element(el) {
        data.images_total++;
        const alt = (el.getAttribute("alt") || "").trim();
        if (!alt) data.images_no_alt++;
      },
    })
    .on("a", {
      element(el) {
        const href = el.getAttribute("href") || "";
        if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
          return;
        }
        if (href.startsWith("tel:")) data.has_phone = true;
        if (href.startsWith("mailto:")) data.has_email = true;
        try {
          const parsedHref = new URL(href, finalUrl);
          if (
            parsedHref.hostname === baseDomain ||
            parsedHref.hostname.endsWith("." + baseDomain)
          ) {
            data.links_internal_count++;
          } else if (parsedHref.protocol.startsWith("http")) {
            data.links_external_count++;
          }
        } catch {
          if (href.startsWith("/")) data.links_internal_count++;
        }
      },
    })
    .on("nav a", textCollector(accNav, 15))
    .on("header a", textCollector(accNav, 15))
    .on("button", textCollector(accButtons, 30, 60))
    .on("form", {
      element(el) {
        data.forms_count++;
        currentFormFields = 0;
        inForm = true;
        el.onEndTag(() => {
          data.forms_field_counts.push(currentFormFields);
          inForm = false;
          currentFormFields = 0;
        });
      },
    })
    .on("form input, form textarea, form select", {
      element(el) {
        const t = (el.getAttribute("type") || "").toLowerCase();
        if (t === "hidden" || t === "submit" || t === "button") return;
        if (inForm) currentFormFields++;
      },
    })
    .on("[itemscope]", {
      element() {
        data.has_schema_org = true;
      },
    })
    .on('script[type="application/ld+json"]', {
      element() {
        data.has_schema_org = true;
      },
    })
    .on("body", {
      text(text) {
        if (bodyBuf.length < MAX_TEXT_CHARS * 2) {
          bodyBuf += text.text;
        }
      },
    });

  const transformed = rewriter.transform(response);
  // Consume the stream
  const transformedText = await transformed.text();

  // Get raw bytes for accurate size
  const sizeText = await sizeClone.text();
  data.html_size_kb = Math.max(1, Math.floor(sizeText.length / 1024));

  // Finalize
  data.title = titleBuf.trim() || null;
  data.h1 = accH1;
  data.h2 = accH2;
  data.h3 = accH3;

  data.text_sample = bodyBuf.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);
  data.text_total_chars = bodyBuf.length;
  data.word_count = data.text_sample.split(/\s+/).filter(Boolean).length;

  data.nav_items = accNav.slice(0, 15);

  data.cta_buttons = Array.from(new Set(accButtons.filter((t) => CTA_PATTERN.test(t)))).slice(0, 20);

  // Fallback signal detection from body text
  const head5k = data.text_sample.slice(0, 5000);
  if (!data.has_phone) {
    data.has_phone = /\+?[\d][\d\s\-().]{6,}\d/.test(head5k);
  }
  if (!data.has_email) {
    data.has_email = /[\w.\-]+@[\w.\-]+\.\w+/.test(head5k);
  }
  data.has_address =
    /\b(street|avenue|boulevard|building|suite|floor|district|address|located|drive|road|lane|court)\b/i.test(
      head5k
    );

  return data;
}
