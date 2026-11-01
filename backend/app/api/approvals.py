from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..agents import curator
from ..db import get_db
from ..auth import current_user
from ..models import Approval, User
from ..services import ser_approval
from . import require_role

router = APIRouter(tags=["approvals"])


class DecideIn(BaseModel):
    decision: Literal["approve", "reject"]
    edited_text: str | None = Field(default=None, max_length=300)


@router.get("/approvals")
async def list_approvals(status: Literal["pending", "approved", "rejected"] | None = "pending",
                         db: Session = Depends(get_db)):
    q = select(Approval).order_by(Approval.created_at.desc())
    if status:
        q = q.where(Approval.status == status)
    return [ser_approval(a) for a in db.scalars(q).all()]


@router.post("/approvals/{approval_id}")
async def decide(approval_id: int, body: DecideIn, me: User = Depends(current_user),
                 db: Session = Depends(get_db)):
    warden = require_role(me, ("warden",))
    a = db.get(Approval, approval_id)
    if a is None:
        raise HTTPException(404, f"Unknown approval {approval_id}")
    a = await curator.decide(db, a, warden, body.decision == "approve", body.edited_text)
    return ser_approval(a)
