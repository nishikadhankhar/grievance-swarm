"""Demo clock. The fast-forward setting shifts every timestamp the backend writes."""

from datetime import datetime, timedelta

_offset_minutes = 0


def set_offset(minutes: int) -> None:
    global _offset_minutes
    _offset_minutes = minutes


def offset() -> int:
    return _offset_minutes


def now() -> datetime:
    return datetime.now().replace(microsecond=0) + timedelta(minutes=_offset_minutes)
