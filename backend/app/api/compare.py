"""Meko ON vs OFF for the same grievance. Both sides are real adapter calls; OFF is logged as skipped."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import llm
from ..db import get_db
from ..meko_client import meko
from ..models import Place, Ticket
from ..redact import redact
from ..services import AGENT_NAMES, DEPARTMENTS, get_settings

router = APIRouter(tags=["compare"])


class CompareIn(BaseModel):
    text: str = Field(min_length=3, max_length=2000)
    place_id: str


def _avg_visits(db: Session, category: str, with_suggestion: bool) -> float | None:
    rows = db.scalars(select(Ticket).where(Ticket.status == "resolved", Ticket.category == category,
                                           Ticket.visits > 0)).all()
    rows = [t for t in rows if bool(t.suggestion) == with_suggestion]
    return round(sum(t.visits for t in rows) / len(rows), 1) if rows else None


@router.post("/compare")
async def compare(body: CompareIn, db: Session = Depends(get_db)):
    place = db.get(Place, body.place_id)
    if place is None:
        raise HTTPException(404, f"Unknown place {body.place_id}")
    text = redact(body.text)
    cls = await llm.classify(get_settings(db), text)
    dept = cls["category"]
    sides = {}
    for label, on in (("on", True), ("off", False)):
        if dept in DEPARTMENTS:
            r = meko.recall(db, dept, [f"dept-{dept}", "campus-kb"], text, k=3, min_score=0.15,
                            where={"kind": ["fix", "lesson", "note"]}, force=on)
            top = r.items[0] if r.items else None
        else:
            r, top = None, None
        sides[label] = {
            "meko": label,
            "call_id": r.call_id if r else None,
            "routing": f"{AGENT_NAMES[dept]} with a recalled fix" if top else
                       ("Generic queue for " + (AGENT_NAMES.get(dept, "the Warden"))),
            "suggestion": top["text"] if top else None,
            "suggestion_source": top["datapack"] if top else None,
            "recalled": [i["text"] for i in r.items] if r else [],
            # Expected visits: a recalled fix sends the technician to the likely cause first.
            "expected_visits": 1 if top else 2,
            "observed_avg_visits": _avg_visits(db, dept, bool(top)),
        }
    return {"category": dept, "place": place.name, "text": text, **sides}
