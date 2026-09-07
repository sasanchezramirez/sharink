# Especificación de Arquitectura Backend: Sharink API (Python + PostgreSQL)

**Documento:** `BACKEND_SPEC.md`  
**Proyecto:** Sharink  
**Stack Backend:** Python 3.12 / Poetry / FastAPI / SQLModel (SQLAlchemy 2.0 + Pydantic) / PostgreSQL  
**Gestión de versiones:** `mise` (pinea Python 3.12.14 y Poetry 2.4.3 por proyecto)  
**Ubicación:** `Projects/sharink/backend`

---

## 1. Auditoría: ¿Qué lógica pasa del Frontend al Backend?

Para que la aplicación sea escalable, segura y multi-dispositivo, separamos estrictamente las responsabilidades:

| Lógica | Dónde estaba antes | Dónde debe estar ahora | Razón Técnica |
|---|---|---|---|
| **Acumulación Intra-Día (Mismo Día)** | Frontend (`findIndex` + mutación local) | **Backend (`POST /api/activities`)** | Debe ser una transacción atómica en base de datos para evitar condiciones de carrera y duplicación de datos. |
| **Consolidación por Periodos (Semana, Mes, Global)** | Frontend (`Map<string, ...>` en memoria JS) | **Backend (`GET /api/activities?view=...`)** | Consultas agregadas con SQL (`GROUP BY`, `SUM`, `AVG` ponderado) son órdenes de magnitud más rápidas y no saturan el navegador con miles de registros. |
| **Persistencia de Datos** | Frontend (`localStorage` 5MB máx) | **Backend (PostgreSQL)** | Persistencia real, respaldos automáticos, soporte multi-dispositivo y sincronización en la nube. |
| **Validación de Reglas de Negocio** | Frontend (Validaciones sueltas) | **Backend (Pydantic Validators)** | Asegura que `temperature` esté estrictamente en $[-5.0, +5.0]$, `hours > 0`, y sanitiza nombres de actividades. |
| **Físicas y Renderizado del Grafo** | Frontend (`d3-force`, SVG) | **Frontend (Se mantiene en el cliente)** | Las físicas interactivas (zoom, paneo, resortes, repulsión) deben correr a 60-120fps en la GPU/CPU del navegador. |

---

## 2. Diagrama de Arquitectura

```
+-------------------------------------------------------------+
|                      CLIENTE (React + Vite)                 |
|   * Motor de Físicas D3 (Espacio, Nodos, Orbitas, Zoom)    |
|   * UI / Floating Dock / Inspección                         |
+------------------------------+------------------------------+
                               |
                        JSON HTTP / REST
                               |
+------------------------------v------------------------------+
|                   BACKEND (FastAPI - Python)                |
|                                                             |
|  [ Routers ]                                                |
|    * /api/activities (Log con acumulación inteligente)      |
|    * /api/areas (Gestión de aspectos de vida)               |
|    * /api/insights (Correlaciones tiempo vs bienestar)      |
|                                                             |
|  [ Servicios de Dominio ]                                   |
|    * AggregationService (Cálculo SQL de nodos consolidados) |
|    * ActivityAccumulator (Fusión matemática intra-día)      |
|                                                             |
|  [ ORM & Capa de Datos ]                                    |
|    * SQLModel / SQLAlchemy Async Engine                     |
+------------------------------+------------------------------+
                               |
                           Conexión SQL
                               |
+------------------------------v------------------------------+
|                     BASE DE DATOS (PostgreSQL)              |
|   * users, activities, life_areas, activity_areas           |
|   * Índices en (user_id, date, name_normalized)             |
+-------------------------------------------------------------+
```

---

## 3. Modelo de Base de Datos Relacional (PostgreSQL)

```
 +------------------+           +----------------------+           +------------------+
 |      users       | 1       * |      activities      | *       * |    life_areas    |
 +------------------+-----------+----------------------+-----------+------------------+
 | id (UUID) [PK]   |           | id (UUID) [PK]       |           | id (UUID) [PK]   |
 | email (VARCHAR)  |           | user_id (UUID) [FK]  |           | user_id (UUID)   |
 | created_at (TS)  |           | name (VARCHAR)       |           | name (VARCHAR)   |
 +------------------+           | name_norm (VARCHAR)  |           | color (VARCHAR)  |
                                | hours (NUMERIC)      |           | visible (BOOL)   |
                                | temperature (FLOAT)  |           | created_at (TS)  |
                                | date (DATE)          |           +------------------+
                                | notes (TEXT)         |
                                | created_at (TS)      |
                                +----------------------+
                                           |
                                           | 1
                                           |
                                           | *
                                +----------------------+
                                |    activity_areas    |
                                +----------------------+
                                | activity_id (FK)     |
                                | area_id (FK)         |
                                +----------------------+
```

