"""REST + WebSocket do chat interno entre usuários."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_

from app.core.database import SessionLocal
from app.core.deps import CurrentUser, DBSession
from app.core.security import decode_access_token
from app.models.chat import ChatChannel, ChatChannelKind, ChatMembership, ChatMessage
from app.models.user import User
from app.services.chat_hub import hub

router = APIRouter()
log = logging.getLogger("chat")


# ---------------- Schemas ----------------

class ChannelCreate(BaseModel):
    kind: ChatChannelKind
    nome: str | None = None                # obrigatório se group
    member_ids: list[int] = Field(default_factory=list)


class MessageIn(BaseModel):
    conteudo: str = Field(min_length=1, max_length=8000)


# ---------------- Helpers ----------------

def _serialize_channel(db, channel: ChatChannel, current_id: int) -> dict:
    members = (
        db.query(ChatMembership, User)
        .join(User, User.id == ChatMembership.user_id)
        .filter(ChatMembership.channel_id == channel.id)
        .all()
    )
    me_member = next((m for m, _u in members if m.user_id == current_id), None)
    last_read = me_member.last_read_at if me_member else None
    unread_q = db.query(func.count(ChatMessage.id)).filter(ChatMessage.channel_id == channel.id)
    if last_read:
        unread_q = unread_q.filter(ChatMessage.created_at > last_read)
    unread = unread_q.scalar() or 0

    member_payload = [
        {"user_id": u.id, "nome": u.nome, "email": u.email}
        for _m, u in members
    ]
    label = channel.nome
    if channel.kind == ChatChannelKind.dm and not label:
        other = next((u for _m, u in members if u.id != current_id), None)
        label = other.nome if other else "DM"

    last_msg = (
        db.query(ChatMessage)
        .filter(ChatMessage.channel_id == channel.id, ChatMessage.deleted_at.is_(None))
        .order_by(ChatMessage.created_at.desc())
        .first()
    )

    return {
        "id": channel.id,
        "kind": channel.kind.value,
        "nome": label,
        "members": member_payload,
        "last_message_at": channel.last_message_at,
        "last_message_preview": (last_msg.conteudo[:120] if last_msg else None),
        "last_message_user_id": (last_msg.user_id if last_msg else None),
        "unread": int(unread),
    }


def _ensure_member(db, channel_id: int, user_id: int) -> ChatMembership:
    m = (
        db.query(ChatMembership)
        .filter(ChatMembership.channel_id == channel_id, ChatMembership.user_id == user_id)
        .first()
    )
    if not m:
        raise HTTPException(status_code=403, detail="Você não é membro deste canal")
    return m


def _members_of(db, channel_id: int) -> list[int]:
    return [
        r[0]
        for r in db.query(ChatMembership.user_id)
        .filter(ChatMembership.channel_id == channel_id)
        .all()
    ]


def _find_dm(db, user_a: int, user_b: int) -> ChatChannel | None:
    """Retorna canal DM existente entre 2 users (se houver)."""
    rows = (
        db.query(ChatChannel)
        .join(ChatMembership, ChatMembership.channel_id == ChatChannel.id)
        .filter(ChatChannel.kind == ChatChannelKind.dm)
        .filter(ChatMembership.user_id.in_([user_a, user_b]))
        .group_by(ChatChannel.id)
        .having(func.count(ChatMembership.user_id) == 2)
        .all()
    )
    for ch in rows:
        ids = set(_members_of(db, ch.id))
        if ids == {user_a, user_b}:
            return ch
    return None


# ---------------- REST: canais ----------------

@router.get("/channels")
def list_channels(db: DBSession, current: CurrentUser):
    rows = (
        db.query(ChatChannel)
        .join(ChatMembership, ChatMembership.channel_id == ChatChannel.id)
        .filter(ChatMembership.user_id == current.id)
        .order_by(ChatChannel.last_message_at.desc().nullslast(), ChatChannel.created_at.desc())
        .all()
    )
    return [_serialize_channel(db, ch, current.id) for ch in rows]


@router.post("/channels", status_code=status.HTTP_201_CREATED)
def create_channel(payload: ChannelCreate, db: DBSession, current: CurrentUser):
    members = list({current.id, *payload.member_ids})
    if len(members) < 2:
        raise HTTPException(status_code=400, detail="Adicione pelo menos 1 outro membro")

    if payload.kind == ChatChannelKind.dm:
        if len(members) != 2:
            raise HTTPException(status_code=400, detail="DM exige exatamente 2 membros")
        existing = _find_dm(db, members[0], members[1])
        if existing:
            return _serialize_channel(db, existing, current.id)
    else:
        if not payload.nome:
            raise HTTPException(status_code=400, detail="Grupo precisa de nome")

    # Valida que todos os user_ids existem
    n = db.query(func.count(User.id)).filter(User.id.in_(members)).scalar() or 0
    if n != len(members):
        raise HTTPException(status_code=400, detail="Um ou mais usuários inválidos")

    channel = ChatChannel(
        kind=payload.kind,
        nome=payload.nome,
        created_by_id=current.id,
    )
    db.add(channel)
    db.flush()
    for uid in members:
        db.add(ChatMembership(channel_id=channel.id, user_id=uid))
    db.commit()
    db.refresh(channel)
    return _serialize_channel(db, channel, current.id)


@router.get("/channels/{channel_id}")
def get_channel(channel_id: int, db: DBSession, current: CurrentUser):
    ch = db.get(ChatChannel, channel_id)
    if not ch:
        raise HTTPException(status_code=404, detail="Canal não encontrado")
    _ensure_member(db, channel_id, current.id)
    return _serialize_channel(db, ch, current.id)


# ---------------- REST: mensagens ----------------

@router.get("/channels/{channel_id}/messages")
def list_messages(
    channel_id: int,
    db: DBSession,
    current: CurrentUser,
    before_id: int | None = None,
    limit: int = Query(50, ge=1, le=200),
):
    _ensure_member(db, channel_id, current.id)
    q = db.query(ChatMessage).filter(ChatMessage.channel_id == channel_id)
    if before_id:
        q = q.filter(ChatMessage.id < before_id)
    msgs = q.order_by(ChatMessage.id.desc()).limit(limit).all()
    msgs.reverse()
    return [
        {
            "id": m.id,
            "channel_id": m.channel_id,
            "user_id": m.user_id,
            "conteudo": (m.conteudo if not m.deleted_at else "(mensagem removida)"),
            "edited_at": m.edited_at,
            "deleted_at": m.deleted_at,
            "created_at": m.created_at,
        }
        for m in msgs
    ]


@router.post("/channels/{channel_id}/messages", status_code=status.HTTP_201_CREATED)
async def post_message(channel_id: int, payload: MessageIn, db: DBSession, current: CurrentUser):
    _ensure_member(db, channel_id, current.id)
    ch = db.get(ChatChannel, channel_id)
    msg = ChatMessage(channel_id=channel_id, user_id=current.id, conteudo=payload.conteudo.strip())
    db.add(msg)
    ch.last_message_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(msg)

    payload_evt = {
        "type": "message",
        "channel_id": channel_id,
        "message": {
            "id": msg.id,
            "channel_id": channel_id,
            "user_id": current.id,
            "user_nome": current.nome,
            "conteudo": msg.conteudo,
            "created_at": msg.created_at.isoformat(),
        },
    }
    await hub.push(_members_of(db, channel_id), payload_evt)
    return payload_evt["message"]


@router.post("/channels/{channel_id}/read")
def mark_read(channel_id: int, db: DBSession, current: CurrentUser):
    m = _ensure_member(db, channel_id, current.id)
    m.last_read_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True, "last_read_at": m.last_read_at}


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(message_id: int, db: DBSession, current: CurrentUser):
    msg = db.get(ChatMessage, message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Mensagem não encontrada")
    if msg.user_id != current.id:
        raise HTTPException(status_code=403, detail="Você só pode remover suas próprias mensagens")
    msg.deleted_at = datetime.now(timezone.utc)
    db.commit()
    await hub.push(
        _members_of(db, msg.channel_id),
        {"type": "delete", "channel_id": msg.channel_id, "message_id": message_id},
    )


# ---------------- WebSocket ----------------

@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, token: str = Query(...)):
    """Conexão WS pra receber eventos. Auth via JWT na query: /ws?token=..."""
    payload = decode_access_token(token)
    if not payload:
        await ws.close(code=4401)
        return
    try:
        user_id = int(payload.get("sub", 0))
    except (TypeError, ValueError):
        await ws.close(code=4401)
        return
    if not user_id:
        await ws.close(code=4401)
        return

    await ws.accept()
    await hub.connect(user_id, ws)
    try:
        while True:
            data = await ws.receive_text()
            # Suporte mínimo a "typing" — broadcast pros canais do user
            if data.startswith('{"type":"typing"'):
                try:
                    import json
                    evt = json.loads(data)
                    ch_id = int(evt.get("channel_id"))
                    with SessionLocal() as db:
                        members = _members_of(db, ch_id)
                    await hub.push(
                        [m for m in members if m != user_id],
                        {"type": "typing", "channel_id": ch_id, "user_id": user_id},
                    )
                except Exception:
                    pass
            elif data == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        await hub.disconnect(user_id, ws)
