"""Storage behind the Meko adapter.

LocalMeko is a stand-in so the demo runs offline: a separate SQLite file with keyword recall.
It is NOT Meko. RealMeko talks to Meko's MCP server (https://docs.mekodata.ai/reference/mcp-server/);
switch with MEKO_BACKEND=real and MEKO_API_KEY.
"""

import itertools
import json
import math
import re
import sqlite3
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
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
    def promote(self, datapack: str, text: str, meta: dict) -> str: ...
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

    def promote(self, datapack: str, text: str, meta: dict) -> str:
        return self.add(datapack, text, meta)  # the stand-in has no separate shared layer

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


class MekoError(RuntimeError):
    pass


class MekoMcp:
    """Minimal synchronous client for Meko's MCP server (streamable HTTP, JSON-RPC 2.0)."""

    def __init__(self, url: str, api_key: str) -> None:
        import httpx

        self._url = url
        self._http = httpx.Client(timeout=30.0, headers={
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "grievance-swarm/1.0",
            "Accept": "application/json, text/event-stream",
        })
        self._session: str | None = None
        self._ids = itertools.count(1)
        self._lock = threading.Lock()  # guards the session handshake only; calls run concurrently

    def _post(self, method: str, params: dict, notify: bool = False):
        payload = {"jsonrpc": "2.0", "method": method, "params": params}
        if not notify:
            payload["id"] = next(self._ids)
        r = self._http.post(self._url, json=payload,
                            headers={"Mcp-Session-Id": self._session} if self._session else None)
        if r.status_code == 404 and self._session:
            raise _SessionExpired()
        if r.status_code >= 400:
            raise MekoError(f"HTTP {r.status_code}: {r.text[:300]}")
        if sid := r.headers.get("mcp-session-id"):
            self._session = sid
        if notify or not r.content:
            return None
        if r.headers.get("content-type", "").startswith("text/event-stream"):
            for line in r.text.splitlines():
                if line.startswith("data:"):
                    msg = json.loads(line[5:])
                    if msg.get("id") == payload["id"]:
                        return msg
            raise MekoError(f"no response to {method}")
        return r.json()

    def _initialize(self) -> None:
        self._session = None
        self._post("initialize", {"protocolVersion": "2025-03-26", "capabilities": {},
                                  "clientInfo": {"name": "grievance-swarm", "version": "1.0"}})
        self._post("notifications/initialized", {}, notify=True)

    def request(self, method: str, params: dict):
        with self._lock:
            if self._session is None:
                self._initialize()
        try:
            msg = self._post(method, params)
        except _SessionExpired:
            with self._lock:
                self._initialize()
            msg = self._post(method, params)
        if "error" in msg:
            raise MekoError(f"{method}: {msg['error'].get('message', msg['error'])}")
        return msg["result"]

    def call(self, tool: str, args: dict):
        result = self.request("tools/call", {"name": tool, "arguments": args})
        text = "".join(c.get("text", "") for c in result.get("content", []) if c.get("type") == "text")
        if result.get("isError"):
            raise MekoError(f"{tool}: {text[:300]}")
        out = result.get("structuredContent")
        if out is None:
            try:
                out = json.loads(text)
            except ValueError:
                return {"text": text}
        # Meko wraps most answers as {"result": "<json string>"}; tool-level failures come back as {"error": ...}.
        if isinstance(out, dict) and isinstance(out.get("result"), str):
            try:
                out = json.loads(out["result"])
            except ValueError:
                out = {"text": out["result"]}
        if isinstance(out, dict) and out.get("error"):
            raise MekoError(f"{tool}: {out['error']}: {out.get('detail', '')}"[:300])
        return out


class _SessionExpired(Exception):
    pass


