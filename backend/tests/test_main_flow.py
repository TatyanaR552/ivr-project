def register(client, username="student", email="student@example.com"):
    return client.post(
        "/auth/register",
        json={
            "email": email,
            "username": username,
            "password": "password123",
        },
    )


def login(client, username="student"):
    response = client.post(
        "/auth/login",
        data={"username": username, "password": "password123"},
    )
    return response.json()["access_token"]


def test_registration_login_profile_and_room_creation(client):
    assert register(client).status_code == 200
    token = login(client)
    headers = {"Authorization": f"Bearer {token}"}

    profile = client.get("/auth/me", headers=headers)
    assert profile.status_code == 200
    assert profile.json()["username"] == "student"

    room = client.post(
        "/rooms",
        json={"name": "Подготовка", "is_public": False},
        headers=headers,
    )
    assert room.status_code == 200
    assert len(room.json()["invite_code"]) == 8


def test_second_user_can_join_room_by_code(client):
    register(client)
    first_headers = {"Authorization": f"Bearer {login(client)}"}
    room = client.post(
        "/rooms",
        json={"name": "Комната", "is_public": False},
        headers=first_headers,
    ).json()

    register(client, username="second", email="second@example.com")
    second_headers = {"Authorization": f"Bearer {login(client, 'second')}"}
    joined = client.post(
        "/rooms/join",
        json={"invite_code": room["invite_code"]},
        headers=second_headers,
    )
    assert joined.status_code == 200
    assert joined.json()["id"] == room["id"]

