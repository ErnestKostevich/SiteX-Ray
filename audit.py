"""CLI: python audit.py <url> [--free] [--out report.html]

Примеры:
    python audit.py example.com --free
    python audit.py https://example.com --out my_report.html
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

# Make stdout/stderr UTF-8 on Windows so emoji ("✓", "❌", "✅") render correctly.
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

from dotenv import load_dotenv

# Грузим .env из директории скрипта
load_dotenv(Path(__file__).parent / ".env")

from src.analyzer import analyze
from src.report import save_html
from src.scraper import scrape_site


def _safe_filename(url: str, suffix: str = "html") -> str:
    domain = urlparse(url if url.startswith("http") else "http://" + url).netloc
    domain = re.sub(r"[^a-zA-Z0-9.-]", "_", domain) or "report"
    return f"audit_{domain}.{suffix}"


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="AI-аудит сайта через Claude. Скрапит главную страницу и генерит HTML-отчёт.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("url", help="URL сайта для аудита (можно без https://)")
    p.add_argument("--free", action="store_true",
                   help="Бесплатный тизер (1 страница вместо полного отчёта)")
    p.add_argument("--out", default=None,
                   help="Куда сохранить HTML (по умолчанию: audit_<домен>.html)")
    p.add_argument("--json", default=None,
                   help="Если задано — дополнительно сохранить сырой JSON-отчёт сюда")
    p.add_argument("--model", default=None,
                   help="Переопределить модель Claude (по умолчанию из ANTHROPIC_MODEL)")
    args = p.parse_args(argv)

    out_path = args.out or _safe_filename(args.url)

    print(f"[1/3] Скрапим {args.url} ...")
    try:
        site_data = scrape_site(args.url)
    except Exception as e:
        print(f"  ❌ Не смогли скачать страницу: {e}", file=sys.stderr)
        return 1

    print(f"      ✓ {site_data['status_code']} · "
          f"{site_data['html_size_kb']} KB · "
          f"{site_data['response_time_ms']} ms · "
          f"{site_data['word_count']} слов")

    mode = "TEASER" if args.free else "FULL"
    print(f"[2/3] Прогоняем через Claude (режим: {mode}) ...")
    try:
        report = analyze(site_data, free=args.free, model=args.model)
    except Exception as e:
        print(f"  ❌ Анализ упал: {e}", file=sys.stderr)
        return 2

    print(f"      ✓ Score: {report.get('overall_score', '?')}/100 · "
          f"Вердикт: {report.get('verdict', '?')}")

    print(f"[3/3] Рендерим отчёт в {out_path} ...")
    save_html(report, out_path, free=args.free)

    if args.json:
        Path(args.json).write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"      ✓ Сырой JSON: {args.json}")

    print(f"\n✅ Готово! Открой в браузере:\n   {Path(out_path).absolute()}")
    print(f"   (Ctrl+P → 'Сохранить как PDF' если нужен PDF)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
