# Sharink API

Backend de Sharink: FastAPI + SQLModel + PostgreSQL.

Especificación completa en [`../BACKEND_SPEC.md`](../BACKEND_SPEC.md).
El plan de implementación tarea por tarea está en la sección 6 de ese documento.

---

## Requisitos

- [mise](https://mise.jdx.dev) — instala y pinea el toolchain automáticamente
- PostgreSQL 16+ (local o vía Docker)

El toolchain está declarado en `mise.toml`, así que no depende del Python del sistema:

| Herramienta | Versión |
|---|---|
| Python | 3.12.14 |
| Poetry | 2.4.3 |

## Arranque en desarrollo

```bash
# 1. Toolchain + dependencias
mise install          # instala Python 3.12.14 y Poetry 2.4.3
poetry install        # crea backend/.venv e instala dependencias

# 2. Variables de entorno (T03)
cp .env.example .env

# 3. Base de datos (T04)
docker compose up -d db

# 4. Migraciones y seed (T09, T10)
poetry run alembic upgrade head
poetry run python -m app.seed

# 5. Servidor (T16)
poetry run uvicorn app.main:app --reload
```

La documentación interactiva quedará en `http://localhost:8000/docs`.

## Comandos frecuentes

```bash
poetry run pytest              # tests
poetry run ruff check .        # lint
poetry run ruff format .       # formato
poetry add <paquete>           # nueva dependencia de producción
poetry add --group dev <paq>   # nueva dependencia de desarrollo
```

> El entorno virtual se crea **dentro del proyecto** (`backend/.venv`) gracias a
> `virtualenvs.in-project = true`. `poetry.lock` se versiona en git para builds
> deterministas; `.venv/` y `poetry.toml` están ignorados.

## Estructura

```
backend/
├── app/
│   ├── main.py         # Instancia FastAPI, CORS, middlewares
│   ├── config.py       # Variables de entorno
│   ├── database.py     # AsyncEngine + get_session()
│   ├── models/         # SQLModel (User, Activity, LifeArea, links)
│   ├── schemas/        # Pydantic (Create / Read / ConsolidatedNode)
│   ├── services/       # accumulator.py, aggregator.py
│   └── routers/        # activities.py, areas.py
└── tests/
```

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/health` | Healthcheck de API y base de datos |
| `POST` | `/api/activities` | Registro con acumulación intra-día |
| `GET` | `/api/activities` | Consulta agregada (`view=day\|week\|month\|global`) |
| `PUT` | `/api/activities/{id}` | Actualización |
| `DELETE` | `/api/activities/{id}` | Eliminación |
| `GET` | `/api/areas` | Listado de aspectos de vida |
| `POST` | `/api/areas` | Creación de aspecto de vida |
