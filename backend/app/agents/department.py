"""Department agents (Electricity, Wi-Fi, Water). One code path, one datapack each.

Tools: recall_fixes, read_directives, propose_eta, set_eta, notify, remind.
"""

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import clock, llm
from ..meko_client import meko
from ..models import Directive, Grievance, Place, Ticket, User
from ..services import DEPARTMENTS, add_event, add_message, get_settings

BASE_HOURS = {"wifi": 2, "electricity": 3, "water": 4}
HOLD_BUFFER = timedelta(minutes=30)


def dp(dept: str) -> str:
    return f"dept-{dept}"


def _hostel(db: Session, ticket: Ticket) -> str | None:
    place = db.get(Place, ticket.place_id)
    return place.hostel if place else None


async def recall_fixes(db: Session, ticket: Ticket, simulated: bool = False, force: bool | None = None):
    text = " ".join([ticket.title] + db.scalars(
        select(Grievance.raw_text_redacted).where(Grievance.ticket_id == ticket.id).limit(3)).all())
    return await meko.recall(db, ticket.category, [dp(ticket.category), "campus-kb"], text, k=3, min_score=0.15,
                       where={"kind": ["fix", "lesson", "note"]}, ticket_id=ticket.id, simulated=simulated,
                       force=force)


async def read_directives(db: Session, ticket: Ticket, query: str = "", simulated: bool = False):
    """Returns (hold_until, directive_text, call_id) for the latest active power directive, or Nones."""
    hostel = _hostel(db, ticket)
    r = await meko.recall(db, ticket.category, [dp(ticket.category)], query, k=5, min_score=0.0,
                    where={"kind": "directive", "hostel": [hostel, "all"]}, ticket_id=ticket.id,
                    simulated=simulated)
    now = clock.now()
    active = [(datetime.fromisoformat(i["meta"]["valid_to"]), i["text"]) for i in r.items
              if datetime.fromisoformat(i["meta"]["valid_to"]) > now]
    if not active:
        return None, None, r.call_id
    until, text = max(active)
    return until, text, r.call_id


async def on_new_ticket(db: Session, ticket: Ticket, simulated: bool = False) -> None:
    r = await recall_fixes(db, ticket, simulated)
    if r.items:
        top = r.items[0]
        ticket.suggestion, ticket.suggestion_call_id = top["text"], r.call_id
        db.commit()
        source = "Campus Knowledge" if top["datapack"] == "campus-kb" else "past fixes"
        add_event(db, ticket, "agent", ticket.category, f"Suggested: {top['text']}",
                  f"Recalled from {source} ({top['datapack']})", r.call_id, simulated)
        add_message(db, ticket.category, "technician", f"{ticket.id} flag: {top['text']}", "recall", ticket.id,
                    r.call_id, simulated)
    await propose_eta(db, ticket, simulated=simulated)


async def propose_eta(db: Session, ticket: Ticket, simulated: bool = False) -> None:
    """A first estimate for the Warden to confirm or change. Students see the time only once it's confirmed."""
    eta = clock.now() + timedelta(hours=BASE_HOURS.get(ticket.category, 4))
    hold_until, _, read_id = await read_directives(db, ticket, simulated=simulated)
    reason = None
    if hold_until and eta < hold_until + HOLD_BUFFER:
        eta = hold_until + HOLD_BUFFER
        reason = f"Delayed because of a power cut until {hold_until:%H:%M}"
    ticket.eta, ticket.eta_reason, ticket.eta_confirmed = eta, reason, False
    db.commit()
    w = await meko.write(db, ticket.category, dp(ticket.category),
                   f"Proposed ETA for {ticket.id}: {eta:%a %H:%M}" + (f" because: {reason}" if reason else ""),
                   {"kind": "eta", "ticket_id": ticket.id, "confirmed": False}, ticket_id=ticket.id,
                   target="warden", simulated=simulated)
    add_event(db, ticket, "agent", ticket.category, f"Proposed ETA {eta:%a %H:%M} for the Warden to confirm", reason,
              read_id if hold_until else w.call_id, simulated)
    add_message(db, ticket.category, "warden", f"{ticket.id}: proposed ETA {eta:%a %H:%M}, please confirm", "write",
                ticket.id, w.call_id, simulated)