### Definición de Modelos con SQLModel (Python)

```python
from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import date as DateType, datetime
import uuid

# Tabla intermedia Muchos a Muchos
class ActivityAreaLink(SQLModel, table=True):
    __tablename__ = "activity_areas"
    activity_id: uuid.UUID = Field(foreign_key="activities.id", primary_key=True)
    area_id: uuid.UUID = Field(foreign_key="life_areas.id", primary_key=True)

# Modelo de Aspectos de Vida
class LifeArea(SQLModel, table=True):
    __tablename__ = "life_areas"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(index=True)
    name: str = Field(max_length=60)
    color: str = Field(max_length=10)
    visible: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    activities: List["Activity"] = Relationship(back_populates="areas", link_model=ActivityAreaLink)

# Modelo de Actividad Diaria
class Activity(SQLModel, table=True):
    __tablename__ = "activities"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(index=True)
    name: str = Field(max_length=120)
    name_normalized: str = Field(index=True) # lower() y strip() para búsquedas rápidas
    hours: float = Field(ge=0.1, le=24.0)
    temperature: float = Field(ge=-5.0, le=5.0) # Escala EM -5 a +5
    date: DateType = Field(index=True)
    notes: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    areas: List[LifeArea] = Relationship(back_populates="activities", link_model=ActivityAreaLink)
```

---

## 4. Contratos de API (Endpoints REST)

### 4.1 `POST /api/activities` (Registro y Acumulación Inteligente)
* **Lógica del Backend:**
  1. Normaliza `name_normalized = payload.name.strip().lower()`.
  2. Busca si para ese `user_id` y esa `date` ya existe una actividad con ese mismo `name_normalized`.
  3. **Si existe:**
     * Suma las horas: `hours_total = existing.hours + payload.hours`.
     * Recalcula la temperatura ponderada:  
       $$\text{temp\_ponderada} = \frac{(\text{existente.temp} \times \text{existente.hours}) + (\text{nueva.temp} \times \text{nueva.hours})}{\text{hours\_total}}$$
     * Une los `area_ids`.
     * Concatena notas.
  4. **Si no existe:**
     * Inserta un nuevo registro con UUID propio.
  5. Retorna la actividad resultante.

### 4.2 `GET /api/activities` (Consulta y Agregación Temporal)
* **Parámetros Query:**
  * `view`: `day` | `week` | `month` | `global`
  * `date`: `YYYY-MM-DD` (fecha focal de consulta)
* **Lógica del Backend:**
  * Si `view == 'day'`: Consulta por `date = :date`.
  * Si `view == 'week'`: Rango `date BETWEEN :start_of_week AND :end_of_week`.
  * Si `view == 'month'`: Rango del mes focal.
  * Si `view == 'global'`: Sin filtro de fechas.
  * **Agregación SQL:**
    ```sql
    SELECT 
        name_normalized,
        MAX(name) AS name,
        ROUND(SUM(hours)::numeric, 2) AS total_hours,
        ROUND((SUM(hours * temperature) / SUM(hours))::numeric, 2) AS weighted_temperature,
        array_agg(DISTINCT area_id) AS area_ids
    FROM activities
    JOIN activity_areas ON activities.id = activity_areas.activity_id
    WHERE user_id = :user_id AND date BETWEEN :start AND :end
    GROUP BY name_normalized;
    ```
  * Retorna directamente la lista de nodos listos para alimentar el grafo del frontend.

### 4.3 `PUT /api/activities/{id}` y `DELETE /api/activities/{id}`
* Actualización y eliminación con validación de pertenencia al usuario.

### 4.4 `GET /api/areas` y `POST /api/areas`
* CRUD de aspectos de vida con asignación de paletas.

---

## 5. Estructura del Proyecto Backend en Python

