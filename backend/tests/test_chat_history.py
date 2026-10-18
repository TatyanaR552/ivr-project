import datetime
import uuid

from app.database import SessionLocal
from app.models import Message, User
from .test_main_flow import login, register
from .test_timer import connect
from .test_websocket import make_room


def seed_messages(room_id, count):
    with SessionLocal() as db:
        user = db.query(User).filter_by(username="student").one()
        for index in range(count):
            db.add(Message(
                id=str(uuid.UUID(int=index + 1)), room_id=room_id, author_id=user.id,
                client_id=str(uuid.uuid4()), text=str(index), created_at=datetime.datetime(2026, 1, 1),
            ))
        db.commit()


def test_all_history_can_be_loaded_without_duplicates_with_equal_timestamps(client):
    token, room_id = make_room(client)
    seed_messages(room_id, 230)
    headers = {"Authorization": f"Bearer {token}"}
    url = f"/rooms/{room_id}/messages"
    with client.websocket_connect(f"/ws/rooms/{room_id}") as socket:
        connect(socket, token)
        socket.send_json({"type": "chat_history"})
        first = socket.receive_json()
    assert first["has_more"] is True
    assert [message["text"] for message in first["messages"]] == [str(index) for index in range(130, 230)]
    second = client.get(url, params={"before": first["messages"][0]["id"]}, headers=headers).json()
    assert second["has_more"] is True
    third = client.get(url, params={"before": second["messages"][0]["id"]}, headers=headers).json()
    assert third["has_more"] is False
    all_messages = third["messages"] + second["messages"] + first["messages"]
    assert [message["text"] for message in all_messages] == [str(index) for index in range(230)]
    assert len({message["id"] for message in all_messages}) == 230
    assert set(all_messages[0]) == {"type", "id", "client_id", "author_id", "author_username", "text", "created_at"}


def test_new_message_does_not_shift_older_pages(client):
    token, room_id = make_room(client)
    seed_messages(room_id, 205)
    headers = {"Authorization": f"Bearer {token}"}
    url = f"/rooms/{room_id}/messages"
    first = client.get(url, headers=headers).json()
    with SessionLocal() as db:
        user = db.query(User).filter_by(username="student").one()
        db.add(Message(room_id=room_id, author_id=user.id, client_id=str(uuid.uuid4()), text="Новое"))
        db.commit()
    second = client.get(url, params={"before": first["messages"][0]["id"]}, headers=headers).json()
    assert [message["text"] for message in second["messages"]] == [str(index) for index in range(5, 105)]


def test_history_is_private_and_cursor_must_belong_to_room(client):
    token, room_id = make_room(client)
    seed_messages(room_id, 1)
    headers = {"Authorization": f"Bearer {token}"}
    other = client.post("/rooms", json={"name": "Другая"}, headers=headers).json()
    first_id = str(uuid.UUID(int=1))
    assert client.get(f"/rooms/{other['id']}/messages", params={"before": first_id}, headers=headers).status_code == 400
    url = f"/rooms/{room_id}/messages"
    register(client, username="second", email="second@example.com")
    outsider = {"Authorization": f"Bearer {login(client, 'second')}"}
    assert client.get(url, headers=outsider).status_code == 403
    assert client.get(url).status_code == 401
    assert client.get(url, params={"before": "bad"}, headers=headers).status_code == 422
    assert client.get(url, params={"before": str(uuid.uuid4())}, headers=headers).status_code == 400


def test_empty_chat_and_beginning_of_history(client):
    token, room_id = make_room(client)
    headers = {"Authorization": f"Bearer {token}"}
    url = f"/rooms/{room_id}/messages"
    assert client.get(url, headers=headers).json() == {"messages": [], "has_more": False}
    seed_messages(room_id, 1)
    first = client.get(url, headers=headers).json()
    assert first["has_more"] is False
    before_first = client.get(url, params={"before": first["messages"][0]["id"]}, headers=headers)
    assert before_first.json() == {"messages": [], "has_more": False}
