"""Curator agent: turns a closed ticket into a proposed lesson. Promotion needs a Warden's approval.

Tools: summarise_case, propose_lesson.
"""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import clock, llm
from ..bus import bus
from ..meko_client import meko
from ..models import Approval, Ticket, TicketEvent, User
from ..services import add_event, add_message, get_settings, ser_approval


async def summarise_case(db: Session, ticket: Ticket, closing_note: str | None) -> str:
    notes = [e.action.removeprefix("Note: ").strip("“”") for e in db.scalars(
        select(TicketEvent).where(TicketEvent.ticket_id == ticket.id, TicketEvent.actor_type == "person",
                                  TicketEvent.action.startswith("Note: ")).order_by(TicketEvent.at)).all()]
    if closing_note:
        notes.append(closing_note)
    return await llm.summarise_lesson(get_settings(db), ticket.title, notes)


async def on_close(db: Session, ticket: Ticket, closing_note: str | None) -> Approval:
    lesson = await summarise_case(db, ticket, closing_note)
    log = meko.log_approval(db, "curator", f"Proposed lesson: {lesson}", target="warden", ticket_id=ticket.id)
    a = Approval(kind="lesson", proposed_by_agent="curator", status="pending", ticket_id=ticket.id,
                 meko_call_id=log.call_id, created_at=clock.now(),
                 payload={"lesson": lesson, "category": ticket.category, "place_id": ticket.place_id,
                          "evidence": f"Closed {ticket.id} ({ticket.report_count} reports, {ticket.visits} visits)"})
    db.add(a)
    db.commit()
    add_event(db, ticket, "agent", "curator", "Proposed a lesson for Warden approval", lesson, log.call_id)
    add_message(db, "curator", "warden", f"Proposed lesson: {lesson}", "approval", ticket.id, log.call_id)
    bus.publish("approval.created", ser_approval(a))
    return a


async def decide(db: Session, a: Approval, warden: User, approve: bool, edited_text: str | None = None) -> Approval:
    if a.status != "pending":
        raise HTTPException(409, f"Approval {a.id} is already {a.status}")
    verb = "Approved" if approve else "Rejected"
    text = (edited_text or a.payload.get("lesson") or a.payload.get("pattern") or "").strip()
    log = meko.log_approval(db, "warden", f"{verb} {a.kind}: {text}", actor_id=warden.id, target="curator",
                            ticket_id=a.ticket_id)
    a.status = "approved" if approve else "rejected"
    a.decided_by, a.decided_at = warden.id, clock.now()
    if edited_text:
        a.payload = {**a.payload, "lesson" if a.kind == "lesson" else "pattern": edited_text}
    db.commit()
    add_message(db, "warden", "curator", f"{verb} {a.kind}: {text}", "approval", a.ticket_id, log.call_id)

    if approve and a.kind in ("lesson", "pattern"):
        meta = {"kind": a.kind, "approved_by": warden.id, "source_ticket": a.ticket_id,
                "category": a.payload.get("category")}
        if a.kind == "pattern":
            meta.update(verified=True, series=a.payload.get("series", []), stat=a.payload.get("stat"))
        p = await meko.promote(db, "curator", text, meta, ticket_id=a.ticket_id)
        add_message(db, "curator", "campus-kb", f"Promote: {text}", "promote", a.ticket_id, p.call_id)
    elif approve and a.kind == "closure" and a.ticket_id:
        t = db.get(Ticket, a.ticket_id)
        if t and t.status != "resolved":
            t.status, t.closed_at = "resolved", clock.now()
            db.commit()
            add_event(db, t, "person", warden.id, "Approved closure", meko_call_id=log.call_id)
    bus.publish("approval.decided", ser_approval(a))
    return a
