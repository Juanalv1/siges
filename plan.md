# Plan SiGES — Fase 1 completa

## Contexto

Repositorio vacío (solo CLAUDE.md y README.md). Se necesita construir desde cero el sistema completo de gestión de solicitudes estudiantiles. Backend (FastAPI + PostgreSQL) y frontend (React) avanzan en paralelo por fase. Los 3 trámites sin definir (congelamiento, cambio de turno, cambio de sede) quedan fuera del alcance. Sin tests por ahora.

---

## Fase 0 — Fundación (secuencial, todo depende de esto)

Un solo agente. Nada más puede empezar hasta que esto esté listo.

**Tarea: Scaffolding completo del proyecto**

Crear la estructura de carpetas, Docker Compose, configuración del backend y del frontend.

### Archivos a crear

```
docker-compose.yml
.env.example

backend/
├── Dockerfile
├── requirements.txt              ← fastapi, uvicorn, sqlalchemy, alembic, psycopg2-binary, python-jose, passlib, python-multipart
├── alembic.ini
├── app/
│   ├── main.py                   ← instancia FastAPI, incluye routers
│   ├── config.py                 ← lee .env (DATABASE_URL, SECRET_KEY, etc.)
│   ├── database.py               ← engine, SessionLocal, Base
│   ├── dependencies.py           ← get_db(), get_current_user()
│   ├── models/
│   │   ├── __init__.py
│   │   ├── usuario.py            ← tabla usuarios + preguntas_seguridad + respuestas_seguridad
│   │   ├── tramite.py            ← tabla tipos_tramite
│   │   ├── solicitud.py          ← tabla solicitudes + historial_estados
│   │   ├── documento.py          ← tabla documentos
│   │   └── notificacion.py       ← tabla notificaciones
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py               ← vacío, solo router registrado
│   │   ├── solicitudes.py        ← vacío
│   │   ├── operador.py           ← vacío
│   │   └── coordinador.py        ← vacío
│   ├── services/
│   │   ├── sogac.py              ← mock: recibe cédula, devuelve True/False
│   │   └── notificaciones.py     ← stub vacío
│   └── utils/
│       └── security.py           ← hash de contraseña, JWT, normalización de respuestas
└── migrations/
    └── versions/                 ← Alembic generará aquí

frontend/
├── Dockerfile
├── package.json                  ← Vite + React + react-router-dom + axios
├── vite.config.js
├── index.html
└── src/
    ├── main.jsx
    ├── App.jsx                   ← rutas principales
    ├── api/
    │   └── client.js             ← axios con baseURL y interceptor de token
    ├── pages/                    ← carpeta vacía, se llena en fases siguientes
    └── components/               ← carpeta vacía
```

### docker-compose.yml debe tener

- Servicio `db`: PostgreSQL 15, volumen persistente, healthcheck
- Servicio `backend`: FastAPI con Uvicorn, depende de `db`, hot-reload con volumen
- Servicio `frontend`: Vite dev server, proxy `/api` → backend

### Modelos SQLAlchemy (según arquitectura.md)

Implementar exactamente las tablas definidas:
- `usuarios` (id, cedula UNIQUE, nombre, apellido, correo UNIQUE, telefono, password_hash, rol ENUM, activo, created_at)
- `preguntas_seguridad` (id, pregunta)
- `respuestas_seguridad` (id, usuario_id FK, pregunta_id FK, respuesta_hash)
- `tipos_tramite` (id, nombre, descripcion, docs_requeridos JSON, dias_limite, activo, requiere_cuenta)
- `solicitudes` (id, ticket UNIQUE autogenerado, usuario_id FK nullable, cedula_solicitante, tipo_tramite_id FK, estado ENUM, operador_id FK nullable, descripcion, created_at, updated_at)
- `historial_estados` (id, solicitud_id FK, operador_id FK, estado_anterior, estado_nuevo, comentario, es_interno BOOL, fecha)
- `documentos` (id, solicitud_id FK nullable, usuario_id FK nullable, nombre_archivo, ruta, tipo_mime, subido_at)
- `notificaciones` (id, usuario_id FK, solicitud_id FK, mensaje, leido BOOL, created_at)

