from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import User


def require_user(db: Session, user_id: str, roles: tuple[str, ...]) -> User:
    """Demo role check: the role switcher sends a user id, there is no real auth."""
    u = db.get(User, user_id)
    if u is None:
        raise HTTPException(404, f"Unknown user {user_id}")
    if u.role not in roles:
        raise HTTPException(403, f"{user_id} is a {u.role}; needs {' or '.join(roles)}")
    return u
