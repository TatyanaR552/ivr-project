from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import auth, models, schemas
from ..database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=schemas.UserOut)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(
        (models.User.email == payload.email)
        | (models.User.username == payload.username)
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Такой email или username уже заняты",
        )

    user = models.User(
        email=payload.email,
        username=payload.username,
        hashed_password=auth.hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=schemas.Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(
        (models.User.email == form_data.username)
        | (models.User.username == form_data.username)
    ).first()

    if user is None or not auth.verify_password(
        form_data.password,
        user.hashed_password,
    ):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")

    return schemas.Token(access_token=auth.create_access_token(user.id))


@router.get("/me", response_model=schemas.UserOut)
def get_profile(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