ENUM `rol`: estudiante, operador, coordinador  
ENUM `estado`: pendiente, en_atencion, aprobada, rechazada, escalada, resuelta

### `services/sogac.py` (mock para fase 1)

```python
def verificar_estudiante(cedula: str) -> bool:
    # Mock: en producción consulta SOGAC
    return True
```

### Criterio de éxito

`docker compose up` levanta sin errores. `GET /docs` muestra Swagger. Frontend carga en `localhost:3000`.

---

## Fase 1 — Autenticación (backend + frontend en paralelo)

Dos agentes en paralelo. Dependen de Fase 0.

---

### Agente 1A — Backend: Autenticación

**Archivo principal:** `backend/app/routers/auth.py`  
**Archivos de apoyo:** `utils/security.py`, `dependencies.py`

#### Endpoints a implementar

**POST /auth/register**
- Body: cedula, nombre, apellido, correo, telefono, password, preguntas (lista de 2 objetos `{pregunta_id, respuesta}`)
- Llama `sogac.verificar_estudiante(cedula)`; si False → 400 "Cédula no encontrada en el sistema"
- Si cédula o correo ya existen → 400
- Guarda usuario con `rol=estudiante`, `activo=True`
- Hashea respuestas normalizadas (lowercase + strip) antes de guardar
- Retorna `{id, nombre, correo}`

**POST /auth/login**
- Body: correo, password
- Retorna JWT con payload `{sub: usuario_id, rol: rol}`
- Token expira en 8 horas

**GET /auth/preguntas-seguridad**
- Retorna lista de todas las preguntas predefinidas del sistema
- Insertar las preguntas en un seed: "¿Nombre de tu primera mascota?", "¿Ciudad donde naciste?", "¿Nombre de tu escuela primaria?", "¿Apodo de infancia?", "¿Película favorita de la infancia?"

**POST /auth/recuperar/iniciar**
- Body: cedula
- Retorna las 2 preguntas de seguridad del usuario (sin las respuestas)
- Si cédula no existe → 404

**POST /auth/recuperar/verificar**
- Body: cedula, respuestas (lista de 2 objetos `{pregunta_id, respuesta}`)
- Verifica ambas respuestas normalizadas
- Si correctas → retorna token temporal de recuperación (JWT con expiración 15 min, scope=recovery)
- Si incorrectas → 400

**POST /auth/recuperar/nueva-password**
- Header: Bearer token de recuperación
- Body: nueva_password
- Valida que el token sea de scope=recovery
- Actualiza password_hash

---

### Agente 1B — Frontend: Autenticación

**Páginas a crear en `frontend/src/pages/auth/`**

Usar solo React + React Router + axios (sin librerías de UI externas).  
Diseño limpio y funcional. Formularios con validación básica en el cliente.

**`/registro`** — Página de registro
- Campos: cédula, nombre, apellido, correo, teléfono, contraseña, confirmar contraseña
- Segundo paso: 2 preguntas de seguridad (selección de lista, respuesta de texto)
- Llama primero a `GET /auth/preguntas-seguridad` para poblar los selects
- Llama `POST /auth/register`
- En éxito → redirige a `/login` con mensaje "Cuenta creada"

**`/login`** — Página de login
- Campos: correo, contraseña
- Llama `POST /auth/login`, guarda JWT en localStorage
- Redirige según rol: `estudiante` → `/solicitudes`, `operador` → `/operador`, `coordinador` → `/coordinador`

**`/recuperar`** — Recuperación de contraseña (3 pasos en la misma página, estado local)
1. Ingresa cédula → muestra las 2 preguntas
2. Responde preguntas → si OK guarda token temporal
3. Ingresa nueva contraseña → redirige a `/login`

**`src/context/AuthContext.jsx`**
- Provee `user`, `token`, `login(token)`, `logout()`
- `login` decodifica el JWT para extraer rol y nombre
- Persiste token en localStorage

**`src/components/ProtectedRoute.jsx`**
- Wrapper que redirige a `/login` si no hay token
- Acepta prop `roles` para restricción por rol

---

## Fase 2 — Solicitudes del estudiante (paralelo)

Depende de Fase 1 completa.

---

### Agente 2A — Backend: Solicitudes del estudiante

