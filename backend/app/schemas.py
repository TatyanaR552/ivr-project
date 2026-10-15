from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


class ChatCommand(BaseModel):
    type: Literal["chat_message"]
    text: str = Field(strict=True, min_length=1, max_length=2000)
    client_id: UUID

    @field_validator("text", mode="before")
    @classmethod
    def trim_text(cls, value):
        return value.strip() if isinstance(value, str) else value


class TimerCommand(BaseModel):
    type: Literal["timer_start", "timer_pause", "timer_resume", "timer_reset"]
    mode: Literal["work", "break"] | None = None

    @model_validator(mode="after")
    def require_start_mode(self):
        if self.type == "timer_start" and self.mode is None:
            raise ValueError("Не указан режим таймера")
        return self


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=30, pattern=r"^[A-Za-zА-Яа-яЁё0-9_-]+$")
    password: str = Field(min_length=8, max_length=72)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    username: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RoomCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    is_public: bool = False


class RoomJoin(BaseModel):
    invite_code: str = Field(min_length=8, max_length=8)


class RoomOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    invite_code: str
    is_public: bool
    owner_id: str


class TaskCreate(BaseModel):
    title: str = Field(strict=True, min_length=1, max_length=120)
    description: str = Field(default="", strict=True, max_length=1000)
    status: Literal["todo", "in_progress", "done"] = "todo"

    @field_validator("title", "description", mode="before")
    @classmethod
    def trim_text(cls, value):
        return value.strip() if isinstance(value, str) else value


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, strict=True, min_length=1, max_length=120)
    description: str | None = Field(default=None, strict=True, max_length=1000)
    status: Literal["todo", "in_progress", "done"] | None = None

    @field_validator("title", "description", mode="before")
    @classmethod
    def trim_text(cls, value):
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def check_changes(self):
        changes = self.model_dump(exclude_unset=True)
        if not changes or any(value is None for value in changes.values()):
            raise ValueError("Укажите новые значения полей задачи")
        return self


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    room_id: str
    title: str
    description: str
    status: Literal["todo", "in_progress", "done"]

