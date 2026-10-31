"""In-process event bus that fans out to WebSocket clients.

Publish only from the event loop (all routes are async), since asyncio queues are not thread-safe.
"""

import asyncio


class EventBus:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=1000)
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subscribers.discard(q)

    def publish(self, type_: str, data: dict) -> None:
        event = {"type": type_, "data": data}
        for q in list(self._subscribers):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass  # slow client; drop rather than block agents


bus = EventBus()
