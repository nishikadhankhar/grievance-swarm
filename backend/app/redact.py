"""Strip personal data before anything reaches Meko or a prompt (B5)."""

import re

_EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.]+\b")
_PHONE = re.compile(r"(?:\+91[\s-]?)?\b[6-9]\d{9}\b")
_ROLL = re.compile(r"\b\d{2,4}[A-Za-z]{2,4}\d{3,6}\b")  # 2021CS10234, 21BCE1234
_NAME = re.compile(r"\b(?:[Mm]y name is|I am|I'm|[Tt]his is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)")
_NOT_NAMES = {"Hostel", "Library", "Mess", "Room", "Block", "Not", "Very", "Still", "Unable"}


def _name_sub(m: re.Match) -> str:
    name = m.group(1)
    if name.split()[0] in _NOT_NAMES:
        return m.group(0)
    return m.group(0).replace(name, "[NAME]")


def redact(text: str) -> str:
    text = _EMAIL.sub("[EMAIL]", text)
    text = _PHONE.sub("[PHONE]", text)
    text = _ROLL.sub("[ROLL]", text)
    return _NAME.sub(_name_sub, text)