```
Projects/sharink/backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # Instancia FastAPI, CORS, middlewares
│   ├── config.py            # Variables de entorno (DATABASE_URL, SECRET_KEY)
│   ├── database.py          # Conexión async con PostgreSQL (AsyncSession)
│   ├── models/
│   │   ├── __init__.py
│   │   ├── activity.py      # Modelos SQLModel de Actividades y Links
│   │   ├── area.py          # Modelos de LifeArea
│   │   └── user.py          # Modelo de Usuario
│   ├── schemas/
│   │   ├── activity.py      # Pydantic schemas (ActivityCreate, ActivityRead, ConsolidatedNode)
│   │   └── area.py          # AreaCreate, AreaRead
│   ├── services/
│   │   ├── accumulator.py   # Lógica matemática de acumulación intra-día
│   │   └── aggregator.py    # Generador de consultas SQL agrupadas
│   └── routers/
│       ├── activities.py    # Endpoints /api/activities
│       └── areas.py         # Endpoints /api/areas
├── tests/
│   └── test_activities.py   # Tests unitarios de acumulación y ponderación
├── Dockerfile
├── mise.toml                # Pin de Python 3.12.14 y Poetry 2.4.3
├── pyproject.toml           # Metadatos, dependencias y config de herramientas
├── poetry.lock              # Resolución determinista (versionado en git)
└── README.md
```

> **Nota sobre el driver de PostgreSQL:** se usa exclusivamente `asyncpg`.
> `psycopg2-binary` no es necesario porque tanto la aplicación como Alembic
> operan sobre el `AsyncEngine` de SQLAlchemy 2.0.

---

## 6. Plan de Implementación Paso a Paso

> **Cómo usar esta sección:** cada tarea tiene un ID (`T01`, `T02`, ...), es atómica y verificable.
> Se ejecutan en orden salvo que se indique lo contrario en *Depende de*.
> Marcar `[x]` al completar. El criterio de aceptación es la definición de "hecho".

### Leyenda de estado
- `[ ]` Pendiente · `[~]` En progreso · `[x]` Completada

---

### FASE 0 — Fundaciones del Proyecto

#### `[x] T01 · Crear esqueleto de directorios del backend`
- **Objetivo:** Dejar el árbol de carpetas exacto de la sección 5 creado y vacío.
- **Archivos:** `backend/app/{models,schemas,services,routers}/`, `backend/tests/`, todos con `__init__.py`.
- **Acciones:**
  1. `mkdir -p backend/app/{models,schemas,services,routers} backend/tests`
  2. Crear `__init__.py` vacío en cada paquete Python.
  3. Crear `backend/README.md` con instrucciones de arranque (placeholder).
- **Depende de:** —
- **Aceptación:** `find backend -type d` refleja la estructura de la sección 5.

#### `[x] T02 · Toolchain y dependencias con Poetry`
- **Objetivo:** Entorno Python 3.12 reproducible y determinista, aislado del Python del sistema.
- **Archivos:** `backend/mise.toml`, `backend/pyproject.toml`, `backend/poetry.lock`, `.gitignore`.
- **Acciones:**
  1. Pinear el toolchain con `mise`: `python = "3.12.14"`, `poetry = "2.4.3"`.
  2. `pyproject.toml` (PEP 621) con `requires-python = ">=3.12,<3.13"`.
  3. Dependencias de producción: `fastapi`, `uvicorn[standard]`, `sqlmodel`, `asyncpg`, `alembic`, `pydantic-settings`.
  4. Grupo `dev`: `pytest`, `pytest-asyncio`, `httpx`, `ruff`.
  5. `poetry config virtualenvs.in-project true --local` → el venv vive en `backend/.venv`.
  6. `poetry install` y versionar `poetry.lock`; ignorar `.venv/`, `poetry.toml`, `__pycache__/`, `.pytest_cache/`, `.ruff_cache/`, `.env`.
- **Depende de:** T01
- **Aceptación:** `poetry run python --version` → `3.12.14`; `import fastapi, sqlmodel, asyncpg, alembic` sin errores; `git status` no muestra `.venv`.

> `python-dotenv` no se declara explícitamente: llega como dependencia transitiva de
> `pydantic-settings` y nunca se importa de forma directa en el código.

