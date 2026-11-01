from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..agents import pattern
from ..auth import current_user
from ..db import get_db
from ..meko_client import meko
from ..models import User
from ..services import ser_approval
from . import require_role

router = APIRouter(tags=["dean"])


@router.get("/dean/patterns")
async def patterns(me: User = Depends(current_user), db: Session = Depends(get_db)):
    """Verified patterns only, read from campus-kb. Empty when Meko is OFF: nothing is invented."""
    require_role(me, ("dean", "warden"))
    r = await meko.recall(db, "dean", ["campus-kb"], "", k=20, where={"kind": "pattern", "verified": True})
    return {"call_id": r.call_id, "meko_skipped": r.skipped,
            "patterns": [{"id": i["id"], "text": i["text"], "stat": i["meta"].get("stat"),
                          "series": i["meta"].get("series", []), "verified_by": i["meta"].get("approved_by"),
                          "category": i["meta"].get("category")} for i in r.items]}


@router.get("/kb")
async def campus_kb(kind: str = "lesson", db: Session = Depends(get_db)):
    """Campus Knowledge list (approved lessons by default), read from Meko like everything else."""
    r = await meko.recall(db, "warden", ["campus-kb"], "", k=50, where={"kind": kind})
    return {"call_id": r.call_id, "meko_skipped": r.skipped,
            "items": [{"id": i["id"], "text": i["text"], "approved_by": i["meta"].get("approved_by"),
                       "category": i["meta"].get("category"), "source_ticket": i["meta"].get("source_ticket")}
                      for i in r.items]}


@router.post("/dean/patterns/scan")
async def scan(me: User = Depends(current_user), db: Session = Depends(get_db)):
    """Pattern agent tick: flags repeats as approvals for the Warden to verify."""
    require_role(me, ("warden", "dean"))
    return [ser_approval(a) for a in await pattern.scan(db)]
