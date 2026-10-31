"""OpenAI-compatible LLM client (Ollama by default) with rule-based fallbacks.

Every helper returns a usable answer even when no model is reachable, so the demo never
stalls on venue Wi-Fi. After a failed call the client backs off for 60 seconds.
"""

import json
import re
import time
from datetime import datetime, timedelta

import httpx

from . import config
from .models import Setting

_down_until = 0.0

CATEGORIES = ("wifi", "electricity", "water", "other")
_KEYWORDS = {
    "wifi": {"wifi", "internet", "router", "network", "lan", "ethernet", "signal"},
    "water": {"water", "ro", "tap", "leak", "leaking", "drain", "pipe", "cooler", "flush", "purifier", "dispenser"},
    "electricity": {"geyser", "power", "light", "lights", "fan", "socket", "switch", "breaker", "electric",
                    "electricity", "ac", "bulb", "tripping", "trips", "tripped", "heater"},
}
_WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


async def chat(settings: Setting | None, messages: list[dict], timeout: float = 20.0) -> str | None:
    global _down_until
    if settings is not None and not settings.llm_enabled:
        return None
    if time.time() < _down_until:
        return None
    base = (settings.llm_base_url if settings else config.LLM_BASE_URL).rstrip("/")
    model = settings.model if settings else config.LLM_MODEL
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(timeout, connect=1.5)) as client:
            r = await client.post(
                f"{base}/chat/completions",
                json={"model": model, "messages": messages, "temperature": 0.1},
                headers={"Authorization": f"Bearer {config.LLM_API_KEY}"},
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
    except Exception:
        _down_until = time.time() + 60
        return None


async def chat_json(settings: Setting | None, system: str, user: str) -> dict | None:
    content = await chat(settings, [{"role": "system", "content": system}, {"role": "user", "content": user}])
    if not content:
        return None
    content = re.sub(r"<think>.*?</think>", "", content, flags=re.S)  # qwen3 reasoning block
    m = re.search(r"\{.*\}", content, flags=re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


def _words(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower().replace("wi-fi", "wifi"))


def keyword_category(text: str) -> str:
    words = set(_words(text))
    scores = {cat: len(words & kws) for cat, kws in _KEYWORDS.items()}
    best = max(("wifi", "water", "electricity"), key=lambda c: scores[c])  # order breaks ties
    return best if scores[best] else "other"


def short_title(text: str) -> str:
    first = re.split(r"(?<=[.!?])\s|\n", text.strip(), maxsplit=1)[0].strip().rstrip(".!?")
    if len(first) > 60:
        first = first[:57].rsplit(" ", 1)[0] + "…"
    return first[:1].upper() + first[1:]


async def classify(settings: Setting | None, text: str) -> dict:
    out = await chat_json(
        settings,
        "You triage campus maintenance complaints. Reply with JSON only: "
        '{"category": one of "wifi","electricity","water","other", "title": a 3-8 word summary}.',
        text,
    )
    if out and out.get("category") in CATEGORIES and isinstance(out.get("title"), str) and out["title"].strip():
        return {"category": out["category"], "title": out["title"].strip()[:120], "source": "llm"}
    return {"category": keyword_category(text), "title": short_title(text), "source": "rules"}


def parse_eta(note: str, now: datetime) -> datetime | None:
    """Rule-based ETA extraction: weekday names, 'tomorrow', 'in N hours', 'by HH:MM'."""
    low = note.lower()
    for i, day in enumerate(_WEEKDAYS):
        if day in low:
            delta = (i - now.weekday()) % 7 or 7
            return (now + timedelta(days=delta)).replace(hour=18, minute=0, second=0)
    if "tomorrow" in low:
        return (now + timedelta(days=1)).replace(hour=18, minute=0, second=0)
    m = re.search(r"in (\d{1,2}) ?(?:hours|hrs|hour|hr|h)\b", low)
    if m:
        return now + timedelta(hours=int(m.group(1)))
    m = re.search(r"\b(?:by|at|till|until) (\d{1,2}):(\d{2})\b", low)
    if m:
        t = now.replace(hour=int(m.group(1)) % 24, minute=int(m.group(2)), second=0)
        return t if t > now else t + timedelta(days=1)
    return None


async def extract_eta(settings: Setting | None, note: str, now: datetime) -> datetime | None:
    rule = parse_eta(note, now)
    if rule:
        return rule
    out = await chat_json(
        settings,
        f"Current time is {now:%Y-%m-%d %H:%M} ({now:%A}). If the technician note implies when the fix "
        'will be done, reply {"eta": "YYYY-MM-DD HH:MM"}; otherwise reply {"eta": null}.',
        note,
    )
    try:
        return datetime.strptime(out["eta"], "%Y-%m-%d %H:%M") if out and out.get("eta") else None
    except (ValueError, TypeError):
        return None


async def summarise_lesson(settings: Setting | None, title: str, notes: list[str]) -> str:
    fix = notes[-1] if notes else "see ticket notes"
    out = await chat_json(
        settings,
        "Write one reusable maintenance lesson from this closed campus ticket, in the form "
        '"<symptom> → <what to check or do first>", under 15 words. Reply {"lesson": "..."}.',
        f"Ticket: {title}\nTechnician notes:\n" + "\n".join(f"- {n}" for n in notes),
    )
    if out and isinstance(out.get("lesson"), str) and out["lesson"].strip():
        return out["lesson"].strip()
    return f"{title} → {fix.rstrip('.')}"
