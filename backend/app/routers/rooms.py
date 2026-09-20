from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import auth, models, schemas
from ..database import get_db

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
    return room


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

