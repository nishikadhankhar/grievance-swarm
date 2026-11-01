from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import clock
from ..agents import curator, department, desk
from ..db import get_db
from ..meko_client import meko
from ..auth import current_user
from ..models import Grievance, Ticket, TicketEvent, User
from ..services import add_event, add_message, ser_event, ser_ticket
from . import require_role

router = APIRouter(tags=["tickets"])
STAFF = ("technician", "warden")


class NoteIn(BaseModel):
    text: str = Field(min_length=2, max_length=1000)


class EtaIn(BaseModel):
    eta: datetime
    reason: str | None = Field(default=None, max_length=300)


class DecisionIn(BaseModel):
    action: Literal["accept", "override", "close"]
    note: str | None = Field(default=None, max_length=1000)


def _ticket(db: Session, ticket_id: str) -> Ticket:
    t = db.get(Ticket, ticket_id)
    if t is None:
        raise HTTPException(404, f"Unknown ticket {ticket_id}")
    return t


@router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, db: Session = Depends(get_db)):
    t = _ticket(db, ticket_id)
    events = db.scalars(select(TicketEvent).where(TicketEvent.ticket_id == t.id).order_by(TicketEvent.at,
                                                                                          TicketEvent.id)).all()
    reporters = db.scalars(select(Grievance.user_id).where(Grievance.ticket_id == t.id)).all()
    return {"ticket": ser_ticket(db, t), "events": [ser_event(db, e) for e in events],
            "reporters": [r or "anonymous" for r in reporters]}


@router.get("/students/{user_id}/tickets")
async def student_tickets(user_id: str, me: User = Depends(current_user), db: Session = Depends(get_db)):
    if me.role == "student" and me.id != user_id:
        raise HTTPException(403, "Students can only list their own tickets")
    ids = db.scalars(select(Grievance.ticket_id).where(Grievance.user_id == user_id)).all()
    tickets = [db.get(Ticket, i) for i in dict.fromkeys(i for i in ids if i)]
    return [ser_ticket(db, t) for t in sorted(tickets, key=lambda t: t.created_at, reverse=True)]


@router.get("/staff/queue")
async def queue(role: Literal["technician", "warden"], me: User = Depends(current_user),
                db: Session = Depends(get_db)):
    require_role(me, STAFF + ("dean",))
    q = select(Ticket).where(Ticket.status != "resolved")
    if role == "technician" and me.role == "technician":
        q = q.where(Ticket.assignee_id == me.id)
    tickets = db.scalars(q).all()
    tickets = sorted(tickets, key=lambda t: (-t.report_count, t.eta or t.created_at))
    return [ser_ticket(db, t) for t in tickets]


@router.post("/tickets/{ticket_id}/notes", status_code=201)
async def add_note(ticket_id: str, body: NoteIn, me: User = Depends(current_user), db: Session = Depends(get_db)):
    user = require_role(me, STAFF)
    t = _ticket(db, ticket_id)
    await department.on_note(db, t, user, body.text)
    return ser_ticket(db, t)


@router.post("/tickets/{ticket_id}/eta")
async def set_eta(ticket_id: str, body: EtaIn, me: User = Depends(current_user), db: Session = Depends(get_db)):
    """Warden confirms or changes the ETA students see."""
    warden = require_role(me, ("warden",))
    t = _ticket(db, ticket_id)
    if t.status == "resolved":
        raise HTTPException(409, f"{t.id} is already resolved")
    await department.confirm_eta(db, t, warden, body.eta.replace(tzinfo=None), body.reason or None)
    return ser_ticket(db, t)


@router.post("/tickets/{ticket_id}/decision")
async def decide(ticket_id: str, body: DecisionIn, me: User = Depends(current_user), db: Session = Depends(get_db)):
    user = require_role(me, STAFF)
    t = _ticket(db, ticket_id)
    if t.status == "resolved":
        raise HTTPException(409, f"{t.id} is already resolved")

    if body.action == "accept":
        t.status = "in_progress"
        t.visits += 1
        db.commit()
        what = f"Accepted the suggestion: {t.suggestion}" if t.suggestion else "Accepted the ticket"
        add_event(db, t, "person", user.id, what, body.note, t.suggestion_call_id)

    elif body.action == "override":
        if not body.note:
            raise HTTPException(422, "Override needs a note saying why")
        w = await meko.write(db, "technician", f"dept-{t.category}" if t.category != "other" else "campus-kb",
                       f"{t.id} override of “{t.suggestion or 'no suggestion'}”: {body.note}",
                       {"kind": "note", "ticket_id": t.id}, actor_id=user.id, target=t.category, ticket_id=t.id)
        t.status, t.visits = "in_progress", t.visits + 1
        db.commit()
        add_event(db, t, "person", user.id, "Overrode the agent suggestion", body.note, w.call_id)

    else:  # close: a person closes; the Curator then proposes a lesson
        if body.note and t.category != "other":
            w = await meko.write(db, "technician", f"dept-{t.category}", f"{t.id} fix: {body.note}",
                           {"kind": "fix", "ticket_id": t.id, "place_id": t.place_id}, actor_id=user.id,
                           ticket_id=t.id)
            call_id = w.call_id
        else:
            call_id = None
        t.status, t.closed_at, t.visits = "resolved", clock.now(), max(t.visits, 1)
        db.commit()
        add_event(db, t, "person", user.id, "Closed the ticket" + (f": {body.note}" if body.note else ""),
                  meko_call_id=call_id)
        add_message(db, "technician", "students", f"{t.id} resolved", "write", t.id, call_id)
        await desk.close_fingerprint(db, t, user.id)
        await curator.on_close(db, t, body.note)

    return ser_ticket(db, t)