class RealMeko:
    """Meko over its MCP server. Each demo datapack maps to a Meko datapack named MEKO_DATAPACK_PREFIX + name.

    Meko stores every memory and answers every recall. A local index keeps the labels the agents filter on
    (kind, status, place...), because Meko's search has no metadata filter and memory_update can only
    replace text. Recall hits are Meko's, joined to that index by memory id; an empty query (a listing, not
    a search) is answered from the index.

    Warden-approved knowledge is promoted (memory_promote) into the datapack's shared knowledge base, Meko's
    collective memory. Promotion moves it out of memory_search's reach, so every recall also runs
    knowledgebase_search, whose hits carry the original memory id.
    """

    AGENT = "grievance-swarm"

    def __init__(self) -> None:
        if not config.MEKO_API_KEY:
            raise RuntimeError("MEKO_BACKEND=real needs MEKO_API_KEY in .env")
        self.mcp = MekoMcp(config.MEKO_MCP_URL, config.MEKO_API_KEY)
        self._index = LocalMeko(config.MEKO_INDEX_PATH)
        self._index._conn.execute("CREATE TABLE IF NOT EXISTS meko_ids (meko_id TEXT PRIMARY KEY, item_id TEXT)")
        self._datapacks: dict[str, tuple[str, str]] = {}  # demo name -> (Meko datapack id, conversation id)
        self._setup_lock = threading.Lock()
        self._pool = ThreadPoolExecutor(max_workers=2 * len(DEMO_DATAPACKS))

    def _conversation(self, key: str, datapack_id: str | None = None) -> str:
        # Meko requires a conversation_id on every call; session_id makes it the same conversation each run.
        args = {"agent_id": self.AGENT, "session_id": f"{self.AGENT}-{key}", "title": f"Sahayak: {key}"}
        if datapack_id:
            args["datapack_id"] = datapack_id
        return self.mcp.call("conversation_create", args)["id"]

    def _dp(self, datapack: str) -> tuple[str, str]:
        with self._setup_lock:
            if datapack not in self._datapacks:
                setup = self._conversation("setup")
                name = config.MEKO_DATAPACK_PREFIX + datapack
                found = self.mcp.call("datapack_search", {"name": name, "conversation_id": setup})
                matches = [d for d in found.get("datapacks", []) if d.get("datapack_name", d.get("name")) == name]
                if matches:
                    dp_id = matches[0].get("datapack_id") or matches[0].get("id")
                else:
                    dp_id = self.mcp.call("datapack_create", {"name": name, "conversation_id": setup})["datapack_id"]
                self._datapacks[datapack] = (dp_id, self._conversation(datapack, dp_id))
            return self._datapacks[datapack]

    def datapack_id(self, datapack: str) -> str:
        return self._dp(datapack)[0]

    def _args(self, datapack: str, **extra) -> dict:
        dp_id, conv = self._dp(datapack)
        return {"datapack_id": dp_id, "conversation_id": conv, "agent_id": self.AGENT, **extra}

    def add(self, datapack: str, text: str, meta: dict) -> str:
        res = self.mcp.call("memory_add", self._args(datapack, text=text, metadata=json.dumps(meta)))
        # Meko may split one text into several memories; all of them point back at this item.
        meko_ids = [m["id"] for m in res.get("results", []) if m.get("id")]
        if not meko_ids:
            raise MekoError(f"memory_add stored nothing: {json.dumps(res)[:300]}")
        item_id = meko_ids[0]
        with self._index._lock:
            conn = self._index._conn
            conn.execute("INSERT OR REPLACE INTO items VALUES (?, ?, ?, ?, ?)",
                         (item_id, datapack, text, json.dumps(meta), datetime.now().isoformat()))
            conn.executemany("INSERT OR REPLACE INTO meko_ids VALUES (?, ?)", [(m, item_id) for m in meko_ids])
            conn.commit()
        return item_id

    def promote(self, datapack: str, text: str, meta: dict) -> str:
        """Save, then move into the datapack's shared knowledge base (Meko's collective memory)."""
        item_id = self.add(datapack, text, meta)
        with self._index._lock:
            ids = [r[0] for r in self._index._conn.execute("SELECT meko_id FROM meko_ids WHERE item_id = ?", (item_id,))]
        self.mcp.call("memory_promote", self._args(datapack, memory_ids=ids))
        return item_id

    def _memory_hits(self, datapack: str, query: str, limit: int) -> list[tuple[str, float]]:
        res = self.mcp.call("memory_search", self._args(datapack, query=query, limit=limit))
        return [(h["id"], float(h.get("score") or 0.0)) for h in res.get("results", []) if h.get("id")]

    def _knowledge_hits(self, datapack: str, query: str, limit: int) -> list[tuple[str, float]]:
        # Promoted memories: the hit's metadata names the original memory id; rerank_score is ~0 when unrelated.
        args = {k: v for k, v in self._args(datapack, query=query, limit=limit).items() if k != "agent_id"}
        res = self.mcp.call("knowledgebase_search", args)
        return [(h["metadata_filters"]["memory_id"], float(h.get("rerank_score") or 0.0))
                for h in res.get("results", []) if (h.get("metadata_filters") or {}).get("memory_id")]

    def search(self, datapacks: list[str], query: str, k: int, where: dict | None, min_score: float) -> list[dict]:
        if not query:
            return self._index.search(datapacks, "", k, where, min_score)
        # Meko's scores are semantic similarity: unrelated text still scores ~0.25, so raise the agents'
        # keyword-tuned thresholds to MEKO_MIN_SCORE. A threshold of 0 (list everything that matches) stays 0.
        floor = max(min_score, config.MEKO_MIN_SCORE) if min_score > 0 else 0.0
        best: dict[str, float] = {}
        limit = max(20, k * 5)
        jobs = [self._pool.submit(fn, dp, query, limit) for dp in datapacks
                for fn in (self._memory_hits, self._knowledge_hits)]
        for job in jobs:
            for meko_id, score in job.result():
                best[meko_id] = max(best.get(meko_id, 0.0), score)
        if not best:
            return []
        marks = ",".join("?" * len(best))
        with self._index._lock:
            rows = self._index._conn.execute(
                f"SELECT m.meko_id, i.id, i.datapack, i.text, i.meta FROM meko_ids m JOIN items i ON i.id = m.item_id"
                f" WHERE m.meko_id IN ({marks})", list(best)).fetchall()
        hits: dict[str, dict] = {}
        for meko_id, item_id, dp, text, meta_json in rows:
            meta, score = json.loads(meta_json), best[meko_id]
            if dp not in datapacks or not _matches(meta, where) or score < floor:
                continue
            if item_id not in hits or score > hits[item_id]["score"]:
                hits[item_id] = {"id": item_id, "datapack": dp, "text": text, "meta": meta, "score": round(score, 3)}
        return sorted(hits.values(), key=lambda h: h["score"], reverse=True)[:k]

    def update_meta(self, item_id: str, patch: dict) -> None:
        self._index.update_meta(item_id, patch)

    def reset(self) -> None:
        # Promoted knowledge stays in Meko's knowledge base; once the index is cleared those entries no longer
        # match any item, so recall ignores them.
        for dp in DEMO_DATAPACKS:
            self.mcp.call("memory_delete_all", self._args(dp))
        self._index.reset()
        with self._index._lock:
            self._index._conn.execute("DELETE FROM meko_ids")
            self._index._conn.commit()


DEMO_DATAPACKS = ("desk", "dept-electricity", "dept-wifi", "dept-water", "campus-kb", "build")


def get_backend() -> MekoBackend:
    return RealMeko() if config.MEKO_BACKEND == "real" else LocalMeko()
