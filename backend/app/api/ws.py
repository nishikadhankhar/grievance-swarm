from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..bus import bus

router = APIRouter()


@router.websocket("/ws/events")
async def events(ws: WebSocket):
    """Pushes ticket.updated, meko.call, message, approval.* and settings.updated events. Nothing polls."""
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