#### `[x] T03 · Configuración por variables de entorno`
- **Objetivo:** Centralizar config sin valores hardcodeados.
- **Archivos:** `backend/app/config.py`, `backend/.env.example`, `backend/.env` (ignorado).
- **Acciones:**
  1. Clase `Settings(BaseSettings)` con: `DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS`, `ENV`, `DEFAULT_USER_ID`.
  2. Instancia cacheada `get_settings()` con `@lru_cache`.
  3. `.env.example` documentando cada variable.
- **Depende de:** T02
- **Aceptación:** `python -c "from app.config import get_settings; print(get_settings())"` imprime la config sin errores.

#### `[x] T04 · Provisionar PostgreSQL local`
- **Objetivo:** Base de datos `sharink` accesible.
- **Archivos:** `backend/docker-compose.yml` (servicio `db` con `postgres:16-alpine` y volumen persistente).
- **Acciones:**
  1. Levantar contenedor o usar Postgres del sistema.
  2. Crear base `sharink` y usuario dedicado.
  3. Fijar `DATABASE_URL=postgresql+asyncpg://sharink:***@localhost:5432/sharink` en `.env`.
- **Depende de:** T03
- **Aceptación:** `psql -d sharink -c '\l'` conecta correctamente.

#### `[x] T05 · Motor de conexión asíncrono`
- **Objetivo:** `AsyncEngine` + dependencia `get_session()` para FastAPI.
- **Archivos:** `backend/app/database.py`
- **Acciones:**
  1. `create_async_engine(settings.DATABASE_URL, echo=ENV=="dev", pool_pre_ping=True)`.
  2. `async_session_maker = async_sessionmaker(engine, expire_on_commit=False)`.
  3. Generador `async def get_session() -> AsyncGenerator[AsyncSession, None]`.
  4. Helper `init_db()` para `create_all` en desarrollo.
- **Depende de:** T04
- **Aceptación:** Un script de prueba ejecuta `SELECT 1` contra la DB vía la sesión async.

---

### FASE 1 — Capa de Datos

#### `[x] T06 · Modelo User`
- **Archivos:** `backend/app/models/user.py`
- **Acciones:** `User(SQLModel, table=True)` → `id: UUID PK`, `email: str` (unique, index), `created_at: datetime`.
- **Depende de:** T05
- **Aceptación:** El modelo importa sin errores y se registra en `SQLModel.metadata`.

#### `[x] T07 · Modelos LifeArea, Activity y ActivityAreaLink`
- **Archivos:** `backend/app/models/area.py`, `backend/app/models/activity.py`, `backend/app/models/__init__.py`
- **Acciones:**
  1. Copiar las definiciones de la sección 3 (SQLModel).
  2. Relación M2M vía `ActivityAreaLink` con PK compuesta.
  3. Reexportar todos los modelos desde `models/__init__.py` para que Alembic los detecte.
  4. Constraint de unicidad lógica: `UniqueConstraint("user_id", "date", "name_normalized")` en `activities`.
- **Depende de:** T06
- **Aceptación:** `SQLModel.metadata.tables.keys()` devuelve `users`, `activities`, `life_areas`, `activity_areas`.

#### `[x] T08 · Índices de rendimiento`
- **Objetivo:** Índices citados en el diagrama de arquitectura.
- **Archivos:** `backend/app/models/activity.py`
- **Acciones:** Índice compuesto `ix_activities_user_date_name` sobre `(user_id, date, name_normalized)` e índice `(user_id, date)` para rangos temporales.
- **Depende de:** T07
- **Aceptación:** `\d activities` en psql muestra ambos índices tras migrar.

#### `[x] T09 · Migraciones con Alembic`
- **Archivos:** `backend/alembic.ini`, `backend/migrations/env.py`, `backend/migrations/versions/*.py`
- **Acciones:**
  1. `alembic init migrations`; adaptar `env.py` a async y a `SQLModel.metadata`.
  2. `alembic revision --autogenerate -m "initial schema"`.
  3. Revisar el SQL generado a mano (tipos UUID, FK, índices).
  4. `alembic upgrade head`.
- **Depende de:** T08
- **Aceptación:** Las 4 tablas existen en PostgreSQL; `alembic downgrade base && upgrade head` es idempotente.

