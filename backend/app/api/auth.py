import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import config
from ..auth import bearer, current_user, end_session, hash_password, start_session, verify_password
from ..db import get_db
from ..models import Place, User

router = APIRouter(prefix="/auth", tags=["auth"])

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_ID_PREFIX = {"technician": "TECH", "warden": "WARDEN", "dean": "DEAN"}


class SignUpIn(BaseModel):
    kind: Literal["student", "staff"]
    email: str = Field(max_length=254)
    password: str = Field(min_length=8, max_length=128)
    hostel: str | None = None  # students
    name: str | None = Field(default=None, max_length=48)  # staff: shown to students and on the board
    role: Literal["technician", "warden", "dean"] | None = None  # staff
    department: Literal["electricity", "wifi", "water"] | None = None  # technicians
    staff_code: str | None = None

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL.match(v):
            raise ValueError("Enter a valid email address")
        return v


class SignInIn(BaseModel):
    email: str
    password: str


def me_json(u: User) -> dict:
    return {"id": u.id, "role": u.role, "name": u.pseudonym, "email": u.email, "hostel": u.hostel,
            "department": u.department}


def _next_id(db: Session, prefix: str, start: int) -> str:
    """S-1201, TECH-2, ... : the next free number after the highest one in use."""
    nums = [int(i.rsplit("-", 1)[1]) for i in db.scalars(select(User.id).where(User.id.like(f"{prefix}-%")))
            if i.rsplit("-", 1)[1].isdigit()]
    return f"{prefix}-{max([start - 1, *nums]) + 1}"


@router.post("/signup", status_code=201)
async def signup(body: SignUpIn, db: Session = Depends(get_db)):
    if db.scalar(select(func.count()).select_from(User).where(User.email == body.email)):
        raise HTTPException(409, "An account with this email already exists. Sign in instead.")
    if body.kind == "student":
        hostel = db.get(Place, body.hostel or "")
        if hostel is None or hostel.type != "hostel":
            raise HTTPException(422, "Pick your hostel")
        # Students only ever appear as a pseudonym; the email is used to sign in and nothing else.
        uid = _next_id(db, "S", 1201)
        user = User(id=uid, role="student", pseudonym=uid, hostel=hostel.id)
    else:
        if body.staff_code != config.STAFF_SIGNUP_CODE:
            raise HTTPException(403, "That staff code isn't right. Ask the warden's office for it.")
        if body.role is None or not (body.name or "").strip():
            raise HTTPException(422, "Staff accounts need a name and a role")
        if body.role == "technician" and body.department is None:
            raise HTTPException(422, "Technicians need a department")
        uid = _next_id(db, _ID_PREFIX[body.role], 2)
        user = User(id=uid, role=body.role, pseudonym=body.name.strip(),
                    department=body.department if body.role == "technician" else None)
    user.email, user.password_hash = body.email, hash_password(body.password)
    db.add(user)
    db.commit()
    return {"token": start_session(db, user), "user": me_json(user)}


@router.post("/signin")
async def signin(body: SignInIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Wrong email or password")
    return {"token": start_session(db, user), "user": me_json(user)}


@router.post("/signout")
async def signout(token: str | None = Depends(bearer), db: Session = Depends(get_db)):
    if token:
        end_session(db, token)
    return {"ok": True}


@router.get("/me")
async def me(user: User = Depends(current_user)):
    return me_json(user)


@router.get("/demo-accounts")
async def demo_accounts(db: Session = Depends(get_db)):
    """Seeded accounts for the sign-in page's one-click buttons. Off when DEMO_ACCOUNTS=false."""
    if not config.DEMO_ACCOUNTS:
        return {"password": None, "accounts": []}
    order = {"student": 0, "technician": 1, "warden": 2, "dean": 3}
    users = db.scalars(select(User).where(User.email.like("%@demo.campus"))).all()
    users = sorted(users, key=lambda u: (order.get(u.role, 9), u.id))
    return {"password": config.DEMO_PASSWORD, "accounts": [me_json(u) for u in users]}
