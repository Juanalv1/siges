from sqlalchemy.orm import Session

from app.models.notificacion import Notificacion


def crear_notificacion(db: Session, usuario_id: int, solicitud_id: int, mensaje: str) -> Notificacion:
    notif = Notificacion(usuario_id=usuario_id, solicitud_id=solicitud_id, mensaje=mensaje)
    db.add(notif)
    db.flush()
    return notif
