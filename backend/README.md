# Sharink API 🌌

Backend de alto rendimiento para **Sharink**, desarrollado con **FastAPI**, **SQLModel** (SQLAlchemy 2.0 Async), **asyncpg** y **PostgreSQL 16**. Proporciona acumulación matemática intra-día, consolidación y agregación espacial multi-período, persistencia relacional y aislamiento multi-usuario.

Especificación completa en [`../BACKEND_SPEC.md`](../BACKEND_SPEC.md).

---

## 📋 Requisitos Previos

- **Python 3.12+** (gestionado con [mise](https://mise.jdx.dev) o pyenv)
- **Poetry 2.0+**
- **Docker** y **Docker Compose** (para PostgreSQL o despliegue completo en contenedores)

| Herramienta | Versión fijada |
|---|---|
| Python | `3.12.14` |
| Poetry | `2.4.3` |
| PostgreSQL | `16-alpine` |

---

## ⚙️ Configuración de Variables de Entorno

Copia la plantilla de variables de entorno antes del primer arranque:

```bash
cp .env.example .env
```

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://sharink:sharink@localhost:5432/sharink` | URI asíncrona de conexión a PostgreSQL |
| `SECRET_KEY` | `dev-secret-key-change-in-production-min-32-chars-long` | Clave secreta (min. 32 chars en producción) |
| `CORS_ORIGINS` | `["http://localhost:5173","http://localhost:3000"]` | Orígenes web autorizados |
| `ENV` | `dev` | Entorno: `dev`, `test` o `prod` |
| `DEFAULT_USER_ID` | `00000000-0000-0000-0000-000000000001` | UUID del usuario por defecto |

---

## 🚀 Arranque en Desarrollo Local

### 1. Iniciar el Toolchain y Dependencias

```bash
mise install          # Instala Python 3.12 y Poetry (opcional si ya los tienes)
poetry install        # Crea el entorno virtual en backend/.venv
```

### 2. Iniciar la Base de Datos PostgreSQL

```bash
docker compose up -d db
```

### 3. Aplicar Migraciones y Cargar Datos Semilla

```bash
poetry run alembic upgrade head     # Aplica el esquema inicial en PostgreSQL
poetry run python -m app.seed       # Inserta usuario demo, áreas y 20 actividades
```

### 4. Iniciar el Servidor FastAPI

```bash
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- **API Base:** `http://localhost:8000/api`
- **Swagger UI interactivo:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

---

## 🐳 Arranque Completo con Docker

Para levantar la base de datos y la API conjuntamente en contenedores aislados:

```bash
docker compose up --build
```

El contenedor `api` espera automáticamente a que `db` supere su *healthcheck*, ejecuta migraciones (`alembic upgrade head`), aplica los datos semilla (`app.seed`) e inicia `uvicorn`.

---

## 🧪 Pruebas y Calidad de Código

```bash
# Ejecutar suite completa de pruebas unitarias e integración (102 tests)
poetry run pytest -v

# Verificar linter estricto con Ruff
poetry run ruff check .

# Verificar formateador de código
poetry run ruff format --check .

# Aplicar auto-correcciones de formato y linter
poetry run ruff check --fix . && poetry run ruff format .
```

---

## 📡 Tabla de Endpoints de la API

Todos los endpoints soportan la cabecera `X-User-Id: <uuid>` para asociar las operaciones al usuario autenticado (cae en `DEFAULT_USER_ID` si se omite).

| Método | Ruta | Descripción | Parámetros / Payload | Respuestas |
|---|---|---|---|---|
| `GET` | `/api/health` | Estado del servicio y conectividad DB | Ninguno | `200 OK` |
| `GET` | `/api/areas` | Listado de aspectos de vida del usuario | Ninguno | `200 OK` (`AreaRead[]`) |
| `POST` | `/api/areas` | Crear nuevo aspecto de vida | `AreaCreate` (`name`, `color`, `visible?`) | `201 Created` |
| `PUT` | `/api/areas/{id}` | Actualizar aspecto de vida | `id: UUID`, `AreaUpdate` parcial | `200 OK`, `404 Not Found` |
| `DELETE` | `/api/areas/{id}` | Eliminar aspecto de vida | `id: UUID` | `204 No Content`, `404 Not Found` |
| `GET` | `/api/activities` | Consulta consolidada para el grafo | `view=day\|week\|month\|global`, `date=YYYY-MM-DD` | `200 OK` (`ConsolidatedNode[]`) |
| `POST` | `/api/activities` | Registro con acumulación intra-día | `ActivityCreate` (`name`, `hours`, `temperature`, `date`, `notes?`, `area_ids`) | `201 Created` (nueva), `200 OK` (fusionada) |
| `PUT` | `/api/activities/{id}` | Actualizar actividad y áreas | `id: UUID`, `ActivityUpdate` parcial | `200 OK`, `404 Not Found`, `409 Conflict` |
| `DELETE` | `/api/activities/{id}` | Eliminar actividad (cascada a links) | `id: UUID` | `204 No Content`, `404 Not Found` |

---

## 📁 Estructura del Backend

```
backend/
├── app/
│   ├── config.py            # Configuración pydantic-settings
│   ├── database.py          # Motor AsyncEngine y session dependency
│   ├── deps.py              # Inyección de identidad (UserIdDep)
│   ├── main.py              # Aplicación FastAPI, CORS, middlewares y handlers
│   ├── models/              # Modelos SQLModel (User, LifeArea, Activity, links)
│   ├── schemas/             # Pydantic schemas (AreaCreate, ActivityRead, ConsolidatedNode)
│   ├── services/            # Lógica matemática (accumulator.py, aggregator.py)
│   └── routers/             # Rutas modulares (activities.py, areas.py)
├── migrations/              # Control de versiones de base de datos con Alembic
├── tests/                   # Suite de pruebas unitarias e integración con pytest
├── Dockerfile               # Imagen multi-stage en python:3.12-slim
├── docker-compose.yml       # Orquestación de servicios PostgreSQL y FastAPI
├── entrypoint.sh            # Script de inicialización con migraciones automáticas
└── pyproject.toml           # Dependencias Poetry y configuración de Ruff / Pytest
```
