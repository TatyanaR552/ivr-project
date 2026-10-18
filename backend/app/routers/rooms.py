from typing import List
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import auth, models, schemas
from ..database import get_db
from ..chat import get_history
from .ws import notify_room

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.get("", response_model=List[schemas.RoomOut])
def get_my_rooms(
    current_user: models.User = Depends(auth.get_current_user),
):
    return current_user.rooms


@router.get("/public", response_model=List[schemas.RoomOut])
def get_public_rooms(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    rooms = db.query(models.Room).filter(models.Room.is_public.is_(True)).all()
    return [room for room in rooms if current_user not in room.members]


@router.post("", response_model=schemas.RoomOut)
def create_room(
    payload: schemas.RoomCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    room = models.Room(
        name=payload.name,
        is_public=payload.is_public,
        owner_id=current_user.id,
    )
    room.members.append(current_user)
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


@router.post("/join", response_model=schemas.RoomOut)
def join_room(
    payload: schemas.RoomJoin,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    room = db.query(models.Room).filter(
        models.Room.invite_code == payload.invite_code
    ).first()
    if room is None:
        raise HTTPException(status_code=404, detail="Комната с таким кодом не найдена")

    if current_user not in room.members:
        room.members.append(current_user)
        db.commit()
        db.refresh(room)
        background_tasks.add_task(notify_room, room.id, {"type": "members_changed"})
    return room


@router.post("/{room_id}/leave")
def leave_room(
    room_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if room is None:
        raise HTTPException(status_code=404, detail="Комната не найдена")
    if current_user not in room.members:
        raise HTTPException(status_code=403, detail="Вы не участник этой комнаты")
    if room.owner_id == current_user.id:
        raise HTTPException(status_code=403, detail="Владелец не может выйти из комнаты. Её можно удалить")

    room.members.remove(current_user)
    db.commit()
    background_tasks.add_task(notify_room, room_id, {"type": "members_changed"})
    return {"ok": True}


@router.delete("/{room_id}")
def delete_room(
    room_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if room is None:
        raise HTTPException(status_code=404, detail="Комната не найдена")
    if room.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Удалить комнату может только владелец")

    room.members.clear()
    db.delete(room)
    db.commit()
    background_tasks.add_task(notify_room, room_id, {"type": "room_deleted"})
    return {"ok": True}


@router.get("/{room_id}/members", response_model=list[schemas.RoomMemberOut])
def get_members(
    room_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    room = db.get(models.Room, room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Комната не найдена")
    if current_user not in room.members:
        raise HTTPException(status_code=403, detail="Вы не участник этой комнаты")
    members = sorted(room.members, key=lambda user: (user.id != room.owner_id, user.username.casefold()))
    return [
        {"id": user.id, "username": user.username, "is_owner": user.id == room.owner_id}
        for user in members
    ]


@router.get("/{room_id}/messages", response_model=schemas.ChatHistoryOut)
def get_messages(
    room_id: str,
    before: UUID | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    room = db.get(models.Room, room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Комната не найдена")
    if current_user not in room.members:
        raise HTTPException(status_code=403, detail="Вы не участник этой комнаты")
    history = get_history(room_id, str(before) if before is not None else None)
    if history is None:
        raise HTTPException(status_code=400, detail="Не удалось найти сообщение для загрузки истории")
    return history


@router.get("/{room_id}", response_model=schemas.RoomOut)
def get_room(
    room_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    room = db.query(models.Room).filter(models.Room.id == room_id).first()
    if room is None:
        raise HTTPException(status_code=404, detail="Комната не найдена")
    if current_user not in room.members:
        raise HTTPException(status_code=403, detail="Вы не участник этой комнаты")
    return room

