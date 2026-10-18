import pytest
from jose import jwt

from app import auth


def create_user(client):
    return client.post("/auth/register", json={
        "email": "student@example.com",
        "username": "student",
        "password": "password123",
    })


@pytest.mark.parametrize("login", ["student", "student@example.com"])
def test_login_by_username_or_email(client, login):
    assert create_user(client).status_code == 200
    response = client.post("/auth/login", data={
        "username": login, "password": "password123",
    })
    assert response.status_code == 200
    profile = client.get("/auth/me", headers={
        "Authorization": f"Bearer {response.json()['access_token']}",
    })
    assert profile.status_code == 200
    assert profile.json()["username"] == "student"
    assert "hashed_password" not in profile.json()


@pytest.mark.parametrize("login", ["student", "unknown"])
def test_wrong_credentials_do_not_create_session(client, login):
    create_user(client)
    response = client.post("/auth/login", data={
        "username": login, "password": "wrong-password",
    })
    assert response.status_code == 401
    assert "access_token" not in response.json()


@pytest.mark.parametrize("changes", [
    {"email": "other@example.com"},
    {"username": "other"},
])
def test_duplicate_username_or_email(client, changes):
    create_user(client)
    response = client.post("/auth/register", json={
        "email": "student@example.com",
        "username": "student",
        "password": "password123",
        **changes,
    })
    assert response.status_code == 400


def test_expired_token_cannot_open_profile(client):
    user = create_user(client).json()
    token = jwt.encode(
        {"sub": user["id"], "exp": 0},
        auth.SECRET_KEY,
        algorithm=auth.ALGORITHM,
    )
    response = client.get("/auth/me", headers={
        "Authorization": f"Bearer {token}",
    })
    assert response.status_code == 401


def test_profile_requires_authentication(client):
    assert client.get("/auth/me").status_code == 401
