"""The Meko adapter. Agents never call Meko directly; every call goes through here.

Per call: 1) redact PII, 2) call Meko in a worker thread (or skip when Meko is OFF), 3) log a meko_calls row,
4) publish a `meko.call` event, 5) return the result with its call_id attached.
"""

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy.orm import Session

from . import clock
from .bus import bus
from .meko_backends import MekoBackend, get_backend
from .models import MekoCall
from .redact import redact
from .services import get_settings, ser_call

DATAPACKS = {"desk", "dept-electricity", "dept-wifi", "dept-water", "campus-kb", "build"}


@dataclass
class MekoResult:
    call_id: str
    items: list[dict] = field(default_factory=list)
    skipped: bool = False
    error: str | None = None


class MekoAdapter:
    def __init__(self, backend: MekoBackend | None = None) -> None:
        self._backend = backend

    @property
    def backend(self) -> MekoBackend:
        if self._backend is None:
            self._backend = get_backend()
        return self._backend

    def enabled(self, db: Session, force: bool | None = None) -> bool:
        return force if force is not None else get_settings(db).meko_enabled

    def _log(self, db: Session, *, actor: str, op: str, datapack: str, summary: str, result_ids=(), preview=(),
             latency_ms: float = 0.0, error: str | None = None, skipped: bool = False, simulated: bool = False,
             target: str | None = None, actor_id: str | None = None, ticket_id: str | None = None,
             at: datetime | None = None) -> MekoCall:
        call = MekoCall(id="rc_" + uuid.uuid4().hex[:6], at=at or clock.now(), actor=actor, actor_id=actor_id,
                        target=target, op=op, datapack=datapack, summary=summary[:280],
                        result_ids=list(result_ids), result_preview=list(preview), latency_ms=round(latency_ms, 1),
                        error=error, skipped=skipped, simulated=simulated, ticket_id=ticket_id)
        db.add(call)
        db.commit()
        bus.publish("meko.call", ser_call(call))
        return call

    async def _store(self, db: Session, op: str, actor: str, datapacks: list[str], text: str, meta: dict | None,
               force: bool | None, **log) -> MekoResult:
        for dp in datapacks:
            if dp not in DATAPACKS:
                raise ValueError(f"unknown datapack {dp}")
        text = redact(text)
        dp_label = ",".join(datapacks)
        if not self.enabled(db, force):
            c = self._log(db, actor=actor, op=op, datapack=dp_label, summary=text, skipped=True, **log)
            return MekoResult(c.id, skipped=True)
        t0, ids, error = time.perf_counter(), [], None
        # A live promotion goes into Meko's shared knowledge layer; seeded (simulated) ones stay plain memories
        # so re-seeding doesn't keep adding the same lessons to the shared layer.
        save = self.backend.promote if op == "promote" and not log.get("simulated") else self.backend.add
        try:
            ids = [await asyncio.to_thread(save, dp, text, meta or {}) for dp in datapacks]
        except Exception as exc:  # logged, counted as an error on the board
            error = f"{type(exc).__name__}: {exc}"
        c = self._log(db, actor=actor, op=op, datapack=dp_label, summary=text, result_ids=ids,
                      latency_ms=(time.perf_counter() - t0) * 1000, error=error, **log)
        return MekoResult(c.id, items=[{"id": i} for i in ids], error=error)

    # --- operations -------------------------------------------------------------------------

    async def write(self, db: Session, actor: str, datapack: str, text: str, meta: dict | None = None, *,
              force: bool | None = None, **log) -> MekoResult:
        return await self._store(db, "write", actor, [datapack], text, meta, force, **log)

    async def share(self, db: Session, actor: str, target: str, datapack: str, text: str, meta: dict | None = None, *,
              force: bool | None = None, **log) -> MekoResult:
        return await self._store(db, "share", actor, [datapack], text, meta, force, target=target, **log)

    async def directive(self, db: Session, actor: str, datapacks: list[str], text: str, meta: dict | None = None, *,
                  force: bool | None = None, **log) -> MekoResult:
        return await self._store(db, "directive", actor, datapacks, text, meta, force, **log)

    async def promote(self, db: Session, actor: str, text: str, meta: dict | None = None, *,
                force: bool | None = None, **log) -> MekoResult:
        return await self._store(db, "promote", actor, ["campus-kb"], text, meta, force, target="campus-kb", **log)

    async def recall(self, db: Session, actor: str, datapacks: list[str], query: str, *, k: int = 3,
               where: dict | None = None, min_score: float = 0.15, force: bool | None = None, **log) -> MekoResult:
        query = redact(query)
        label = ",".join(datapacks)
        summary = f"recall: {query}" if query else f"list {where or {}}"
        if not self.enabled(db, force):
            c = self._log(db, actor=actor, op="recall", datapack=label, summary=summary, skipped=True, **log)
            return MekoResult(c.id, skipped=True)
        t0, items, error = time.perf_counter(), [], None
        try:
            items = await asyncio.to_thread(self.backend.search, datapacks, query, k, where, min_score)
        except Exception as exc:
            error = f"{type(exc).__name__}: {exc}"
        c = self._log(db, actor=actor, op="recall", datapack=label, summary=summary,
                      result_ids=[i["id"] for i in items], preview=[i["text"] for i in items],
                      latency_ms=(time.perf_counter() - t0) * 1000, error=error, **log)
        for i in items:
            i["call_id"] = c.id
        return MekoResult(c.id, items=items, error=error)

    async def update(self, db: Session, actor: str, item: dict, patch: dict, *, force: bool | None = None,
               **log) -> MekoResult:
        if not self.enabled(db, force):
            c = self._log(db, actor=actor, op="write", datapack=item["datapack"], summary=f"update {patch}",
                          skipped=True, **log)
            return MekoResult(c.id, skipped=True)
        error = None
        try:
            await asyncio.to_thread(self.backend.update_meta, item["id"], patch)
        except Exception as exc:
            error = f"{type(exc).__name__}: {exc}"
        c = self._log(db, actor=actor, op="write", datapack=item["datapack"], summary=f"update {patch}",
                      result_ids=[item["id"]], error=error, **log)
        return MekoResult(c.id, error=error)

    def log_approval(self, db: Session, actor: str, summary: str, **log) -> MekoResult:
        """Approvals are human decisions, not storage, but they are logged so the board can show them."""
        c = self._log(db, actor=actor, op="approval", datapack="-", summary=redact(summary), **log)
        return MekoResult(c.id)


meko = MekoAdapter()
