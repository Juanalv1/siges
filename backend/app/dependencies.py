from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.usuario import RolEnum, Usuario
from app.utils.security import decode_token

bearer_scheme = HTTPBearer()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Usuario:
    token = credentials.credentials
    try:
        payload = decode_token(token)
        user_id: int = payload.get("sub")
        scope: str = payload.get("scope", "access")
        if user_id is None or scope != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not user or not user.active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


def require_roles(*roles: RolEnum):
    def checker(current_user: Usuario = Depends(get_current_user)) -> Usuario:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user
    return checker
