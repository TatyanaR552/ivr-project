from .test_main_flow import login, register
from .test_timer import connect
from .test_websocket import make_room


def test_members_list_shows_owner_and_hides_private_fields(client):
    token, room_id = make_room(client)
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get(f"/rooms/{room_id}/members", headers=headers)
    assert response.status_code == 200
    members = response.json()
    assert len(members) == 1
    assert members[0]["username"] == "student"
    assert members[0]["is_owner"] is True
    assert set(members[0]) == {"id", "username", "is_owner"}


def test_join_and_leave_update_members_and_notify_owner(client):
    token, room_id = make_room(client)
    headers = {"Authorization": f"Bearer {token}"}
    code = client.get(f"/rooms/{room_id}", headers=headers).json()["invite_code"]
    register(client, username="second", email="second@example.com")
    member_headers = {"Authorization": f"Bearer {login(client, 'second')}"}
    with client.websocket_connect(f"/ws/rooms/{room_id}") as socket:
        connect(socket, token)
        joined = client.post("/rooms/join", json={"invite_code": code}, headers=member_headers)
        assert joined.status_code == 200
        assert socket.receive_json() == {"type": "members_changed"}
        members = client.get(f"/rooms/{room_id}/members", headers=member_headers).json()
        assert [member["username"] for member in members] == ["student", "second"]
        assert members[1]["is_owner"] is False
        client.post("/rooms/join", json={"invite_code": code}, headers=member_headers)
        assert len(client.get(f"/rooms/{room_id}/members", headers=headers).json()) == 2
        assert client.post(f"/rooms/{room_id}/leave", headers=member_headers).status_code == 200
        assert socket.receive_json() == {"type": "members_changed"}
        assert len(client.get(f"/rooms/{room_id}/members", headers=headers).json()) == 1
        assert client.get(f"/rooms/{room_id}/members", headers=member_headers).status_code == 403


def test_nonmember_cannot_read_private_or_public_room_members(client):
    token, room_id = make_room(client)
    owner_headers = {"Authorization": f"Bearer {token}"}
    public_room = client.post("/rooms", json={"name": "Публичная", "is_public": True}, headers=owner_headers).json()
    register(client, username="second", email="second@example.com")
    outsider = {"Authorization": f"Bearer {login(client, 'second')}"}
    for target_id in (room_id, public_room["id"]):
        assert client.get(f"/rooms/{target_id}/members", headers=outsider).status_code == 403
        assert client.get(f"/rooms/{target_id}/members").status_code == 401
    assert client.get("/rooms/missing/members", headers=owner_headers).status_code == 404
