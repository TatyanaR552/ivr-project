from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import auth, models, schemas
from ..database import get_db
from .ws import notify_room

router = APIRouter(prefix="/rooms/{room_id}/tasks", tags=["tasks"])


def check_room(db, room_id, user):
    room = db.get(models.Room, room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Комната не найдена")
    if user not in room.members:
        raise HTTPException(status_code=403, detail="Вы не участник этой комнаты")


def find_task(db, room_id, task_id):
    task = db.query(models.Task).filter_by(id=task_id, room_id=room_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    return task


@router.get("", response_model=list[schemas.TaskOut])
def list_tasks(
    room_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    check_room(db, room_id, current_user)
    return db.query(models.Task).filter_by(room_id=room_id).order_by(models.Task.created_at, models.Task.id).all()


@router.post("", response_model=schemas.TaskOut)
def create_task(
    room_id: str,
    payload: schemas.TaskCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    check_room(db, room_id, current_user)
    task = models.Task(room_id=room_id, **payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    background_tasks.add_task(notify_room, room_id, {"type": "task_changed", "task_id": task.id})
    return task


@router.patch("/{task_id}", response_model=schemas.TaskOut)
def update_task(
    room_id: str,
    task_id: str,
    payload: schemas.TaskUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    check_room(db, room_id, current_user)
    task = find_task(db, room_id, task_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    background_tasks.add_task(notify_room, room_id, {"type": "task_changed", "task_id": task.id})
    return task


@router.delete("/{task_id}")
def delete_task(
    room_id: str,
    task_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    check_room(db, room_id, current_user)
    task = find_task(db, room_id, task_id)
    db.delete(task)
    db.commit()
    background_tasks.add_task(notify_room, room_id, {"type": "task_changed", "task_id": task_id})
    return {"ok": True}
