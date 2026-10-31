"""Pattern agent (optional): spots repeats in resolved tickets and asks the Warden to verify them.

Tools: recall_kb, flag_pattern. Patterns reach the Dean only after a Warden approves them.
"""

from collections import Counter
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import clock
from ..bus import bus
from ..meko_client import meko
from ..models import Approval, Place, Ticket
from ..services import add_message, ser_approval

MIN_REPEATS = 3


def scan(db: Session) -> list[Approval]:
    since = clock.now() - timedelta(days=90)
    closed = db.scalars(select(Ticket).where(Ticket.status == "resolved", Ticket.closed_at >= since)).all()
    counts = Counter((t.category, t.place_id) for t in closed)
    known = meko.recall(db, "pattern", ["campus-kb"], "", k=50, where={"kind": "pattern"})
    pending = {(a.payload.get("category"), a.payload.get("place_id")) for a in db.scalars(
        select(Approval).where(Approval.kind == "pattern", Approval.status == "pending")).all()}
    flagged = []
    for (cat, place_id), n in counts.items():
        if n < MIN_REPEATS or (cat, place_id) in pending:
            continue
        place = db.get(Place, place_id)
        text = f"{cat.capitalize()} issues repeat at {place.name if place else place_id}: {n} resolved in 90 days"
        if any(text.split(":")[0] in i["text"] for i in known.items):
            continue
        a = Approval(kind="pattern", proposed_by_agent="pattern", status="pending", created_at=clock.now(),
                     payload={"pattern": text, "category": cat, "place_id": place_id, "stat": f"{n} in 90 days"})
        db.add(a)
        db.commit()
        add_message(db, "pattern", "warden", f"Pattern to verify: {text}", "approval")
        bus.publish("approval.created", ser_approval(a))
        flagged.append(a)
    return flagged