#### `[x] T10 · Seed de datos de desarrollo`
- **Objetivo:** Portar el dataset semilla de 20 actividades (Lun–Dom) del frontend a la DB.
- **Archivos:** `backend/app/seed.py`
- **Acciones:**
  1. Crear un usuario demo con UUID fijo (= `DEFAULT_USER_ID`).
  2. Insertar las áreas de vida por defecto con sus colores de la escala cromática.
  3. Insertar las 20 actividades con `hours`, `temperature` y `area_ids`.
  4. Script idempotente (no duplica si ya existe).
- **Depende de:** T09
- **Aceptación:** `python -m app.seed` dos veces seguidas deja exactamente 20 actividades.

---

### FASE 2 — Esquemas y Servicios de Dominio

#### `[x] T11 · Schemas Pydantic de Area`
- **Archivos:** `backend/app/schemas/area.py`
- **Acciones:** `AreaCreate` (name 1–60, color hex validado por regex `^#[0-9a-fA-F]{6}$`), `AreaUpdate` (parcial), `AreaRead`.
- **Depende de:** T07
- **Aceptación:** Un color inválido lanza `ValidationError`.

#### `[x] T12 · Schemas Pydantic de Activity`
- **Archivos:** `backend/app/schemas/activity.py`
- **Acciones:**
  1. `ActivityCreate`: `name` (str, sanitizado con `strip()`, 1–120), `hours` (0.1–24.0), `temperature` (−5.0–+5.0), `date`, `notes?`, `area_ids: list[UUID]`.
  2. `ActivityUpdate`: todos los campos opcionales, mismas cotas.
  3. `ActivityRead`: entidad completa con `areas` embebidas.
  4. `ConsolidatedNode`: `name`, `name_normalized`, `total_hours`, `weighted_temperature`, `area_ids`, `entry_count`.
  5. Validador que rechaza nombres vacíos tras `strip()`.
- **Depende de:** T11
- **Aceptación:** Tests de límites: `temperature=5.1` y `hours=0` fallan; `temperature=-5.0` pasa.

#### `[x] T13 · Servicio ActivityAccumulator (acumulación intra-día)`
- **Archivos:** `backend/app/services/accumulator.py`
- **Acciones:**
  1. `normalize_name(name) -> str` (`strip().lower()`, colapsa espacios internos).
  2. `weighted_temperature(t1, h1, t2, h2) -> float` con la fórmula de §4.1, redondeo a 2 decimales, clamp a [−5, 5].
  3. `merge_notes(a, b) -> str | None` concatenando con separador ` · ` sin duplicar.
  4. `async upsert_activity(session, user_id, payload) -> Activity`:
     - `SELECT ... FOR UPDATE` sobre `(user_id, date, name_normalized)` dentro de la transacción.
     - Si existe: suma horas (cap 24.0), recalcula temperatura ponderada, une `area_ids` (set), fusiona notas.
     - Si no existe: inserta nuevo registro.
- **Depende de:** T12
- **Aceptación:** Función pura `weighted_temperature(4.0, 1, -2.0, 3) == -0.5`; el upsert nunca crea duplicados.

#### `[x] T14 · Servicio AggregationService (consolidación temporal)`
- **Archivos:** `backend/app/services/aggregator.py`
- **Acciones:**
  1. `resolve_range(view, focal_date) -> tuple[date|None, date|None]` para `day` / `week` (Lunes–Domingo) / `month` / `global`.
  2. `async fetch_nodes(session, user_id, view, date) -> list[ConsolidatedNode]` con la query agregada de §4.2 (`SUM(hours)`, `SUM(h*t)/SUM(h)`, `array_agg(DISTINCT area_id)`).
  3. Usar `LEFT JOIN` a `activity_areas` para no perder actividades sin área asignada.
  4. En `view == 'day'` devolver también los registros individuales si se solicita `raw=true`.
- **Depende de:** T13
- **Aceptación:** Con el seed, `view=week` consolida los nombres repetidos en un solo nodo con horas sumadas.

#### `[x] T15 · Tests unitarios de acumulación y agregación`
- **Archivos:** `backend/tests/test_accumulator.py`, `backend/tests/test_aggregator.py`
- **Acciones:** Cubrir fórmula ponderada, clamps, normalización de nombres, límites de semana/mes y consolidación multi-día.
- **Depende de:** T14
- **Aceptación:** `pytest backend/tests -q` en verde.

---

### FASE 3 — Capa HTTP (FastAPI)