**Archivo principal:** `backend/app/routers/solicitudes.py`

#### Endpoints

**GET /tipos-tramite**
- Público (sin auth)
- Retorna tipos activos con sus `docs_requeridos`
- Filtro: si el usuario no está autenticado, solo retorna los que tienen `requiere_cuenta=False`

**POST /solicitudes**
- Auth: estudiante
- Body: tipo_tramite_id, descripcion, documentos (lista de IDs de documentos ya subidos)
- Genera ticket único: `SIG-{año}{mes}-{5 dígitos random}`
- Estado inicial: `pendiente`
- Retorna solicitud creada con ticket

**POST /solicitudes/inscripcion** (caso especial sin cuenta)
- Sin auth
- Body: cedula, documentos (archivos, multipart)
- Llama `sogac.verificar_estudiante(cedula)` — si False → 400
- Sube documentos, crea solicitud con `usuario_id=None`, `cedula_solicitante=cedula`
- Retorna ticket

**GET /solicitudes/mis-solicitudes**
- Auth: estudiante
- Retorna lista de solicitudes del usuario autenticado con estado actual

**GET /solicitudes/{ticket}**
- Auth: estudiante (solo sus propias) o operador/coordinador (cualquiera)
- Retorna solicitud + historial de estados públicos (`es_interno=False`)

**POST /documentos/subir**
- Auth: estudiante
- Multipart: archivo
- Guarda en `backend/uploads/`, retorna id y nombre del archivo
- Si es documento de perfil (sin solicitud_id), queda asociado al usuario

---

### Agente 2B — Frontend: Panel del estudiante

**Páginas en `frontend/src/pages/estudiante/`**

**`/solicitudes`** — Dashboard del estudiante
- Lista de sus solicitudes con estado actual (badge de color por estado)
- Botón "Nueva solicitud"
- Cada fila linkea a `/solicitudes/{ticket}`

**`/solicitudes/nueva`** — Crear solicitud
- Paso 1: selecciona tipo de trámite (cards con nombre y descripción)
- Paso 2: descripción del problema + subida de documentos requeridos (según `docs_requeridos` del tipo)
- Subida de archivos: POST a `/documentos/subir` por cada archivo, luego POST `/solicitudes` con los IDs
- En éxito: muestra el ticket generado y redirige al dashboard

**`/solicitudes/{ticket}`** — Ver solicitud
- Estado actual con badge
- Historial de estados (solo los no internos): fecha, estado anterior → nuevo, comentario
- Documentos subidos (nombre + link de descarga)

**`/inscripcion`** — Flujo público (sin cuenta)
- Accesible sin login
- Campo cédula + subida de 3 documentos (Notas certificadas, Título de bachiller, Copia de cédula)
- En éxito: muestra ticket y mensaje "Recibirás una notificación cuando tu solicitud sea atendida"

---

## Fase 3 — Panel del operador (paralelo)

Depende de Fase 2 completa.

---

### Agente 3A — Backend: Panel del operador

**Archivo principal:** `backend/app/routers/operador.py`

#### Endpoints

**GET /operador/bandeja**
- Auth: operador o coordinador
- Retorna solicitudes en estado `pendiente` o `en_atencion`
- Filtros query params: `tipo_tramite_id`, `estado`, `fecha_desde`, `fecha_hasta`
- Orden: `created_at ASC` (primero las más antiguas)

**POST /operador/solicitudes/{id}/abrir**
- Auth: operador
- Cambia estado a `en_atencion`, registra `operador_id`
- Crea entrada en `historial_estados`
- Si la solicitud ya estaba `en_atencion` por otro operador → 409

**POST /operador/solicitudes/{id}/liberar**
- Auth: operador (solo el que la tiene)
- Vuelve estado a `pendiente`, limpia `operador_id`
- Se llama cuando el operador sale sin acción

**POST /operador/solicitudes/{id}/accion**
- Auth: operador
- Body: `{accion: "aprobar"|"rechazar"|"escalar", comentario: str, es_interno: bool}`
- `rechazar` requiere comentario obligatorio
- Registra en `historial_estados`
- Crea notificación para el estudiante (si no es interno)
- Actualiza estado de la solicitud

