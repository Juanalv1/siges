from sqlalchemy.orm import Session

from app.models.notificacion import Notificacion


def create_notification(db: Session, user_id: int, request_id: int, message: str) -> Notificacion:
    notif = Notificacion(user_id=user_id, request_id=request_id, message=message)
    db.add(notif)
    db.flush()
    return notif