#### `[x] T16 · App principal, CORS y healthcheck`
- **Archivos:** `backend/app/main.py`
- **Acciones:**
  1. `FastAPI(title="Sharink API", version="1.0.0")`.
  2. `CORSMiddleware` con `CORS_ORIGINS` (incluye `http://localhost:5173`).
  3. `GET /api/health` → `{"status": "ok", "db": true}`.
  4. Handler global de excepciones con formato de error uniforme `{detail, code}`.
- **Depende de:** T05
- **Aceptación:** `uvicorn app.main:app --reload` sirve `/docs` y `/api/health` responde 200.

#### `[x] T17 · Identidad de usuario (dependencia current_user)`
- **Objetivo:** Aislar los datos por usuario sin bloquear el desarrollo con auth completa.
- **Archivos:** `backend/app/deps.py`
- **Acciones:** Dependencia `get_current_user_id()` que lee la cabecera `X-User-Id` y cae en `DEFAULT_USER_ID` si falta. Documentar que se sustituirá por JWT en la fase 6.
- **Depende de:** T16
- **Aceptación:** Todos los routers reciben `user_id` por inyección, nunca de forma literal.

#### `[x] T18 · Router de áreas (/api/areas)`
- **Archivos:** `backend/app/routers/areas.py`
- **Acciones:** `GET /api/areas`, `POST /api/areas`, `PUT /api/areas/{id}`, `DELETE /api/areas/{id}` (con verificación de pertenencia → 404 si es de otro usuario).
- **Depende de:** T17
- **Aceptación:** CRUD completo verificado desde `/docs`.

#### `[x] T19 · Router de actividades: POST con acumulación`
- **Archivos:** `backend/app/routers/activities.py`
- **Acciones:** `POST /api/activities` delegando en `upsert_activity`; devuelve `201` en creación y `200` en fusión, con `ActivityRead`.
- **Depende de:** T18
- **Aceptación:** Dos POST del mismo nombre y fecha devuelven un único registro con horas sumadas.

#### `[x] T20 · Router de actividades: GET con vistas temporales`
- **Archivos:** `backend/app/routers/activities.py`
- **Acciones:** `GET /api/activities?view=day|week|month|global&date=YYYY-MM-DD` usando `AggregationService`; validar `view` con `Enum` y `date` con default = hoy.
- **Depende de:** T19
- **Aceptación:** `view=global` devuelve un nodo por nombre normalizado en todo el histórico.

#### `[x] T21 · Router de actividades: PUT y DELETE`
- **Archivos:** `backend/app/routers/activities.py`
- **Acciones:** `PUT /api/activities/{id}` (recalcula `name_normalized` y reasigna áreas) y `DELETE /api/activities/{id}`, ambos con validación de pertenencia (404 si `user_id` no coincide).
- **Depende de:** T20
- **Aceptación:** Un `id` ajeno devuelve 404, nunca 200 ni 500.

#### `[x] T22 · Tests de integración de endpoints`
- **Archivos:** `backend/tests/test_activities.py`, `backend/tests/conftest.py`
- **Acciones:** Fixtures con `httpx.AsyncClient` + base de datos de test; cubrir el flujo completo (crear área → crear actividad → acumular → consultar week → editar → borrar).
- **Depende de:** T21
- **Aceptación:** `pytest -q` en verde con la suite completa.

---

### FASE 4 — Integración con el Frontend

#### `[ ] T23 · Cliente API en el frontend`
- **Archivos:** `src/api/client.ts`, `src/api/types.ts`, `.env.local` (`VITE_API_URL`)
- **Acciones:**
  1. `request<T>()` genérico con `fetch`, cabecera `X-User-Id`, manejo de errores tipado.
  2. Métodos: `listActivities(view, date)`, `createActivity()`, `updateActivity()`, `deleteActivity()`, `listAreas()`, `createArea()`.
  3. Tipos alineados 1:1 con los schemas Pydantic (`ConsolidatedNode`, `ActivityRead`, `AreaRead`).
- **Depende de:** T22
- **Aceptación:** `npm run lint` (tsc --noEmit) sin errores.

#### `[ ] T24 · Hook de estado remoto`
- **Archivos:** `src/hooks/useActivities.ts`, `src/hooks/useAreas.ts`
- **Acciones:** Encapsular fetch + estados `loading` / `error` / `data`, refetch al cambiar `view` o `date`, y actualización optimista al crear actividad.
- **Depende de:** T23
- **Aceptación:** Cambiar de vista Día→Semana dispara una sola petición y repinta el grafo.