**GET /operador/solicitudes/{id}**
- Auth: operador o coordinador
- Retorna solicitud completa + historial completo (incluyendo internos) + documentos

---

### Agente 3B — Frontend: Panel del operador

**Páginas en `frontend/src/pages/operador/`**

**`/operador`** — Bandeja compartida
- Tabla con columnas: ticket, tipo, estudiante (o cédula si es inscripción), estado, fecha, tiempo transcurrido
- Filtros: tipo de trámite, estado, rango de fechas
- Al hacer clic en una fila → llama `POST /operador/solicitudes/{id}/abrir` y navega a la vista de detalle
- Badge visual para solicitudes `en_atencion` por otro operador

**`/operador/solicitudes/{id}`** — Vista de detalle
- Información completa de la solicitud
- Documentos con preview/descarga
- Historial completo (incluyendo comentarios internos con badge "Interno")
- Panel de acciones:
  - Botón "Aprobar" → confirma y ejecuta
  - Botón "Rechazar" → abre modal con campo de comentario obligatorio
  - Botón "Escalar a coordinador" → confirma
  - Botón "Agregar comentario interno" → campo de texto, no cambia estado
- Al salir (navegación back o cerrar) → llama `POST /operador/solicitudes/{id}/liberar`

---

## Fase 4 — Panel del coordinador (paralelo)

Depende de Fase 3 completa.

---

### Agente 4A — Backend: Coordinador

**Archivo principal:** `backend/app/routers/coordinador.py`

#### Endpoints

**GET/POST/PUT /coordinador/tipos-tramite**
- Auth: coordinador
- CRUD completo de tipos de trámite
- `docs_requeridos` es lista de strings (nombres de documentos)

**GET /coordinador/solicitudes-escaladas**
- Auth: coordinador
- Solicitudes en estado `escalada`

**POST /coordinador/solicitudes/{id}/resolver**
- Auth: coordinador
- Body: `{accion: "aprobar"|"rechazar", comentario: str}`
- Registra en historial, notifica al estudiante

**GET /coordinador/usuarios**
- Auth: coordinador
- Lista de operadores y coordinadores (no estudiantes)

**POST /coordinador/usuarios/{id}/toggle-activo**
- Auth: coordinador
- Activa/desactiva un usuario operador

---

### Agente 4B — Frontend: Panel del coordinador

**Páginas en `frontend/src/pages/coordinador/`**

**`/coordinador`** — Dashboard coordinador
- Resumen: total pendientes, en atención, escaladas
- Acceso rápido a secciones

**`/coordinador/tramites`** — Configuración de tipos de trámite
- Lista de tipos con estado activo/inactivo
- Formulario para crear/editar: nombre, descripción, documentos requeridos (lista editable de strings), días límite, toggle requiere_cuenta

**`/coordinador/escaladas`** — Solicitudes escaladas
- Similar a bandeja del operador pero solo escaladas
- Acciones: aprobar o rechazar con comentario obligatorio

**`/coordinador/usuarios`** — Gestión de operadores
- Lista de operadores con estado activo
- Toggle para activar/desactivar

---

## Dependencias entre fases

```
Fase 0 (Fundación)
    ↓
Fase 1A (Auth backend) ──┐
Fase 1B (Auth frontend) ─┘ (paralelo)
    ↓
Fase 2A (Solicitudes backend) ──┐
Fase 2B (Panel estudiante)      ┘ (paralelo)
    ↓
Fase 3A (Operador backend) ──┐
Fase 3B (Panel operador)    ─┘ (paralelo)
    ↓
Fase 4A (Coordinador backend) ──┐
Fase 4B (Panel coordinador)    ─┘ (paralelo)
```

## Verificación por fase

- **Fase 0:** `docker compose up` sin errores, `/docs` muestra Swagger, frontend carga
- **Fase 1:** Registro → login → token JWT válido → recuperación de contraseña funcional
- **Fase 2:** Crear solicitud desde frontend, ver ticket generado, flujo de inscripción sin cuenta
- **Fase 3:** Abrir solicitud desde bandeja, aprobar/rechazar, verificar que vuelve a pendiente al salir
- **Fase 4:** CRUD de tipos de trámite, resolver escalada, toggle de operador activo
