from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import clock
from ..bus import bus
from ..db import get_db
from ..services import get_settings

router = APIRouter(tags=["settings"])


class SettingsIn(BaseModel):
    llm_base_url: str | None = None
    model: str | None = None
    llm_enabled: bool | None = None
    meko_enabled: bool | None = None
    clock_offset_minutes: int | None = Field(default=None, ge=0, le=60 * 24 * 365)


class FastForwardIn(BaseModel):
    minutes: int = Field(gt=0, le=60 * 24 * 60)


def _ser(db: Session) -> dict:
    s = get_settings(db)
    return {"llm_base_url": s.llm_base_url, "model": s.model, "llm_enabled": s.llm_enabled,
            "meko_enabled": s.meko_enabled, "clock_offset_minutes": s.clock_offset_minutes,
            "now": clock.now().isoformat()}


@router.get("/settings")
async def read(db: Session = Depends(get_db)):
    return _ser(db)


@router.post("/settings")
async def update(body: SettingsIn, db: Session = Depends(get_db)):
    s = get_settings(db)
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(s, key, value)
    db.commit()
    clock.set_offset(s.clock_offset_minutes)
    out = _ser(db)
    bus.publish("settings.updated", out)
    return out


@router.post("/settings/fast-forward")
async def fast_forward(body: FastForwardIn, db: Session = Depends(get_db)):
    s = get_settings(db)
    s.clock_offset_minutes += body.minutes
    db.commit()
    clock.set_offset(s.clock_offset_minutes)
    out = _ser(db)
    bus.publish("settings.updated", out)
    return out
