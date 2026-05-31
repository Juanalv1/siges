# SiGES — Sistema de Gestión de Solicitudes Estudiantiles

Proyecto Sociotecnológico de 3er semestre de Informática. Sistema para el Departamento de Control de Estudios (Taquilla) de la universidad.

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Python + FastAPI |
| Frontend | React |
| Base de datos | PostgreSQL |
| Despliegue | Docker + Docker Compose |
| Servidor destino | Ubuntu Server (físico, universidad) |

## Estructura del proyecto

```
siges/
├── backend/
│   ├── app/
│   │   ├── main.py              ← entrada FastAPI
│   │   ├── config.py
│   │   ├── models/              ← modelos SQLAlchemy
│   │   ├── routers/             ← endpoints por módulo
│   │   │   ├── auth.py
│   │   │   ├── solicitudes.py
│   │   │   ├── operador.py
│   │   │   └── coordinador.py
│   │   ├── services/
│   │   │   ├── sogac.py         ← integración SOGAC (caja negra)
│   │   │   └── notificaciones.py
│   │   └── utils/
│   ├── migrations/
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── services/            ← llamadas a la API
│   └── package.json
├── nginx/
│   └── nginx.conf
└── docker-compose.yml
```

## Principios del sistema

1. **SiGES gestiona trámites, no ejecuta acciones.** Las acciones en SOGAC (habilitar, desbloquear, etc.) las realiza el operador manualmente.
2. **Documentos configurables por coordinador.** No se piden documentos adicionales después de enviada una solicitud.
3. **Sin verificación de correo en fase 1.** La validación contra SOGAC es suficiente para confirmar que el estudiante es real.
4. **Bandeja compartida.** Sin asignación individual entre operadores.
5. **"En atención" automático.** Al abrir una solicitud se marca en atención; si el operador se sale sin acción, vuelve a pendiente.

## Roles

- `estudiante` — crea y hace seguimiento de sus solicitudes
- `operador` — atiende la bandeja, aprueba/rechaza/escala solicitudes
- `coordinador` — configura tipos de trámite, resuelve escalados

## Módulos (fase 1)

| Módulo | Estado |
|---|---|
| Autenticación (registro, login, recuperación) | ⏳ por implementar |
| Inscripción (sin cuenta, caso especial) | ⏳ por implementar |
| Desbloqueo de usuario | ⏳ por implementar |
| Panel del operador (bandeja + acciones) | ⏳ por implementar |
| Congelamiento | ⏳ pendiente definir con departamento |
| Cambio de turno | ⏳ pendiente definir con departamento |
| Cambio de sede | ⏳ pendiente definir con departamento |

## SOGAC

Sistema académico externo de la universidad. SiGES solo lo consulta para validar cédulas al registro. La integración técnica (API o BD directa) está pendiente de confirmar con el equipo de sistemas. Por ahora se abstrae detrás de `backend/app/services/sogac.py`: recibe cédula, devuelve si el estudiante está activo.

## Notas de desarrollo

- Inscripción es el único trámite accesible sin cuenta (`requiere_cuenta = False` en `tipos_tramite`).
- Los documentos del perfil se suben una sola vez y quedan disponibles para todos los trámites que los requieran.
- Las respuestas de seguridad se normalizan (lowercase, trim) antes de hashear.
- `historial_estados` es la fuente de verdad para trazabilidad; `es_interno = True` oculta el comentario al estudiante.
