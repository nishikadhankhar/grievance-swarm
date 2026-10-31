from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import clock
from ..agents import department
from ..db import get_db
from ..meko_client import meko
from ..models import Directive, User
from ..services import add_message

router = APIRouter(tags=["directives"])


class DirectiveIn(BaseModel):
    department: Literal["electricity", "wifi", "water"] = "electricity"
    hostel: str = Field(description="hostel-a, hostel-b or all")
    message: str = Field(min_length=3, max_length=300)
    valid_to: str = Field(description="HH:MM today (or tomorrow if already past), or an ISO datetime")
    user_id: str | None = None
    simulated: bool = False


def _parse_until(value: str) -> datetime:
    now = clock.now()
    try:
        if len(value) <= 5:
            h, m = value.split(":")
            t = now.replace(hour=int(h), minute=int(m), second=0)
            return t if t > now else t + timedelta(days=1)
        return datetime.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(422, "valid_to must be HH:MM or ISO datetime") from exc


@router.post("/events/directive", status_code=201)
async def post_directive(body: DirectiveIn, db: Session = Depends(get_db)):
    if body.user_id and db.get(User, body.user_id) is None:
        raise HTTPException(404, f"Unknown user {body.user_id}")
    until = _parse_until(body.valid_to)
    # Directive/share: written into every department datapack so each agent reads it with its own recall.
    r = meko.directive(db, body.department, [f"dept-{d}" for d in ("electricity", "wifi", "water")], body.message,
                       {"kind": "directive", "hostel": body.hostel, "department": body.department,
                        "valid_to": until.isoformat()},
                       actor_id=body.user_id, target="technician", simulated=body.simulated)
    d = Directive(department=body.department, hostel=body.hostel, message=body.message, valid_from=clock.now(),
                  valid_to=until, posted_by=body.user_id, meko_call_id=r.call_id, simulated=body.simulated)
    db.add(d)
    db.commit()
    add_message(db, body.department, "technician", body.message, "directive", meko_call_id=r.call_id,
                simulated=body.simulated)
    held = await department.apply_directive(db, d, body.simulated)
    return {"id": d.id, "valid_to": until.isoformat(), "meko_call_id": r.call_id, "meko_skipped": r.skipped,
            "held_tickets": held}
