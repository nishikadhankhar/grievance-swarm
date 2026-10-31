"""Swarm board data: built only from the meko_calls log (B4) plus the message stream."""

from collections import Counter
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import MekoCall, Message
from ..services import ser_call, ser_message

router = APIRouter(tags=["swarm"])

PEOPLE = ["student", "technician", "warden", "dean"]
AGENTS = ["desk", "electricity", "wifi", "water", "curator"]
DATAPACK_BUBBLES = ["desk", "dept-electricity", "dept-wifi", "dept-water", "campus-kb"]


def counters(calls: list[MekoCall]) -> dict:
    ops = Counter(c.op for c in calls if not c.skipped)
    return {"notes": ops["write"] + ops["share"], "reads": ops["recall"], "promotions": ops["promote"],
            "directives": ops["directive"], "approvals": ops["approval"],
            "errors": sum(1 for c in calls if c.error), "skipped": sum(1 for c in calls if c.skipped)}


@router.get("/meko/calls")
async def calls(frm: datetime | None = Query(None, alias="from"), to: datetime | None = None,
                limit: int = Query(500, le=5000), db: Session = Depends(get_db)):
    q = select(MekoCall)
    if frm:
        q = q.where(MekoCall.at >= frm)
    if to:
        q = q.where(MekoCall.at <= to)
    rows = db.scalars(q).all()  # counters cover the whole window, the list is capped by `limit`
    rows.sort(key=lambda c: (c.at, c.id))
    return {"calls": [ser_call(c) for c in rows[-limit:]], "counters": counters(rows)}


@router.get("/meko/calls/{call_id}")
async def call(call_id: str, db: Session = Depends(get_db)):
    c = db.get(MekoCall, call_id)
    if c is None:
        raise HTTPException(404, f"Unknown call {call_id}")
    return ser_call(c)


@router.get("/swarm/graph")
async def graph(holds: int = Query(5, le=20), db: Session = Depends(get_db)):
    """Node list for SwarmGraph, each with its 'holds' panel: the last N items that actor wrote."""
    nodes = []
    for kind, names in (("person", PEOPLE), ("agent", AGENTS)):
        for name in names:
            rows = db.scalars(select(MekoCall).where(MekoCall.actor == name,
                                                     MekoCall.op.in_(("write", "share", "directive", "promote")),
                                                     MekoCall.skipped.is_(False))
                              .order_by(MekoCall.at.desc()).limit(holds)).all()
            nodes.append({"id": name, "kind": kind, "holds": [{"call_id": c.id, "summary": c.summary,
                                                               "datapack": c.datapack} for c in rows]})
    nodes.append({"id": "meko", "kind": "hub", "datapacks": DATAPACK_BUBBLES})
    nodes.append({"id": "campus-kb", "kind": "kb"})
    all_calls = db.scalars(select(MekoCall)).all()
    return {"nodes": nodes, "counters": counters(all_calls)}


@router.get("/messages")
async def messages(limit: int = Query(50, le=500), db: Session = Depends(get_db)):
    rows = db.scalars(select(Message).order_by(Message.at.desc(), Message.id.desc()).limit(limit)).all()
    return [ser_message(m) for m in rows]
