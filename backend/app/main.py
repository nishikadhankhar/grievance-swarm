from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import clock, config
from .api import approvals, auth, compare, dean, directives, grievances, settings, swarm, tickets, ws
from .auth import current_user
from .db import Base, SessionLocal, engine, get_db
from .models import Place, User
from .services import get_settings


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        clock.set_offset(get_settings(db).clock_offset_minutes)
    yield


app = FastAPI(title="Sahayak API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS,
                   allow_origin_regex=config.CORS_ORIGIN_REGEX, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

app.include_router(auth.router)
app.include_router(ws.router)  # checks its own ?token=
for module in (grievances, tickets, approvals, directives, swarm, dean, settings, compare):
    app.include_router(module.router, dependencies=[Depends(current_user)])


@app.get("/health")
async def health():
    return {"ok": True, "meko_backend": config.MEKO_BACKEND, "now": clock.now().isoformat()}


@app.get("/places")
async def places(db: Session = Depends(get_db)):
    return [{"id": p.id, "name": p.name, "type": p.type, "hostel": p.hostel} for p in db.scalars(select(Place))]


@app.get("/users", dependencies=[Depends(current_user)])
async def users(role: str | None = None, db: Session = Depends(get_db)):
    q = select(User) if not role else select(User).where(User.role == role)
    return [{"id": u.id, "role": u.role, "name": u.pseudonym, "hostel": u.hostel, "department": u.department}
            for u in db.scalars(q)]
