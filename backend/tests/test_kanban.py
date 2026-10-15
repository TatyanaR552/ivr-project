import pytest
from starlette.websockets import WebSocketDisconnect

from app.database import SessionLocal
from app.models import Task
from .test_chat import join_member
from .test_main_flow import login, register
from .test_timer import connect
from .test_websocket import make_room


def setup_board(client):
    token, room_id = make_room(client)
    headers = {"Authorization": f"Bearer {token}"}
    return token, room_id, headers, f"/rooms/{room_id}/tasks"


def test_task_creation_editing_status_and_deletion(client):
    _, room_id, headers, url = setup_board(client)
    response = client.post(url, json={"title": "  Подготовить доклад  ", "description": "  Текст  "}, headers=headers)
    assert response.status_code == 200
    task = response.json()
    assert task["title"] == "Подготовить доклад"
    assert task["description"] == "Текст"
    assert task["status"] == "todo"
    assert task["room_id"] == room_id
    assert client.get(url, headers=headers).json() == [task]
    updated = client.patch(f"{url}/{task['id']}", json={"title": "Доклад", "description": "", "status": "in_progress"}, headers=headers)
    assert updated.status_code == 200
    assert updated.json()["description"] == ""
    assert updated.json()["status"] == "in_progress"
    done = client.patch(f"{url}/{task['id']}", json={"status": "done"}, headers=headers)
    assert done.json()["status"] == "done"
    assert client.get(url, headers=headers).json() == [done.json()]
    assert client.delete(f"{url}/{task['id']}", headers=headers).status_code == 200
    assert client.get(url, headers=headers).json() == []


@pytest.mark.parametrize("payload", [
    {"title": ""}, {"title": " \n "}, {"title": "a" * 121}, {"title": 123},
    {"title": "Задача", "description": "a" * 1001},
    {"title": "Задача", "status": "wrong"},
])
def test_invalid_task_is_not_saved(client, payload):
    _, _, headers, url = setup_board(client)
    assert client.post(url, json=payload, headers=headers).status_code == 422
    assert client.get(url, headers=headers).json() == []


@pytest.mark.parametrize("payload", [{}, {"title": None}, {"title": "  "}, {"description": None}, {"status": None}, {"status": "wrong"}])
def test_invalid_update_keeps_existing_task(client, payload):
    _, _, headers, url = setup_board(client)
    task = client.post(url, json={"title": "Задача"}, headers=headers).json()
    assert client.patch(f"{url}/{task['id']}", json=payload, headers=headers).status_code == 422
    assert client.get(url, headers=headers).json() == [task]


def test_nonmember_cannot_read_or_change_tasks(client):
    _, _, headers, url = setup_board(client)
    task = client.post(url, json={"title": "Задача"}, headers=headers).json()
    register(client, username="second", email="second@example.com")
    outsider = {"Authorization": f"Bearer {login(client, 'second')}"}
    assert client.get(url, headers=outsider).status_code == 403
    assert client.post(url, json={"title": "Новая"}, headers=outsider).status_code == 403
    assert client.patch(f"{url}/{task['id']}", json={"status": "done"}, headers=outsider).status_code == 403
    assert client.delete(f"{url}/{task['id']}", headers=outsider).status_code == 403
    assert client.get(url).status_code == 401
    assert client.get(url, headers=headers).json() == [task]


def test_task_from_another_room_cannot_be_modified(client):
    _, _, headers, url = setup_board(client)
    task = client.post(url, json={"title": "Задача"}, headers=headers).json()
    other = client.post("/rooms", json={"name": "Другая"}, headers=headers).json()
    other_url = f"/rooms/{other['id']}/tasks"
    assert client.get(other_url, headers=headers).json() == []
    assert client.patch(f"{other_url}/{task['id']}", json={"status": "done"}, headers=headers).status_code == 404
    assert client.delete(f"{other_url}/{task['id']}", headers=headers).status_code == 404
    assert client.get(url, headers=headers).json() == [task]


def test_members_receive_task_events_and_can_edit_tasks(client):
    token, room_id, headers, url = setup_board(client)
    member_token = join_member(client, token, room_id)
    member_headers = {"Authorization": f"Bearer {member_token}"}
    with client.websocket_connect(f"/ws/rooms/{room_id}") as owner:
        connect(owner, token)
        with client.websocket_connect(f"/ws/rooms/{room_id}") as member:
            connect(member, member_token)
            task = client.post(url, json={"title": "Задача"}, headers=headers).json()
            event = {"type": "task_changed", "task_id": task["id"]}
            assert owner.receive_json() == member.receive_json() == event
            response = client.patch(f"{url}/{task['id']}", json={"status": "done"}, headers=member_headers)
            assert response.status_code == 200
            assert owner.receive_json() == member.receive_json() == event
            assert client.get(url, headers=member_headers).json()[0]["status"] == "done"
            assert client.delete(f"{url}/{task['id']}", headers=member_headers).status_code == 200
            assert owner.receive_json() == member.receive_json() == event


def test_member_who_left_cannot_receive_task_events(client):
    token, room_id, headers, url = setup_board(client)
    member_token = join_member(client, token, room_id)
    with client.websocket_connect(f"/ws/rooms/{room_id}") as member:
        connect(member, member_token)
        client.post(f"/rooms/{room_id}/leave", headers={"Authorization": f"Bearer {member_token}"})
        assert client.post(url, json={"title": "Задача"}, headers=headers).status_code == 200
        with pytest.raises(WebSocketDisconnect) as error:
            member.receive_json()
        assert error.value.code == 4403


def test_deleting_room_removes_tasks(client):
    _, room_id, headers, url = setup_board(client)
    client.post(url, json={"title": "Задача"}, headers=headers)
    assert client.delete(f"/rooms/{room_id}", headers=headers).status_code == 200
    with SessionLocal() as db:
        assert db.query(Task).filter_by(room_id=room_id).count() == 0
