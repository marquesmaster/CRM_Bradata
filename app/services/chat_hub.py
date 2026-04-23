"""Hub de WebSockets em memória para o chat interno.

Single-process: ok para 1 worker uvicorn. Para multi-worker, trocar por
Postgres LISTEN/NOTIFY ou Redis pub/sub.
"""
from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

log = logging.getLogger("chat_hub")


class ChatHub:
    def __init__(self) -> None:
        # user_id -> set[WebSocket]
        self._conns: dict[int, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, user_id: int, ws: WebSocket) -> None:
        async with self._lock:
            self._conns[user_id].add(ws)

    async def disconnect(self, user_id: int, ws: WebSocket) -> None:
        async with self._lock:
            self._conns[user_id].discard(ws)
            if not self._conns[user_id]:
                self._conns.pop(user_id, None)

    async def push(self, user_ids: list[int], event: dict[str, Any]) -> None:
        """Manda event JSON para todos os WS dos user_ids dados."""
        if not user_ids:
            return
        payload = json.dumps(event, default=str)
        dead: list[tuple[int, WebSocket]] = []
        async with self._lock:
            targets = [(uid, ws) for uid in user_ids for ws in self._conns.get(uid, set())]
        for uid, ws in targets:
            try:
                await ws.send_text(payload)
            except Exception as e:
                log.debug("WS dead user=%s: %s", uid, e)
                dead.append((uid, ws))
        if dead:
            async with self._lock:
                for uid, ws in dead:
                    self._conns[uid].discard(ws)


hub = ChatHub()
