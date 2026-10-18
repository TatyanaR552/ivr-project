import datetime
import uuid

import pytest
from starlette.websockets import WebSocketDisconnect

from app.database import SessionLocal
from app.models import Message, User
from .test_main_flow import login, register
from .test_timer import connect
from .test_websocket import make_room


def chat_command(text="Привет"):
    return {"type": "chat_message", "text": text, "client_id": str(uuid.uuid4())}


def join_member(client, owner_token, room_id):
    register(client, username="second", email="second@example.com")
    member_token = login(client, "second")
    room = client.get(f"/rooms/{room_id}", headers={"Authorization": f"Bearer {owner_token}"}).json()
    client.post("/rooms/join", json={"invite_code": room["invite_code"]}, headers={"Authorization": f"Bearer {member_token}"})
    return member_token


def test_chat_broadcast_and_timer_share_one_connection(client):
    token, room_id = make_room(client)
    member_token = join_member(client, token, room_id)
    url = f"/ws/rooms/{room_id}"
    with client.websocket_connect(url) as owner:
        connect(owner, token)
        with client.websocket_connect(url) as member:
            connect(member, member_token)
            command = chat_command("  Привет\nвсем  ")
            command["author_username"] = "someone_else"
            member.send_json(command)
            saved = member.receive_json()
            assert owner.receive_json() == saved
            assert saved["text"] == "Привет\nвсем"
            assert saved["author_username"] == "second"
            assert saved["created_at"].endswith("Z")
            assert member.receive_json() == {"type": "chat_ack", "client_id": command["client_id"]}
            owner.send_json({"type": "timer_start", "mode": "work"})
            assert owner.receive_json() == member.receive_json()


def test_chat_history_survives_reconnect_and_does_not_cross_rooms(client):
    token, room_id = make_room(client)
    with client.websocket_connect(f"/ws/rooms/{room_id}") as socket:
        connect(socket, token)
        socket.send_json(chat_command())
        saved = socket.receive_json()
        socket.receive_json()
    with client.websocket_connect(f"/ws/rooms/{room_id}") as socket:
        connect(socket, token)
        socket.send_json({"type": "chat_history"})
        assert socket.receive_json() == {"type": "chat_history", "messages": [saved], "has_more": False}
    other = client.post("/rooms", json={"name": "Другая"}, headers={"Authorization": f"Bearer {token}"}).json()
    with client.websocket_connect(f"/ws/rooms/{other['id']}") as socket:
        connect(socket, token)
        socket.send_json({"type": "chat_history"})
        assert socket.receive_json()["messages"] == []


@pytest.mark.parametrize("text", ["", " \n\t ", "a" * 2001, None, 123, ["hello"]])
def test_invalid_message_is_not_saved_and_connection_stays_open(client, text):
    token, room_id = make_room(client)
    with client.websocket_connect(f"/ws/rooms/{room_id}") as socket:
        connect(socket, token)
        socket.send_json(chat_command(text))
        assert socket.receive_json()["code"] == "invalid_chat_message"
        socket.send_json({"type": "chat_history"})
        assert socket.receive_json()["messages"] == []


def test_same_request_is_not_saved_twice(client):
    token, room_id = make_room(client)
    command = chat_command()
    url = f"/ws/rooms/{room_id}"
    with client.websocket_connect(url) as socket:
        connect(socket, token)
        socket.send_json(command)
        saved = socket.receive_json()
        socket.receive_json()
    with client.websocket_connect(url) as socket:
        connect(socket, token)
        socket.send_json(command)
        assert socket.receive_json() == saved
        assert socket.receive_json()["type"] == "chat_ack"
    with SessionLocal() as db:
        assert db.query(Message).count() == 1


def test_member_who_left_cannot_receive_new_messages(client):
    token, room_id = make_room(client)
    member_token = join_member(client, token, room_id)
    url = f"/ws/rooms/{room_id}"
    with client.websocket_connect(url) as owner:
        connect(owner, token)
        with client.websocket_connect(url) as member:
            connect(member, member_token)
            client.post(f"/rooms/{room_id}/leave", headers={"Authorization": f"Bearer {member_token}"})
            assert owner.receive_json() == {"type": "members_changed"}
            owner.send_json(chat_command())
            assert owner.receive_json()["type"] == "chat_message"
            owner.receive_json()
            with pytest.raises(WebSocketDisconnect) as error:
                member.receive_json()
            assert error.value.code == 4403


def test_history_returns_latest_100_messages_in_chronological_order(client):
    token, room_id = make_room(client)
    with SessionLocal() as db:
        user = db.query(User).filter_by(username="student").one()
        for index in range(105):
            db.add(Message(
                room_id=room_id, author_id=user.id, client_id=str(uuid.uuid4()), text=str(index),
                created_at=datetime.datetime(2026, 1, 1) + datetime.timedelta(seconds=index),
            ))
        db.commit()
    with client.websocket_connect(f"/ws/rooms/{room_id}") as socket:
        connect(socket, token)
        socket.send_json({"type": "chat_history"})
        messages = socket.receive_json()["messages"]
        assert [message["text"] for message in messages] == [str(index) for index in range(5, 105)]


def test_deleting_room_deletes_its_messages(client):
    token, room_id = make_room(client)
    with client.websocket_connect(f"/ws/rooms/{room_id}") as socket:
        connect(socket, token)
        socket.send_json(chat_command())
        socket.receive_json()
        socket.receive_json()
    assert client.delete(f"/rooms/{room_id}", headers={"Authorization": f"Bearer {token}"}).status_code == 200
    with SessionLocal() as db:
        assert db.query(Message).filter_by(room_id=room_id).count() == 0
