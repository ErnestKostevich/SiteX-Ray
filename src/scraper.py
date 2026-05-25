"""Скрапер главной страницы сайта. Собирает данные для аудита."""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0 Safari/537.36 AI-Auditor/1.0"
)
TIMEOUT_SECONDS = 20
MAX_TEXT_CHARS = 8000  # отдаём в Claude максимум столько текста


@dataclass
class SiteData:
    url: str
    final_url: str
    domain: str
    status_code: int
    response_time_ms: int
    html_size_kb: int

    title: Optional[str] = None
    meta_description: Optional[str] = None
    meta_keywords: Optional[str] = None
    canonical: Optional[str] = None
    language: Optional[str] = None

    h1: list[str] = field(default_factory=list)
    h2: list[str] = field(default_factory=list)
    h3: list[str] = field(default_factory=list)

    text_sample: str = ""
    text_total_chars: int = 0

    nav_items: list[str] = field(default_factory=list)
    cta_buttons: list[str] = field(default_factory=list)
    forms_count: int = 0
    forms_field_counts: list[int] = field(default_factory=list)

    links_internal_count: int = 0
    links_external_count: int = 0
    images_total: int = 0
    images_no_alt: int = 0

    has_viewport: bool = False
    has_og_title: bool = False
    has_og_image: bool = False
    has_twitter_card: bool = False
    has_favicon: bool = False
    has_schema_org: bool = False
    has_phone: bool = False
    has_email: bool = False
    has_address: bool = False

    https: bool = False
    word_count: int = 0


def _meta(soup: BeautifulSoup, name: str) -> Optional[str]:
    tag = soup.find("meta", attrs={"name": name}) or soup.find(
        "meta", attrs={"property": f"og:{name}"}
    )
    return tag.get("content") if tag and tag.get("content") else None


def _is_internal(href: str, base_domain: str) -> bool:
    if not href:
        return False
    if href.startswith("#") or href.startswith("javascript:"):
        return False
    if href.startswith("/"):
        return True
    parsed = urlparse(href)
    return parsed.netloc == "" or parsed.netloc.endswith(base_domain)


def scrape_site(url: str) -> dict:
    """Скрапит сайт и возвращает dict с данными для анализатора."""
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru,en;q=0.9",
    }

    resp = requests.get(url, headers=headers, timeout=TIMEOUT_SECONDS, allow_redirects=True)
    soup = BeautifulSoup(resp.text, "lxml")

    parsed = urlparse(resp.url)
    domain = parsed.netloc

    # Тексты
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    full_text = soup.get_text(separator=" ", strip=True)
    full_text = re.sub(r"\s+", " ", full_text)

    # Картинки
    images = soup.find_all("img")
    images_no_alt = sum(1 for img in images if not (img.get("alt") or "").strip())

    # Ссылки
    links = soup.find_all("a", href=True)
    internal = sum(1 for a in links if _is_internal(a["href"], domain))
    external = len(links) - internal

    # Навигация (берём первый nav или header)
    nav = soup.find("nav") or soup.find("header")
    nav_items = []
    if nav:
        nav_items = [
            a.get_text(strip=True)
            for a in nav.find_all("a")
            if a.get_text(strip=True)
        ][:15]

    # CTA — кнопки и ссылки с CTA-like текстом
    cta_patterns = re.compile(
        r"(заказ|купить|оставить|записаться|получить|узнать|связ|позвонить|"
        r"подписаться|скачать|попробовать|демо|консультация|"
        r"buy|order|get|book|start|try|sign up|subscribe|contact|call)",
        re.IGNORECASE,
    )
    cta_buttons = []
    for el in soup.find_all(["button", "a"]):
        text = el.get_text(strip=True)
        if text and cta_patterns.search(text) and len(text) < 60:
            cta_buttons.append(text)
    cta_buttons = list(dict.fromkeys(cta_buttons))[:20]

    # Формы
    forms = soup.find_all("form")
    forms_field_counts = []
    for form in forms:
        fields = form.find_all(["input", "textarea", "select"])
        visible_fields = [
            f for f in fields if (f.get("type") or "").lower() not in ("hidden", "submit")
        ]
        forms_field_counts.append(len(visible_fields))

    # Контакты (по тексту страницы)
    has_phone = bool(re.search(r"\+?[\d\s\-\(\)]{7,}\d", full_text[:5000])) or \
                bool(soup.find("a", href=re.compile(r"^tel:")))
    has_email = bool(re.search(r"[\w\.\-]+@[\w\.\-]+\.\w+", full_text[:5000])) or \
                bool(soup.find("a", href=re.compile(r"^mailto:")))
    address_patterns = re.compile(
        r"(ул\.|улица|пр-т|проспект|г\.\s|город\s|street|avenue|building|"
        r"д\.\s*\d|hous|офис|office)",
        re.IGNORECASE,
    )
    has_address = bool(address_patterns.search(full_text[:5000]))

    data = SiteData(
        url=url,
        final_url=resp.url,
        domain=domain,
        status_code=resp.status_code,
        response_time_ms=int(resp.elapsed.total_seconds() * 1000),
        html_size_kb=max(1, len(resp.content) // 1024),
        title=(soup.title.string.strip() if soup.title and soup.title.string else None),
        meta_description=_meta(soup, "description"),
        meta_keywords=_meta(soup, "keywords"),
        canonical=(
            soup.find("link", rel="canonical").get("href")
            if soup.find("link", rel="canonical")
            else None
        ),
        language=(soup.html.get("lang") if soup.html else None),
        h1=[h.get_text(strip=True) for h in soup.find_all("h1")][:10],
        h2=[h.get_text(strip=True) for h in soup.find_all("h2")][:20],
        h3=[h.get_text(strip=True) for h in soup.find_all("h3")][:20],
        text_sample=full_text[:MAX_TEXT_CHARS],
        text_total_chars=len(full_text),
        nav_items=nav_items,
        cta_buttons=cta_buttons,
        forms_count=len(forms),
        forms_field_counts=forms_field_counts,
        links_internal_count=internal,
        links_external_count=external,
        images_total=len(images),
        images_no_alt=images_no_alt,
        has_viewport=bool(soup.find("meta", attrs={"name": "viewport"})),
        has_og_title=bool(soup.find("meta", property="og:title")),
        has_og_image=bool(soup.find("meta", property="og:image")),
        has_twitter_card=bool(soup.find("meta", attrs={"name": "twitter:card"})),
        has_favicon=bool(
            soup.find("link", rel=lambda v: v and "icon" in v.lower())
        ),
        has_schema_org=bool(
            soup.find(attrs={"itemscope": True})
            or soup.find("script", type="application/ld+json")
        ),
        has_phone=has_phone,
        has_email=has_email,
        has_address=has_address,
        https=parsed.scheme == "https",
        word_count=len(full_text.split()),
    )

    return asdict(data)
