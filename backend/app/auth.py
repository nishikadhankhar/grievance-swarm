"""Accounts and sessions: salted PBKDF2 passwords, random bearer tokens (only their hashes are stored)."""

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .db import get_db
from .models import AuthSession, User

_ITERATIONS = 200_000
SESSION_DAYS = 7


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)  # stored naive, like every other timestamp here


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), _ITERATIONS).hex()
    return f"pbkdf2_sha256${_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored: str | None) -> bool:
    try:
        _, iterations, salt, digest = (stored or "").split("$")
    except ValueError:
        return False
    check = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iterations)).hex()
    return hmac.compare_digest(check, digest)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def start_session(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(32)
    db.add(AuthSession(token_hash=_token_hash(token), user_id=user.id, created_at=_utcnow()))
    db.commit()
    return token


def end_session(db: Session, token: str) -> None:
    s = db.get(AuthSession, _token_hash(token))
    if s:
        db.delete(s)
        db.commit()


def user_for_token(db: Session, token: str | None) -> User | None:
    if not token:
        return None
    s = db.get(AuthSession, _token_hash(token))
    if s is None or s.created_at < _utcnow() - timedelta(days=SESSION_DAYS):
        return None
    return db.get(User, s.user_id)


def bearer(authorization: str | None = Header(default=None)) -> str | None:
    if authorization and authorization.startswith("Bearer "):
        return authorization[7:]
    return None


def current_user(token: str | None = Depends(bearer), db: Session = Depends(get_db)) -> User:
    user = user_for_token(db, token)
    if user is None:
        raise HTTPException(401, "Sign in first", headers={"WWW-Authenticate": "Bearer"})
    return user