async def confirm_eta(db: Session, ticket: Ticket, warden: User, eta: datetime, reason: str | None) -> None:
    """The Warden sets the time students see, then every reporter on the ticket is notified."""
    ticket.eta, ticket.eta_reason, ticket.eta_confirmed = eta, reason, True
    db.commit()
    w = await meko.write(db, "warden", dp(ticket.category) if ticket.category in DEPARTMENTS else "campus-kb",
                   f"Warden set ETA for {ticket.id} to {eta:%a %H:%M}" + (f" because: {reason}" if reason else ""),
                   {"kind": "eta", "ticket_id": ticket.id, "confirmed": True}, actor_id=warden.id,
                   target="students", ticket_id=ticket.id)
    add_event(db, ticket, "person", warden.id, f"Set ETA to {eta:%a %H:%M}", reason, w.call_id)
    add_message(db, "warden", "students", f"{ticket.id}: ETA {eta:%a %H:%M}" + (f" — {reason}" if reason else "") +
                f" (notified all {ticket.report_count} students)", "write", ticket.id, w.call_id)


async def set_eta(db: Session, ticket: Ticket, base: datetime | None = None, reason: str | None = None,
                  simulated: bool = False, notify_all: bool = False) -> None:
    eta = base or clock.now() + timedelta(hours=BASE_HOURS.get(ticket.category, 4))
    hold_until, hold_text, read_id = await read_directives(db, ticket, simulated=simulated)
    if hold_until and eta < hold_until + HOLD_BUFFER:
        eta = hold_until + HOLD_BUFFER
        reason = f"Delayed because of a power cut until {hold_until:%H:%M}"
    ticket.eta, ticket.eta_reason = eta, reason
    db.commit()
    w = await meko.write(db, ticket.category, dp(ticket.category),
                   f"ETA for {ticket.id} set to {eta:%a %H:%M}" + (f" because: {reason}" if reason else ""),
                   {"kind": "eta", "ticket_id": ticket.id}, ticket_id=ticket.id, simulated=simulated)
    add_event(db, ticket, "agent", ticket.category, f"ETA set to {eta:%a %H:%M}", reason,
              read_id if hold_until else w.call_id, simulated)
    who = f"all {ticket.report_count} students" if notify_all else "students"
    add_message(db, ticket.category, "students", f"{ticket.id}: ETA {eta:%a %H:%M}" +
                (f" — {reason}" if reason else "") + f" (notified {who})", "write", ticket.id, w.call_id, simulated)


async def on_note(db: Session, ticket: Ticket, user: User, note: str) -> None:
    """Person → agent hand-off: a staff note is written to Meko, then the agent reacts to it."""
    w = await meko.write(db, "technician", dp(ticket.category), f"{ticket.id} note: {note}",
                   {"kind": "note", "ticket_id": ticket.id}, actor_id=user.id, target=ticket.category,
                   ticket_id=ticket.id)
    add_event(db, ticket, "person", user.id, f"Note: “{note}”", meko_call_id=w.call_id)
    if ticket.category not in DEPARTMENTS:
        return
    new_eta = await llm.extract_eta(get_settings(db), note, clock.now())
    if new_eta:
        await set_eta(db, ticket, base=new_eta, reason=f"Per technician note: {note}", notify_all=True)


async def apply_directive(db: Session, directive: Directive, simulated: bool = False) -> list[str]:
    """Hold every open ticket in the affected hostel whose ETA falls inside the power cut."""
    held = []
    tickets = db.scalars(select(Ticket).where(Ticket.status != "resolved",
                                              Ticket.category.in_(DEPARTMENTS))).all()
    for t in tickets:
        if directive.hostel != "all" and _hostel(db, t) != directive.hostel:
            continue
        hold_until, _, read_id = await read_directives(db, t, directive.message, simulated)
        if not hold_until or (t.eta and t.eta >= hold_until + HOLD_BUFFER):
            continue
        t.eta = hold_until + HOLD_BUFFER
        t.eta_reason = f"Delayed because of a power cut until {hold_until:%H:%M}"
        db.commit()
        w = await meko.write(db, t.category, dp(t.category), f"Hold {t.id} until {t.eta:%H:%M}: {directive.message}",
                       {"kind": "hold", "ticket_id": t.id}, ticket_id=t.id, simulated=simulated)
        add_event(db, t, "agent", t.category, f"Held until {t.eta:%H:%M}", t.eta_reason, read_id, simulated)
        add_message(db, t.category, "students", f"{t.id}: ETA {t.eta:%H:%M} — {t.eta_reason}", "write", t.id,
                    w.call_id, simulated)
        held.append(t.id)
    return held
