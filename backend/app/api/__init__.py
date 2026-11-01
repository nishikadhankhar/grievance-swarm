from fastapi import HTTPException

from ..models import User


def require_role(user: User, roles: tuple[str, ...]) -> User:
    if user.role not in roles:
        raise HTTPException(403, f"This needs a {' or '.join(roles)} account; you're signed in as a {user.role}")
    return user
