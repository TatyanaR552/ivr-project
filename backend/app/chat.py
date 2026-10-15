from sqlalchemy.orm import joinedload

from . import auth, models
from .database import SessionLocal


def message_data(message):
    return {
        "type": "chat_message",
        "id": message.id,
        "client_id": message.client_id,
        "author_id": message.author_id,
        "author_username": message.author.username,
        "text": message.text,
        "created_at": message.created_at.isoformat() + "Z",
    }


def get_history(room_id):
    with SessionLocal() as db:
        messages = (
            db.query(models.Message)
            .options(joinedload(models.Message.author))
            .filter(models.Message.room_id == room_id)
            .order_by(models.Message.created_at.desc(), models.Message.id.desc())
            .limit(100)
            .all()
        )
        return [message_data(message) for message in reversed(messages)]


def save_message(room_id, token, command):
    user_id = auth.read_user_id(token)
    with SessionLocal() as db:
        user = db.get(models.User, user_id) if user_id else None
        if user is None:
            return None, 4401
        room = db.get(models.Room, room_id)
        if room is None or user not in room.members:
            return None, 4403
        client_id = str(command.client_id)
        existing = db.query(models.Message).filter_by(
            room_id=room_id, author_id=user.id, client_id=client_id,
        ).first()
        if existing is not None:
            return message_data(existing), None
        message = models.Message(
            room_id=room_id, author_id=user.id, client_id=client_id, text=command.text,
        )
        db.add(message)
        db.commit()
        db.refresh(message)
        return message_data(message), None
