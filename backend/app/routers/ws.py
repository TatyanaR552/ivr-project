import asyncio
import json
import os

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from .. import auth, models, schemas
from ..database import SessionLocal
from ..timer import update_timer
from ..chat import get_history, save_message

router = APIRouter(tags=["websocket"])

ALLOWED_ORIGINS = os.getenv(
    "WS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,https://co-study.ip-r.ru",
).split(",")


class RoomConnections:
    def __init__(self):
        self.connections = {}
        self.lock = asyncio.Lock()
        self.users = 0

    async def broadcast(self, room_id, message):
        for socket, token in list(self.connections.items()):
            try:
                error_code = await asyncio.to_thread(check_access, token, room_id)
                if error_code:
                    self.connections.pop(socket, None)
                    await socket.close(code=error_code)
                else:
                    await socket.send_json(message)
            except (WebSocketDisconnect, RuntimeError, OSError):
                self.connections.pop(socket, None)


active_rooms = {}


async def notify_room(room_id, message):
    connections = active_rooms.get(room_id)
    if connections is not None:
        async with connections.lock:
            await connections.broadcast(room_id, message)


def check_access(token, room_id):
    user_id = auth.read_user_id(token)
    if not user_id:
        return 4401
    with SessionLocal() as db:
        user = db.get(models.User, user_id)
        if user is None:
            return 4401
        room = db.get(models.Room, room_id)
        if room is None:
            return 4404
        if user not in room.members:
            return 4403
    return None


@router.websocket("/ws/rooms/{room_id}")
async def room_websocket(websocket: WebSocket, room_id: str):
    origin = websocket.headers.get("origin")
    if origin is not None and origin not in ALLOWED_ORIGINS:
        await websocket.close(code=4403)
        return

    await websocket.accept()
    connections = None
    try:
        message = await asyncio.wait_for(websocket.receive_json(), timeout=10)
        if not isinstance(message, dict) or message.get("type") != "auth":
            await websocket.close(code=4401)
            return
        token = message.get("token")
        if not isinstance(token, str):
            await websocket.close(code=4401)
            return
        error_code = await asyncio.to_thread(check_access, token, room_id)
        if error_code:
            await websocket.close(code=error_code)
            return

        connections = active_rooms.setdefault(room_id, RoomConnections())
        connections.users += 1
        async with connections.lock:
            state, _ = await asyncio.to_thread(update_timer, room_id)
            if state is None:
                await websocket.close(code=4403)
                return
            connections.connections[websocket] = token
            await websocket.send_json({"type": "ready", "room_id": room_id})
            await websocket.send_json(state)
        while True:
            message = await websocket.receive_json()
            error_code = await asyncio.to_thread(check_access, token, room_id)
            if error_code:
                await websocket.close(code=error_code)
                return
            if not isinstance(message, dict):
                await websocket.send_json({"type": "error", "code": "invalid_message"})
            elif message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                async with connections.lock:
                    state, _ = await asyncio.to_thread(update_timer, room_id)
                    if state is not None:
                        await websocket.send_json(state)
            elif message.get("type") in ("timer_start", "timer_pause", "timer_resume", "timer_reset"):
                try:
                    command = schemas.TimerCommand.model_validate(message)
                except ValidationError:
                    await websocket.send_json({"type": "error", "code": "invalid_timer_command"})
                    continue
                async with connections.lock:
                    error_code = await asyncio.to_thread(check_access, token, room_id)
                    if error_code:
                        await websocket.close(code=error_code)
                        return
                    state, error = await asyncio.to_thread(update_timer, room_id, command)
                    if state is None:
                        await websocket.close(code=4403)
                        return
                    if error:
                        await websocket.send_json({"type": "error", "code": error})
                        await websocket.send_json(state)
                    else:
                        await connections.broadcast(room_id, state)
            elif message.get("type") == "chat_history":
                async with connections.lock:
                    error_code = await asyncio.to_thread(check_access, token, room_id)
                    if error_code:
                        await websocket.close(code=error_code)
                        return
                    history = await asyncio.to_thread(get_history, room_id)
                    await websocket.send_json({"type": "chat_history", **history})
            elif message.get("type") == "chat_message":
                try:
                    command = schemas.ChatCommand.model_validate(message)
                except ValidationError:
                    await websocket.send_json({"type": "error", "code": "invalid_chat_message"})
                    continue
                async with connections.lock:
                    saved, error_code = await asyncio.to_thread(save_message, room_id, token, command)
                    if error_code:
                        await websocket.close(code=error_code)
                        return
                    await connections.broadcast(room_id, saved)
                    if websocket in connections.connections:
                        await websocket.send_json({"type": "chat_ack", "client_id": saved["client_id"]})
                    else:
                        return
            else:
                await websocket.send_json({"type": "error", "code": "unknown_type"})
    except WebSocketDisconnect:
        pass
    except asyncio.TimeoutError:
        await websocket.close(code=4401)
    except (json.JSONDecodeError, UnicodeDecodeError, KeyError):
        await websocket.close(code=4400)
    finally:
        if connections is not None:
            connections.connections.pop(websocket, None)
            connections.users -= 1
            if connections.users == 0:
                if active_rooms.get(room_id) is connections:
                    active_rooms.pop(room_id, None)
