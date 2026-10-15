import datetime

import pytest

from app.database import SessionLocal
from app.models import RoomTimer
from .test_main_flow import login, register
from .test_websocket import make_room


def connect(socket, token):
    socket.send_json({"type": "auth", "token": token})
    assert socket.receive_json()["type"] == "ready"
    return socket.receive_json()


def test_timer_start_pause_resume_reset_and_reconnect(client):
    token, room_id = make_room(client)
    url = f"/ws/rooms/{room_id}"
    with client.websocket_connect(url) as socket:
        assert connect(socket, token)["status"] == "idle"
        socket.send_json({"type": "timer_start", "mode": "work"})
        started = socket.receive_json()
        assert started["status"] == "running"
        assert started["remaining_seconds"] == 1500

        with SessionLocal() as db:
            timer = db.get(RoomTimer, room_id)
            timer.started_at -= datetime.timedelta(seconds=60)
            db.commit()
        socket.send_json({"type": "timer_pause"})
        paused = socket.receive_json()
        assert paused["status"] == "paused"
        assert 1438 < paused["remaining_seconds"] <= 1440

    with client.websocket_connect(url) as socket:
        restored = connect(socket, token)
        assert restored["status"] == "paused"
        assert restored["remaining_seconds"] == paused["remaining_seconds"]
        socket.send_json({"type": "timer_resume"})
        resumed = socket.receive_json()
        assert resumed["status"] == "running"
        assert resumed["remaining_seconds"] == paused["remaining_seconds"]
        socket.send_json({"type": "timer_reset"})
        reset = socket.receive_json()
        assert reset["status"] == "idle"
        assert reset["remaining_seconds"] == 1500


def test_two_members_receive_same_timer_and_rooms_are_isolated(client):
    owner_token, room_id = make_room(client)
    headers = {"Authorization": f"Bearer {owner_token}"}
    invite_code = client.get(f"/rooms/{room_id}", headers=headers).json()["invite_code"]
    other_room = client.post("/rooms", json={"name": "Другая"}, headers=headers).json()
    register(client, username="second", email="second@example.com")
    member_token = login(client, "second")
    client.post("/rooms/join", json={"invite_code": invite_code}, headers={"Authorization": f"Bearer {member_token}"})

    with client.websocket_connect(f"/ws/rooms/{room_id}") as owner:
        connect(owner, owner_token)
        with client.websocket_connect(f"/ws/rooms/{room_id}") as member:
            connect(member, member_token)
            member.send_json({"type": "timer_start", "mode": "break"})
            assert owner.receive_json() == member.receive_json()
            with client.websocket_connect(f"/ws/rooms/{other_room['id']}") as other:
                assert connect(other, owner_token)["status"] == "idle"


@pytest.mark.parametrize("command", [
    {"type": "timer_start"},
    {"type": "timer_start", "mode": "wrong"},
    {"type": "timer_start", "mode": []},
])
def test_invalid_timer_commands_do_not_change_state(client, command):
    token, room_id = make_room(client)
    with client.websocket_connect(f"/ws/rooms/{room_id}") as socket:
        connect(socket, token)
        socket.send_json(command)
        assert socket.receive_json()["code"] == "invalid_timer_command"
        socket.send_json({"type": "ping"})
        socket.receive_json()
        assert socket.receive_json()["status"] == "idle"


def test_timer_finishes_and_does_not_start_break_automatically(client):
    token, room_id = make_room(client)
    url = f"/ws/rooms/{room_id}"
    with client.websocket_connect(url) as socket:
        connect(socket, token)
        socket.send_json({"type": "timer_start", "mode": "work"})
        socket.receive_json()
        with SessionLocal() as db:
            timer = db.get(RoomTimer, room_id)
            timer.started_at -= datetime.timedelta(seconds=1600)
            db.commit()
        socket.send_json({"type": "ping"})
        socket.receive_json()
        state = socket.receive_json()
        assert state["status"] == "finished"
        assert state["mode"] == "work"
        assert state["remaining_seconds"] == 0
    with client.websocket_connect(url) as socket:
        assert connect(socket, token)["status"] == "finished"


def test_repeated_start_does_not_restart_timer(client):
    token, room_id = make_room(client)
    with client.websocket_connect(f"/ws/rooms/{room_id}") as socket:
        connect(socket, token)
        socket.send_json({"type": "timer_start", "mode": "work"})
        socket.receive_json()
        socket.send_json({"type": "timer_start", "mode": "break"})
        assert socket.receive_json()["code"] == "timer_already_started"
        assert socket.receive_json()["mode"] == "work"


def test_room_deletion_removes_timer(client):
    token, room_id = make_room(client)
    with client.websocket_connect(f"/ws/rooms/{room_id}") as socket:
        connect(socket, token)
    response = client.delete(f"/rooms/{room_id}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    with SessionLocal() as db:
        assert db.get(RoomTimer, room_id) is None
