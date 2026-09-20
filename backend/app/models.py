import datetime
import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Table
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

