from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..auth import user_for_token
from ..bus import bus
from ..db import SessionLocal

router = APIRouter()


@router.websocket("/ws/events")
async def events(ws: WebSocket, token: str | None = None):
    """Pushes ticket.updated, meko.call, message, approval.* and settings.updated events. Nothing polls.

    Browsers can't set headers on a WebSocket, so the session token comes as ?token=.
    """
    with SessionLocal() as db:
        signed_in = user_for_token(db, token) is not None
    if not signed_in:
        await ws.close(code=4401, reason="Sign in first")
        return
    await ws.accept()
    q = bus.subscribe()
    try:
        await ws.send_json({"type": "hello", "data": {}})
        while True:
            await ws.send_json(await q.get())
    except WebSocketDisconnect:
        pass
    finally:
        bus.unsubscribe(q)
