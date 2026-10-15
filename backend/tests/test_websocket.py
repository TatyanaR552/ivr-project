import pytest
from starlette.websockets import WebSocketDisconnect

from .test_main_flow import login, register


def make_room(client):
    register(client)
    token = login(client)
    room = client.post(
        "/rooms",
        json={"name": "Комната", "is_public": False},
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    return token, room["id"]


def test_member_can_connect_and_ping(client):
    token, room_id = make_room(client)
    with client.websocket_connect(f"/ws/rooms/{room_id}") as socket:
        socket.send_json({"type": "auth", "token": token})
        assert socket.receive_json() == {"type": "ready", "room_id": room_id}
        assert socket.receive_json()["type"] == "timer_state"
        socket.send_json({"type": "ping"})
        assert socket.receive_json() == {"type": "pong"}
        assert socket.receive_json()["type"] == "timer_state"
        socket.send_json({"type": "unknown"})
        assert socket.receive_json()["code"] == "unknown_type"


@pytest.mark.parametrize("token", ["invalid", None, 123])
def test_invalid_token_is_rejected(client, token):
    _, room_id = make_room(client)
    with client.websocket_connect(f"/ws/rooms/{room_id}") as socket:
        socket.send_json({"type": "auth", "token": token})
        with pytest.raises(WebSocketDisconnect) as error:
            socket.receive_json()
        assert error.value.code == 4401


def test_nonmember_cannot_connect(client):
    _, room_id = make_room(client)
    register(client, username="second", email="second@example.com")
    token = login(client, "second")
    with client.websocket_connect(f"/ws/rooms/{room_id}") as socket:
        socket.send_json({"type": "auth", "token": token})
        with pytest.raises(WebSocketDisconnect) as error:
            socket.receive_json()
        assert error.value.code == 4403


def test_deleted_room_revokes_access(client):
    token, room_id = make_room(client)
    with client.websocket_connect(f"/ws/rooms/{room_id}") as socket:
        socket.send_json({"type": "auth", "token": token})
        socket.receive_json()
        socket.receive_json()
        client.delete(f"/rooms/{room_id}", headers={"Authorization": f"Bearer {token}"})
        socket.send_json({"type": "ping"})
        with pytest.raises(WebSocketDisconnect) as error:
            socket.receive_json()
        assert error.value.code == 4403


def test_malformed_json_closes_connection(client):
    token, room_id = make_room(client)
    with client.websocket_connect(f"/ws/rooms/{room_id}") as socket:
        socket.send_json({"type": "auth", "token": token})
        socket.receive_json()
        socket.receive_json()
        socket.send_text("not json")
        with pytest.raises(WebSocketDisconnect) as error:
            socket.receive_json()
        assert error.value.code == 4400


def test_foreign_origin_is_rejected(client):
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/rooms/test", headers={"origin": "https://other.example"}):
            pass
