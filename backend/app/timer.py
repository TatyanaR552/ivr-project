import datetime

from . import models
from .database import SessionLocal

DURATIONS = {"work": 25 * 60, "break": 5 * 60}


def update_timer(room_id, command=None):
    with SessionLocal() as db:
        if db.get(models.Room, room_id) is None:
            return None, "room_not_found"
        timer = db.get(models.RoomTimer, room_id)
        if timer is None:
            timer = models.RoomTimer(
                room_id=room_id, mode="work", status="idle", remaining_seconds=DURATIONS["work"],
            )
            db.add(timer)

        now = datetime.datetime.utcnow()
        remaining = timer.remaining_seconds
        if timer.status == "running":
            elapsed = max(0, (now - timer.started_at).total_seconds())
            remaining = max(0, remaining - elapsed)
            if remaining == 0:
                timer.status = "finished"
                timer.remaining_seconds = 0
                timer.started_at = None

        error = None
        if command is not None:
            action = command.type
            if action == "timer_start":
                if timer.status in ("running", "paused"):
                    error = "timer_already_started"
                else:
                    timer.mode = command.mode
                    timer.status = "running"
                    timer.remaining_seconds = DURATIONS[command.mode]
                    timer.started_at = now
                    remaining = timer.remaining_seconds
            elif action == "timer_pause":
                if timer.status != "running":
                    error = "timer_not_running"
                else:
                    timer.status = "paused"
                    timer.remaining_seconds = remaining
                    timer.started_at = None
            elif action == "timer_resume":
                if timer.status != "paused":
                    error = "timer_not_paused"
                else:
                    timer.status = "running"
                    timer.started_at = now
            elif action == "timer_reset":
                timer.status = "idle"
                timer.remaining_seconds = DURATIONS[timer.mode]
                timer.started_at = None
                remaining = timer.remaining_seconds

        db.commit()
        return {
            "type": "timer_state",
            "mode": timer.mode,
            "status": timer.status,
            "remaining_seconds": remaining,
            "duration_seconds": DURATIONS[timer.mode],
        }, error
