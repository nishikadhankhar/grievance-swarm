"""Desk agent: classify a new grievance, merge it into a similar open ticket or create one, route it.

Tools: recall_similar, merge_into, create_ticket, route_to.
"""

from datetime import timedelta

from sqlalchemy.orm import Session

from .. import clock, llm
from ..meko_client import MekoResult, meko
from ..models import Grievance, Place, Ticket, User
from ..redact import redact
from ..services import (AGENT_NAMES, DEPARTMENTS, add_event, add_message, get_settings, next_ticket_id,
                        technician_for)
from . import department

MERGE_WINDOW = timedelta(hours=48)


async def recall_similar(db: Session, text: str, place_id: str, category: str, actor_id: str | None = None,
                   simulated: bool = False) -> tuple[Ticket | None, MekoResult]:
    r = await meko.recall(db, "desk", ["desk"], text, k=3, min_score=0.12, actor_id=actor_id, simulated=simulated,
                    where={"kind": "fingerprint", "status": "open", "place_id": place_id, "category": category})
    for item in r.items:
        t = db.get(Ticket, item["meta"].get("ticket_id"))
        if t and t.status != "resolved" and clock.now() - t.created_at <= MERGE_WINDOW:
            return t, r
    return None, r


async def preview(db: Session, text: str, place_id: str) -> dict:
    cls = await llm.classify(get_settings(db), redact(text))
    ticket, r = await recall_similar(db, text, place_id, cls["category"])
    return {"category": cls["category"], "call_id": r.call_id, "meko_skipped": r.skipped,
            "similar": None if not ticket else {
                "ticket_id": ticket.id, "title": ticket.title, "report_count": ticket.report_count,
                "message": f"{ticket.report_count} others reported a similar issue – "
                           f"we'll add you to ticket {ticket.id}."}}


async def handle_grievance(db: Session, user: User | None, text: str, place: Place, photo_url: str | None = None,
                           simulated: bool = False) -> tuple[Ticket, Grievance, bool]:
    red = redact(text)
    cls = await llm.classify(get_settings(db), red)
    category = cls["category"]
    reporter = user.id if user else "anonymous"
    ticket, r = await recall_similar(db, red, place.id, category, actor_id=reporter, simulated=simulated)

    g = Grievance(user_id=user.id if user else None, raw_text_redacted=red, place_id=place.id, category=category,
                  photo_url=photo_url, created_at=clock.now())
    db.add(g)

    if ticket:  # merge_into
        ticket.report_count += 1
        g.ticket_id = ticket.id
        db.commit()
        add_event(db, ticket, "person", reporter, f"Reported “{ticket.title}”", simulated=simulated)
        note = await meko.write(db, "desk", "desk", f"Merged report into {ticket.id}: {red}",
                          {"kind": "merge_note", "ticket_id": ticket.id}, ticket_id=ticket.id, simulated=simulated)
        add_event(db, ticket, "agent", "desk", f"Merged into {ticket.id}",
                  f"{ticket.report_count - 1} similar open reports at {place.name}", r.call_id, simulated)
        dept = category if category in DEPARTMENTS else "warden"
        add_message(db, "desk", dept, f"{ticket.id} +1 report ({ticket.report_count} total)", "write", ticket.id,
                    note.call_id, simulated)
        return ticket, g, True

    # create_ticket
    ticket = Ticket(id=next_ticket_id(db), title=cls["title"], category=category, place_id=place.id,
                    status="reported", report_count=1, created_at=clock.now())
    db.add(ticket)
    g.ticket_id = ticket.id
    db.commit()
    add_event(db, ticket, "person", reporter, f"Reported “{ticket.title}”", simulated=simulated)
    fp = await meko.write(db, "desk", "desk", f"{ticket.title}. {red}",
                    {"kind": "fingerprint", "ticket_id": ticket.id, "status": "open", "place_id": place.id,
                     "category": category}, ticket_id=ticket.id, simulated=simulated)
    why = "No similar open ticket found" if not r.skipped else "Meko is OFF, so no duplicate check"
    add_event(db, ticket, "agent", "desk", f"Created {ticket.id}, tagged {category}", why, fp.call_id, simulated)
    await route_to(db, ticket, place, red, simulated)
    return ticket, g, False


async def route_to(db: Session, ticket: Ticket, place: Place, text: str, simulated: bool = False) -> None:
    dept = ticket.category if ticket.category in DEPARTMENTS else None
    if dept is None:
        ticket.status = "assigned"
        db.commit()
        add_event(db, ticket, "agent", "desk", "Routed to the Warden for triage", "No matching department",
                  simulated=simulated)
        add_message(db, "desk", "warden", f"{ticket.id}: needs triage ({ticket.title})", "write", ticket.id,
                    simulated=simulated)
        return
    sh = await meko.share(db, "desk", dept, f"dept-{dept}", f"New ticket {ticket.id} at {place.name}: {text}",
                    {"kind": "handoff", "ticket_id": ticket.id}, ticket_id=ticket.id, simulated=simulated)
    tech = technician_for(db, dept)
    ticket.status = "assigned"
    ticket.assignee_id = tech.id if tech else None
    db.commit()
    add_event(db, ticket, "agent", "desk", f"Routed to {AGENT_NAMES[dept]}",
              f"Category {dept} at {place.name}", sh.call_id, simulated)
    add_message(db, "desk", dept, f"{ticket.id} routed: {ticket.title}", "share", ticket.id, sh.call_id, simulated)
    await department.on_new_ticket(db, ticket, simulated=simulated)


async def close_fingerprint(db: Session, ticket: Ticket, actor_id: str | None = None) -> None:
    r = await meko.recall(db, "desk", ["desk"], "", k=1, where={"kind": "fingerprint", "ticket_id": ticket.id},
                    actor_id=actor_id, ticket_id=ticket.id)
    if r.items:
        await meko.update(db, "desk", r.items[0], {"status": "closed"}, ticket_id=ticket.id)
