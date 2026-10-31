"""Shared helpers: serializers, timeline events and stream messages (each pushed to the bus)."""

import re
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import clock
from .bus import bus
from .models import Approval, MekoCall, Message, Place, Setting, Ticket, TicketEvent, User

DEPARTMENTS = ("wifi", "electricity", "water")
AGENT_NAMES = {"desk": "Desk agent", "wifi": "Wi-Fi agent", "electricity": "Electricity agent",
               "water": "Water agent", "curator": "Curator", "pattern": "Pattern agent"}
ROLE_NODE = {"student": "student", "technician": "technician", "warden": "warden", "dean": "dean"}


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def get_settings(db: Session) -> Setting:
    s = db.get(Setting, 1)
    if s is None:
        from . import config

        s = Setting(id=1, llm_base_url=config.LLM_BASE_URL, model=config.LLM_MODEL,
                    llm_enabled=True, meko_enabled=True, clock_offset_minutes=0)
        db.add(s)
        db.commit()
    return s


def node_for_user(user: User | None) -> str:
    return ROLE_NODE.get(user.role, "student") if user else "student"


def ser_call(c: MekoCall) -> dict:
    return {"id": c.id, "at": iso(c.at), "actor": c.actor, "actor_id": c.actor_id, "target": c.target, "op": c.op,
            "datapack": c.datapack, "summary": c.summary, "result_ids": c.result_ids,
            "result_preview": c.result_preview, "latency_ms": c.latency_ms, "error": c.error,
            "skipped": c.skipped, "simulated": c.simulated, "ticket_id": c.ticket_id}


def ser_ticket(db: Session, t: Ticket) -> dict:
    place = db.get(Place, t.place_id)
    assignee = db.get(User, t.assignee_id) if t.assignee_id else None
    return {"id": t.id, "title": t.title, "category": t.category, "status": t.status,
            "place": {"id": t.place_id, "name": place.name if place else t.place_id},
            "assignee": {"id": assignee.id, "name": assignee.pseudonym} if assignee else None,
            "eta": iso(t.eta), "eta_reason": t.eta_reason, "report_count": t.report_count,
            "suggestion": t.suggestion, "suggestion_call_id": t.suggestion_call_id, "visits": t.visits,
            "created_at": iso(t.created_at), "closed_at": iso(t.closed_at)}


def ser_event(db: Session, e: TicketEvent, with_call: bool = True) -> dict:
    out = {"id": e.id, "ticket_id": e.ticket_id, "actor_type": e.actor_type, "actor_id": e.actor_id,
           "actor_name": actor_name(db, e.actor_type, e.actor_id), "action": e.action, "reason": e.reason,
           "meko_call_id": e.meko_call_id, "simulated": e.simulated, "at": iso(e.at), "meko": None}
    if with_call and e.meko_call_id:
        c = db.get(MekoCall, e.meko_call_id)
        if c:
            out["meko"] = {"call_id": c.id, "op": c.op, "datapack": c.datapack, "skipped": c.skipped,
                           "recalled": c.result_preview if c.op == "recall" else []}
    return out


def ser_message(m: Message) -> dict:
    return {"id": m.id, "at": iso(m.at), "from": m.from_actor, "to": m.to_actor, "text": m.text, "kind": m.kind,
            "ticket_id": m.ticket_id, "meko_call_id": m.meko_call_id, "simulated": m.simulated}


def ser_approval(a: Approval) -> dict:
    return {"id": a.id, "kind": a.kind, "payload": a.payload, "proposed_by_agent": a.proposed_by_agent,
            "decided_by": a.decided_by, "status": a.status, "ticket_id": a.ticket_id,
            "meko_call_id": a.meko_call_id, "simulated": a.simulated,
            "created_at": iso(a.created_at), "decided_at": iso(a.decided_at)}


def actor_name(db: Session, actor_type: str, actor_id: str) -> str:
    if actor_type == "agent":
        return AGENT_NAMES.get(actor_id, actor_id)
    u = db.get(User, actor_id)
    if u is None:
        return "Anonymous student" if actor_id == "anonymous" else actor_id
    return f"{u.id} (Student)" if u.role == "student" else u.pseudonym


def add_event(db: Session, ticket: Ticket, actor_type: str, actor_id: str, action: str, reason: str | None = None,
              meko_call_id: str | None = None, simulated: bool = False, at: datetime | None = None) -> TicketEvent:
    e = TicketEvent(ticket_id=ticket.id, actor_type=actor_type, actor_id=actor_id, action=action, reason=reason,
                    meko_call_id=meko_call_id, simulated=simulated, at=at or clock.now())
    db.add(e)
    db.commit()
    bus.publish("ticket.updated", {"ticket": ser_ticket(db, ticket), "event": ser_event(db, e)})
    return e


def add_message(db: Session, frm: str, to: str, text: str, kind: str, ticket_id: str | None = None,
                meko_call_id: str | None = None, simulated: bool = False, at: datetime | None = None) -> Message:
    m = Message(at=at or clock.now(), from_actor=frm, to_actor=to, text=text, kind=kind, ticket_id=ticket_id,
                meko_call_id=meko_call_id, simulated=simulated)
    db.add(m)
    db.commit()
    bus.publish("message", ser_message(m))
    return m


def next_ticket_id(db: Session) -> str:
    ids = db.scalars(select(Ticket.id)).all()
    nums = [int(m.group(1)) for i in ids if (m := re.fullmatch(r"T-(\d+)", i))]
    return f"T-{(max(nums) + 1 if nums else 1):03d}"


def technician_for(db: Session, department: str) -> User | None:
    return db.scalars(select(User).where(User.role == "technician", User.department == department)).first()