#### `[ ] T25 · Migrar App.tsx de localStorage a la API`
- **Archivos:** `src/App.tsx`, `src/components/EditActivityModal.tsx`, `src/utils/storage.ts`
- **Acciones:**
  1. Sustituir la fuente de datos por los hooks de T24.
  2. Eliminar del cliente la acumulación intra-día y la consolidación por periodos (ahora vive en el backend).
  3. Conservar íntegro el motor de físicas D3 y el renderizado.
  4. Convertir `storage.ts` en caché offline opcional o eliminarlo.
- **Depende de:** T24
- **Aceptación:** La app funciona sin `localStorage`; recargar el navegador conserva los datos vía API.

#### `[ ] T26 · Estados de carga, error y vacío en la UI`
- **Archivos:** `src/components/GraphCanvas.tsx`, `src/components/TopBar.tsx`
- **Acciones:** Skeleton/spinner durante la carga, toast de error de red con reintento, y estado vacío ("Aún no hay actividades") coherente con el tema Deep Space Obsidian.
- **Depende de:** T25
- **Aceptación:** Con el backend apagado la app muestra el error, no una pantalla en blanco.

---

### FASE 5 — Empaquetado y Calidad

#### `[ ] T27 · Dockerfile y docker-compose completo`
- **Archivos:** `backend/Dockerfile`, `backend/docker-compose.yml`, `backend/.dockerignore`
- **Acciones:** Imagen multi-stage `python:3.12-slim`: etapa `builder` que instala Poetry y exporta el entorno desde `poetry.lock`, etapa final solo con el venv, usuario no-root y `uvicorn` como entrypoint; compose con servicios `api` + `db` y `depends_on` con healthcheck.
- **Depende de:** T22
- **Aceptación:** `docker compose up` levanta la API en `:8000` con migraciones aplicadas.

#### `[ ] T28 · Linter, formato y CI`
- **Archivos:** `backend/pyproject.toml`, `.github/workflows/ci.yml`
- **Acciones:** Ampliar `[tool.ruff]` en el `pyproject.toml` existente (reglas, `line-length`, `target-version = "py312"`); en CI usar `poetry install --sync` con caché del `poetry.lock` y ejecutar `ruff check`, `ruff format --check`, `pytest` y `npm run build`.
- **Depende de:** T27
- **Aceptación:** El pipeline pasa en verde en un push limpio.

#### `[ ] T29 · Documentación de arranque`
- **Archivos:** `backend/README.md`, `README.md` (raíz)
- **Acciones:** Documentar requisitos, `.env`, migraciones, seed, arranque en dev, arranque con Docker y tabla de endpoints.
- **Depende de:** T28
- **Aceptación:** Un clon limpio queda operativo siguiendo solo el README.

---

### FASE 6 — Backlog Posterior (fuera del alcance inicial)

#### `[ ] T30 · Autenticación real con JWT`
Registro/login, hashing con `argon2`, `access` + `refresh` tokens, y sustitución de la dependencia `X-User-Id` de T17.

#### `[ ] T31 · Endpoint /api/insights`
Correlaciones entre horas invertidas y temperatura media por aspecto de vida y evolución temporal (series semanales).

#### `[ ] T32 · Rate limiting y observabilidad`
`slowapi` para límites por IP/usuario, logging estructurado JSON y métricas de latencia por endpoint.

#### `[ ] T33 · Sincronización offline-first`
Cola local de mutaciones pendientes en el cliente y resolución de conflictos por `updated_at`.

---

### Tabla Resumen de Progreso

| Fase | Tareas | Entregable |
|---|---|---|
| 0 · Fundaciones | T01–T05 | Proyecto, entorno, config y conexión a PostgreSQL |
| 1 · Capa de Datos | T06–T10 | Modelos, índices, migraciones y seed |
| 2 · Dominio | T11–T15 | Schemas, acumulador, agregador y tests unitarios |
| 3 · Capa HTTP | T16–T22 | API REST completa con tests de integración |
| 4 · Frontend | T23–T26 | React consumiendo la API, sin `localStorage` |
| 5 · Calidad | T27–T29 | Docker, CI y documentación |
| 6 · Backlog | T30–T33 | Auth, insights, observabilidad, offline |
