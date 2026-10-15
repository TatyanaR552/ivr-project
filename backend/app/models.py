import datetime
import uuid

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, String, Table, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from .database import Base


def make_id() -> str:
    return str(uuid.uuid4())


room_members = Table(
    "room_members",
    Base.metadata,
    Column("user_id", String, ForeignKey("users.id"), primary_key=True),
    Column("room_id", String, ForeignKey("rooms.id"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=make_id)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    rooms = relationship("Room", secondary=room_members, back_populates="members")
    owned_rooms = relationship("Room", back_populates="owner")


class Room(Base):
    __tablename__ = "rooms"

    id = Column(String, primary_key=True, default=make_id)
    name = Column(String, nullable=False)
    invite_code = Column(
        String,
        unique=True,
        index=True,
        default=lambda: uuid.uuid4().hex[:8],
    )
    is_public = Column(Boolean, default=False)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    owner = relationship("User", back_populates="owned_rooms")
    members = relationship("User", secondary=room_members, back_populates="rooms")
    timer = relationship("RoomTimer", back_populates="room", uselist=False, cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="room", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="room", cascade="all, delete-orphan")


class RoomTimer(Base):
    __tablename__ = "room_timers"

    room_id = Column(String, ForeignKey("rooms.id"), primary_key=True)
    mode = Column(String, nullable=False, default="work")
    status = Column(String, nullable=False, default="idle")
    remaining_seconds = Column(Float, nullable=False, default=25 * 60)
    started_at = Column(DateTime, nullable=True)

    room = relationship("Room", back_populates="timer")


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (UniqueConstraint("room_id", "author_id", "client_id"),)

    id = Column(String, primary_key=True, default=make_id)
    room_id = Column(String, ForeignKey("rooms.id"), nullable=False, index=True)
    author_id = Column(String, ForeignKey("users.id"), nullable=False)
    client_id = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    room = relationship("Room", back_populates="messages")
    author = relationship("User")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=make_id)
    room_id = Column(String, ForeignKey("rooms.id"), nullable=False, index=True)
    title = Column(String(120), nullable=False)
    description = Column(Text, nullable=False, default="")
    status = Column(String, nullable=False, default="todo")
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    room = relationship("Room", back_populates="tasks")

