"""Storage behind the Meko adapter.

LocalMeko is a stand-in so the demo runs without the Meko SDK: a separate SQLite file with
keyword recall. It is NOT Meko. Switch to the real thing with MEKO_BACKEND=real once RealMeko
is filled in from the meko_langchain file in the hackathon Drive.
"""

import json
import math
import re
import sqlite3
import threading
import uuid
from datetime import datetime
from typing import Protocol

from . import config

_STOP = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "in", "on", "at", "of", "to", "for", "and",
    "or", "it", "its", "this", "that", "my", "our", "we", "i", "me", "since", "from", "with", "not", "no",
    "has", "have", "had", "very", "again", "still", "please", "there", "here", "so", "but", "by", "as",
}


def _stem(w: str) -> str:
    for suf in ("ing", "ed", "es", "s"):
        if len(w) > 4 and w.endswith(suf):
            w = w[: -len(suf)]
            break
    if len(w) > 3 and w[-1] == w[-2] and w[-1] not in "aeiou":
        w = w[:-1]
    return w


def tokens(text: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+", text.lower().replace("wi-fi", "wifi"))
    return {_stem(w) for w in words if w not in _STOP and (len(w) > 1 or w.isdigit())}


def _matches(meta: dict, where: dict | None) -> bool:
    for key, want in (where or {}).items():
        have = meta.get(key)
        if isinstance(want, (list, tuple, set)):
            if have not in want:
                return False
        elif have != want:
            return False
    return True


class MekoBackend(Protocol):
    def add(self, datapack: str, text: str, meta: dict) -> str: ...
    def search(self, datapacks: list[str], query: str, k: int, where: dict | None, min_score: float) -> list[dict]: ...
    def update_meta(self, item_id: str, patch: dict) -> None: ...
    def reset(self) -> None: ...


class LocalMeko:
    def __init__(self, path: str = config.MEKO_LOCAL_PATH) -> None:
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.execute(
            "CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, datapack TEXT, text TEXT, meta TEXT, created_at TEXT)"
        )
        self._conn.commit()

    def add(self, datapack: str, text: str, meta: dict) -> str:
        item_id = "mk_" + uuid.uuid4().hex[:8]
        with self._lock:
            self._conn.execute(
                "INSERT INTO items VALUES (?, ?, ?, ?, ?)",
                (item_id, datapack, text, json.dumps(meta), datetime.now().isoformat()),
            )
            self._conn.commit()
        return item_id

    def search(self, datapacks: list[str], query: str, k: int, where: dict | None, min_score: float) -> list[dict]:
        marks = ",".join("?" * len(datapacks))
        with self._lock:
            rows = self._conn.execute(
                f"SELECT id, datapack, text, meta, created_at FROM items WHERE datapack IN ({marks})", datapacks
            ).fetchall()
        q = tokens(query)
        hits = []
        for item_id, dp, text, meta_json, created in rows:
            meta = json.loads(meta_json)
            if not _matches(meta, where):
                continue
            if q:
                d = tokens(text)
                score = len(q & d) / math.sqrt(len(q) * len(d)) if d else 0.0
                if score < min_score:
                    continue
            else:
                score = 1.0  # empty query lists everything matching `where`
            hits.append({"id": item_id, "datapack": dp, "text": text, "meta": meta, "score": round(score, 3), "_t": created})
        hits.sort(key=lambda h: (h["score"], h["_t"]), reverse=True)
        for h in hits:
            h.pop("_t")
        return hits[:k]

    def update_meta(self, item_id: str, patch: dict) -> None:
        with self._lock:
            row = self._conn.execute("SELECT meta FROM items WHERE id = ?", (item_id,)).fetchone()
            if row:
                meta = {**json.loads(row[0]), **patch}
                self._conn.execute("UPDATE items SET meta = ? WHERE id = ?", (json.dumps(meta), item_id))
                self._conn.commit()

    def reset(self) -> None:
        with self._lock:
            self._conn.execute("DELETE FROM items")
            self._conn.commit()


class RealMeko:
    """Fill these four methods from the meko_langchain file. Nothing else needs to change."""

    def __init__(self) -> None:
        if not config.MEKO_API_KEY:
            raise RuntimeError("MEKO_BACKEND=real needs MEKO_API_KEY in .env")

    def add(self, datapack: str, text: str, meta: dict) -> str:
        raise NotImplementedError("Map to the Meko SDK write call; return the new item id")

    def search(self, datapacks: list[str], query: str, k: int, where: dict | None, min_score: float) -> list[dict]:
        raise NotImplementedError(
            "Map to the Meko SDK recall call; return [{id, datapack, text, meta, score}] best first"
        )

    def update_meta(self, item_id: str, patch: dict) -> None:
        raise NotImplementedError("Map to the Meko SDK update call (or write a superseding item)")

    def reset(self) -> None:
        raise NotImplementedError("Clear the demo datapacks before `make seed`")


def get_backend() -> MekoBackend:
    return RealMeko() if config.MEKO_BACKEND == "real" else LocalMeko()
