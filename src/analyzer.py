"""Отправляет данные сайта в Claude и получает структурированный отчёт."""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

from anthropic import Anthropic

PROMPT_PATH = Path(__file__).parent / "prompts" / "auditor_system.md"
DEFAULT_MODEL = "claude-sonnet-4-5"
MAX_TOKENS = 8000


def _load_system_prompt() -> str:
    return PROMPT_PATH.read_text(encoding="utf-8")


def _extract_json(text: str) -> dict:
    """Парсит JSON из ответа модели. Прощает обёртку в ```json ... ```."""
    text = text.strip()

    # Снимаем code fence если есть
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Последний шанс: найти первый { и последний }
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(text[start : end + 1])
        raise


def analyze(site_data: dict, free: bool = False, model: str | None = None) -> dict:
    """Прогоняет site_data через Claude, возвращает dict отчёта.

    Args:
        site_data: dict от scraper.scrape_site()
        free: если True — генерим тизер (короткий), иначе полный отчёт.
        model: переопределить модель (по умолчанию из env ANTHROPIC_MODEL).
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY не задан. Скопируй .env.example в .env и впиши ключ."
        )

    model = model or os.environ.get("ANTHROPIC_MODEL", DEFAULT_MODEL)
    client = Anthropic(api_key=api_key)

    mode = "TEASER" if free else "FULL"

    user_message = (
        f"Mode: {mode}\n\n"
        f"Site data (JSON):\n```json\n{json.dumps(site_data, ensure_ascii=False, indent=2)}\n```\n\n"
        f"Generate the audit report as a single JSON object per the schema. "
        f"Output JSON only, no commentary."
    )

    resp = client.messages.create(
        model=model,
        max_tokens=MAX_TOKENS,
        system=_load_system_prompt(),
        messages=[{"role": "user", "content": user_message}],
    )

    raw = "".join(block.text for block in resp.content if hasattr(block, "text"))
    return _extract_json(raw)
