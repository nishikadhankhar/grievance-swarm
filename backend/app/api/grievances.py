from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..agents import desk
from ..db import get_db
from ..models import Place
from ..services import ser_ticket
from . import require_user

router = APIRouter(tags=["grievances"])


class PreviewIn(BaseModel):
    text: str = Field(min_length=3, max_length=2000)
    place_id: str


class GrievanceIn(PreviewIn):
    user_id: str
    photo_url: str | None = None
    anonymous: bool = False


def _place(db: Session, place_id: str) -> Place:
    place = db.get(Place, place_id)
    if place is None:
        raise HTTPException(404, f"Unknown place {place_id}")
    return place


@router.post("/grievances/preview")
async def preview(body: PreviewIn, db: Session = Depends(get_db)):
    """Powers the '14 others reported a similar issue' banner before submitting."""
    _place(db, body.place_id)
    return await desk.preview(db, body.text, body.place_id)


@router.post("/grievances", status_code=201)
async def create_grievance(body: GrievanceIn, db: Session = Depends(get_db)):
    user = require_user(db, body.user_id, ("student",))
    ticket, g, merged = await desk.handle_grievance(db, None if body.anonymous else user, body.text,
                                                    _place(db, body.place_id), body.photo_url)
    return {"grievance_id": g.id, "merged": merged, "ticket": ser_ticket(db, ticket)}
