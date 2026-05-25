"""Рендерит JSON-отчёт в красивый HTML."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"


def _env() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=select_autoescape(["html", "xml"]),
    )


def _verdict_color(verdict: str) -> str:
    v = (verdict or "").lower()
    if "критич" in v or "critical" in v:
        return "#dc2626"  # red
    if "доработ" in v or "needs" in v:
        return "#ea580c"  # orange
    if "хорош" in v or "good" in v:
        return "#16a34a"  # green
    if "отлич" in v or "excellent" in v:
        return "#059669"  # emerald
    return "#475569"  # slate


def _score_color(score: int) -> str:
    if score >= 80:
        return "#16a34a"
    if score >= 60:
        return "#ca8a04"
    if score >= 40:
        return "#ea580c"
    return "#dc2626"


def _severity_color(sev: str) -> str:
    return {
        "critical": "#dc2626",
        "high": "#ea580c",
        "medium": "#ca8a04",
        "low": "#0369a1",
    }.get((sev or "").lower(), "#475569")


def render_html(report: dict, free: bool = False) -> str:
    env = _env()
    env.filters["verdict_color"] = _verdict_color
    env.filters["score_color"] = _score_color
    env.filters["severity_color"] = _severity_color

    template = env.get_template("report.html")
    return template.render(
        report=report,
        free=free,
        generated_at=datetime.now().strftime("%d.%m.%Y %H:%M"),
    )


def save_html(report: dict, out_path: str, free: bool = False) -> str:
    html = render_html(report, free=free)
    Path(out_path).write_text(html, encoding="utf-8")
    return out_path
