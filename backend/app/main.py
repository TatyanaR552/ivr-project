from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import auth_router, rooms

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Co-Study API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(rooms.router)


@app.get("/")
def health_check():
    return {"status": "ok", "service": "Co-Study API"}
