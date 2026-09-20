from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=30, pattern=r"^[A-Za-zА-Яа-я0-9_-]+$")
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

