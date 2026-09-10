# 🚀 Plan de Despliegue: Sharink en Producción ($0 USD / Mes)

Plan maestro detallado paso a paso para el despliegue de **Sharink** con arquitectura orientada a uso personal exclusivo, alta disponibilidad, costo cero permanente y experiencia nativa en **Samsung Galaxy S24 Ultra** como **Progressive Web App (PWA)**.

> [!IMPORTANT]
> **Estrategia Multi-Proyecto en Base de Datos Única:**
> Para permitir que una sola instancia de PostgreSQL (en Neon.tech o Supabase) aloje múltiples proyectos sin interferencias ni conflictos, **todas las tablas, secuencias, llaves foráneas y el control de versiones de Alembic (`alembic_version`) operarán estrictamente dentro del esquema dedicado `sharink`** (en lugar de `public`).

---

## 🏗️ Arquitectura de Producción

```mermaid
flowchart TD
    subgraph Cliente ["Dispositivo Móvil"]
        S24["Samsung Galaxy S24 Ultra\n(PWA Standalone - 120Hz AMOLED)"]
    end

    subgraph FrontendHosting ["Vercel Edge Network ($0/mes)"]
        VercelSPA["React 18 + Vite SPA\n(HTTPS Automático, Brotli, CDN Global)"]
    end

    subgraph BackendHosting ["Google Cloud Run ($0/mes)"]
        CloudRun["FastAPI Container\n(Scale-to-Zero, 0-1 Instancias, 512MB RAM)"]
    end

    subgraph DatabaseHosting ["Neon.tech ($0/mes) - Multi-Project Single DB"]
        subgraph SchemaSharink ["PostgreSQL Schema: 'sharink'"]
            Tables["users, activities, life_areas, activity_areas"]
            AlembicVersion["alembic_version (Sharink)"]
        end
        subgraph OtherSchemas ["Otros Proyectos"]
            ProjectB["esquema: proyecto_b"]
            ProjectC["esquema: proyecto_c"]
        end
    end

    S24 -->|"1. Carga PWA e interfaz gráfica"| VercelSPA
    S24 -->|"2. API REST (/api/activities, /api/areas)"| CloudRun
    CloudRun -->|"3. asyncpg + SQLModel (search_path=sharink)"| SchemaSharink
```

---

## 📋 Resumen de Fases y Especificaciones Técnicas

| Fase | Título | Tipo de Tarea | Especificación Técnica Asociada |
|---|---|---|---|
| **Fase 1** | Aislamiento por Esquema `sharink` y Base de Datos Remota | Backend / BD / Alembic | `SPEC-DB-00` (Estrategia de Esquema), `SPEC-DB-01` (Alembic en Esquema), `SPEC-DB-02` (FastAPI/SQLModel), `SPEC-DB-03` (Migración Local), `SPEC-DB-04` (Export a Neon) |
| **Fase 2** | Adaptación y Despliegue del Backend en Cloud Run | Backend / Docker / Config | `SPEC-BACK-01` (Port), `SPEC-BACK-02` (CORS), `SPEC-BACK-03` (Deploy CLI) |
| **Fase 3** | Transformación en PWA y Despliegue Frontend en Vercel | Frontend / PWA / Vercel | `SPEC-FRONT-01` (Manifest), `SPEC-FRONT-02` (SW), `SPEC-FRONT-03` (Vercel) |
| **Fase 4** | Documentación del Proyecto | Documentación | `SPEC-DOCS-01` (Actualización de Specs y Readme) |
| **Fase 5** | Instalación y Verificación en Galaxy S24 Ultra | QA Móvil & Validación E2E | Guía de aceptación táctil y validación visual |

---

## 🔷 FASE 1: Base de Datos Serverless y Esquema Aislado `sharink`

### [SPEC-DB-00] Estrategia y DDL de Esquema Dedicado
**Objetivo:** Asegurar que ninguna tabla de Sharink se cree en el esquema `public`, permitiendo que coexista con cualquier otro proyecto sin peligro de colisión de nombres de tablas o conflictos de llaves foráneas.

*DDL base a aplicar en PostgreSQL:*
```sql
-- Creación idempotente del esquema dedicado
CREATE SCHEMA IF NOT EXISTS sharink;

-- Asegurar permisos si aplica
GRANT ALL ON SCHEMA sharink TO CURRENT_USER;
```

---

### [SPEC-DB-01] Configuración de Alembic para Esquema Aislado
**Problema:** Por defecto, Alembic crea la tabla `public.alembic_version`. Si otro proyecto en la misma BD ejecuta Alembic, sobrescribirá el hash de revisión y romperá las migraciones.  
**Solución:** Configurar `version_table_schema = "sharink"` y forzar el contexto de ejecución.

*Modificación en:* [`backend/migrations/env.py`](file:///home/santiago/Projects/sharink/backend/migrations/env.py)
```python
import asyncio
from logging.config import fileConfig
from alembic import context
from app.config import get_settings
import app.models
from sqlalchemy import pool, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlmodel import SQLModel

config = context.config
settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata

def do_run_migrations(connection: Connection) -> None:
    # 1. Crear el esquema si no existe y fijar search_path
    connection.execute(text("CREATE SCHEMA IF NOT EXISTS sharink;"))
    connection.execute(text("SET search_path TO sharink, public;"))

    # 2. Configurar Alembic para rastrear versiones DENTRO de sharink.alembic_version
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        version_table="alembic_version",
        version_table_schema="sharink",
        include_schemas=True,
    )

    with context.begin_transaction():
        context.run_migrations()

async def run_async_migrations() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = settings.DATABASE_URL

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()

def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())

if context.is_offline_mode():
    # En offline, indicar el esquema de la tabla de versiones
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        version_table="alembic_version",
        version_table_schema="sharink",
        include_schemas=True,
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    run_migrations_online()
```

---

### [SPEC-DB-02] Configuración de FastAPI / SQLAlchemy para Esquema `sharink`
**Objetivo:** Garantizar que todas las conexiones HTTP en runtime apunten por defecto a `search_path=sharink,public` y que el metadata de SQLModel asigne el esquema `sharink`.

1. *Modificación en:* [`backend/app/models/__init__.py`](file:///home/santiago/Projects/sharink/backend/app/models/__init__.py)
   ```python
   from sqlmodel import SQLModel
   from app.models.activity import Activity, ActivityAreaLink
   from app.models.area import LifeArea
   from app.models.user import User

   # Asignar explícitamente el esquema a todo el metadata del proyecto
   SQLModel.metadata.schema = "sharink"

   __all__ = [
       "Activity",
       "ActivityAreaLink",
       "LifeArea",
       "User",
   ]
   ```

2. *Modificación en:* [`backend/app/database.py`](file:///home/santiago/Projects/sharink/backend/app/database.py)
   ```python
   from collections.abc import AsyncGenerator
   from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
   from sqlmodel import SQLModel, text
   from sqlmodel.ext.asyncio.session import AsyncSession
   from app.config import get_settings

   settings = get_settings()

   # Inyectar search_path a nivel de conexión en PostgreSQL
   connect_args = {}
   if "postgresql" in settings.DATABASE_URL:
       connect_args["server_settings"] = {"search_path": "sharink,public"}

   engine = create_async_engine(
       settings.DATABASE_URL,
       echo=(settings.ENV == "dev"),
       pool_pre_ping=True,
       pool_size=3,
       max_overflow=2,
       pool_recycle=300,
       connect_args=connect_args,
   )

   async_session_maker = async_sessionmaker(
       bind=engine,
       class_=AsyncSession,
       expire_on_commit=False,
       autocommit=False,
       autoflush=False,
   )

   async def get_session() -> AsyncGenerator[AsyncSession, None]:
       async with async_session_maker() as session:
           yield session

   async def init_db() -> None:
       """Inicializa el esquema sharink y las tablas definidas."""
       async with engine.begin() as conn:
           await conn.execute(text("CREATE SCHEMA IF NOT EXISTS sharink;"))
           await conn.run_sync(SQLModel.metadata.create_all)

   async def close_db() -> None:
       await engine.dispose()
   ```

---

### [SPEC-DB-03] Script de Migración Local: De `public` a `sharink`
**Objetivo:** En tu contenedor Docker local actual, las tablas están en `public`. Este script las mueve de forma segura e instantánea al esquema `sharink` sin perder ningún registro.

*Script:* `backend/scripts/migrate_local_to_schema.py`
```python
"""Mueve las tablas del esquema public al esquema sharink en la BD local."""
import asyncio
from sqlmodel import text
from app.database import async_session_maker

QUERIES = [
    "CREATE SCHEMA IF NOT EXISTS sharink;",
    # Mover alembic_version si existe
    "DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'alembic_version') THEN ALTER TABLE public.alembic_version SET SCHEMA sharink; END IF; END $$;",
    # Mover tablas de aplicación
    "DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN ALTER TABLE public.users SET SCHEMA sharink; END IF; END $$;",
    "DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'life_areas') THEN ALTER TABLE public.life_areas SET SCHEMA sharink; END IF; END $$;",
    "DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activities') THEN ALTER TABLE public.activities SET SCHEMA sharink; END IF; END $$;",
    "DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_areas') THEN ALTER TABLE public.activity_areas SET SCHEMA sharink; END IF; END $$;",
]

async def move_to_sharink():
    async with async_session_maker() as session:
        for q in QUERIES:
            await session.exec(text(q))
        await session.commit()
    print(" Tablas y versiones movidas exitosamente al esquema 'sharink'.")

if __name__ == "__main__":
    asyncio.run(move_to_sharink())
```

---

### [SPEC-DB-04] Migración y Carga a la Base Remota (Neon.tech)
**Objetivo:** Crear el esquema `sharink` en Neon, aplicar migraciones y transferir los datos locales.

1. **Crear el proyecto en Neon.tech** y obtener la URL de conexión.
2. **Aplicar migraciones directamente en el esquema `sharink` de Neon:**
   ```bash
   cd backend
   DATABASE_URL="postgresql+asyncpg://<USUARIO>:<PASS>@<HOST_NEON>/<DB>?ssl=require" \
   poetry run alembic upgrade head
   ```
   *(Alembic creará `sharink.alembic_version` y todas las tablas en `sharink`)*.

3. **Transferir datos locales hacia el esquema remoto:**
   *Script:* `backend/scripts/migrate_data_to_remote.py`
   ```python
   """Copia todos los registros del esquema sharink local al esquema sharink remoto."""
   import asyncio
   import os
   import sys
   from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
   from sqlmodel import select
   from sqlmodel.ext.asyncio.session import AsyncSession
   from app.models import LifeArea, Activity, ActivityAreaLink, User

   LOCAL_URL = os.getenv("LOCAL_DATABASE_URL", "postgresql+asyncpg://sharink:sharink@localhost:5432/sharink")
   REMOTE_URL = os.getenv("REMOTE_DATABASE_URL")

   if not REMOTE_URL:
       print("ERROR: Define REMOTE_DATABASE_URL con la cadena de conexión a Neon")
       sys.exit(1)

   async def migrate():
       local_engine = create_async_engine(LOCAL_URL, connect_args={"server_settings": {"search_path": "sharink,public"}})
       remote_engine = create_async_engine(REMOTE_URL, connect_args={"server_settings": {"search_path": "sharink,public"}})

       LocalSession = async_sessionmaker(local_engine, class_=AsyncSession, expire_on_commit=False)
       RemoteSession = async_sessionmaker(remote_engine, class_=AsyncSession, expire_on_commit=False)

       async with LocalSession() as local_s, RemoteSession() as remote_s:
           print("Migrando Usuarios...")
           for u in (await local_s.exec(select(User))).all():
               await remote_s.merge(u)
           await remote_s.commit()

           print("Migrando Aspectos de Vida...")
           for a in (await local_s.exec(select(LifeArea))).all():
               await remote_s.merge(a)
           await remote_s.commit()

           print("Migrando Actividades...")
           for act in (await local_s.exec(select(Activity))).all():
               await remote_s.merge(act)
           await remote_s.commit()

           print("Migrando Relaciones Actividad-Área...")
           for link in (await local_s.exec(select(ActivityAreaLink))).all():
               await remote_s.merge(link)
           await remote_s.commit()

       print(" Datos transferidos a Neon en el esquema 'sharink'.")
       await local_engine.dispose()
       await remote_engine.dispose()

   if __name__ == "__main__":
       asyncio.run(migrate())
   ```

---

## 🔷 FASE 2: Backend en Google Cloud Run

### [SPEC-BACK-01] Adaptación de Puerto Dinámico en `entrypoint.sh`
*Modificación en:* [`backend/entrypoint.sh`](file:///home/santiago/Projects/sharink/backend/entrypoint.sh)
```bash
#!/bin/sh
set -e

echo "Applying database migrations to 'sharink' schema..."
alembic upgrade head

echo "Starting Uvicorn server on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
```

---

### [SPEC-BACK-02] Ajuste de CORS
*Modificación en:* [`backend/app/config.py`](file:///home/santiago/Projects/sharink/backend/app/config.py)
Permitir peticiones del frontend de Vercel y comodines en desarrollo:
```python
CORS_ORIGINS: str = "*"
```

---

### [SPEC-BACK-03] Comando de Despliegue en Cloud Run ($0/Mes)
```bash
cd backend
gcloud run deploy sharink-api \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 1 \
  --memory 512Mi \
  --cpu 1 \
  --set-env-vars="ENV=prod,DATABASE_URL=postgresql+asyncpg://<USUARIO>:<PASS>@<HOST_NEON>/<DB>?ssl=require,SECRET_KEY=<SECRET_KEY>,CORS_ORIGINS=*"
```

---

## 🔷 FASE 3: Frontend PWA y Despliegue en Vercel

### [SPEC-FRONT-01] Manifiesto Web PWA (`public/manifest.webmanifest`)
*Archivo:* `public/manifest.webmanifest`
```json
{
  "name": "Sharink",
  "short_name": "Sharink",
  "description": "Visualizador Espacial de Actividades y Tiempo Vital",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#0b0d13",
  "theme_color": "#0b0d13",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-maskable-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

---

### [SPEC-FRONT-02] Service Worker y Registro
1. *Archivo:* `public/sw.js`
   ```javascript
   const CACHE_NAME = 'sharink-v1';
   const STATIC_ASSETS = ['/', '/index.html', '/manifest.webmanifest'];

   self.addEventListener('install', (event) => {
     event.waitUntil(
       caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
     );
     self.skipWaiting();
   });

   self.addEventListener('activate', (event) => {
     event.waitUntil(
       caches.keys().then((keys) =>
         Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
       )
     );
     self.clients.claim();
   });

   self.addEventListener('fetch', (event) => {
     if (event.request.url.includes('/api/')) return;
     event.respondWith(
       caches.match(event.request).then((cached) => cached || fetch(event.request))
     );
   });
   ```

2. *Actualización en:* [`index.html`](file:///home/santiago/Projects/sharink/index.html)
   ```html
   <meta name="theme-color" content="#0b0d13" />
   <meta name="mobile-web-app-capable" content="yes" />
   <meta name="apple-mobile-web-app-capable" content="yes" />
   <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
   <link rel="manifest" href="/manifest.webmanifest" />
   <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
   <script>
     if ('serviceWorker' in navigator) {
       window.addEventListener('load', () => {
         navigator.serviceWorker.register('/sw.js');
       });
     }
   </script>
   ```

---

### [SPEC-FRONT-03] Configuración de Vercel (`vercel.json`)
*Archivo:* `vercel.json`
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" },
        { "key": "Content-Type", "value": "application/javascript" }
      ]
    },
    {
      "source": "/manifest.webmanifest",
      "headers": [
        { "key": "Content-Type", "value": "application/manifest+json" }
      ]
    }
  ]
}
```

---

## 🔷 FASE 4: Documentación del Proyecto

### [SPEC-DOCS-01] Actualización Documental de la Arquitectura
**Objetivo:** Reflejar en la documentación técnica la estrategia multi-proyecto de PostgreSQL.

1. **[`README.md`](file:///home/santiago/Projects/sharink/README.md):**
   * Añadir sección de *Arquitectura de Base de Datos y Esquema `sharink`*.
   * Documentar cómo configurar `search_path=sharink,public`.
2. **[`backend/README.md`](file:///home/santiago/Projects/sharink/backend/README.md):**
   * Documentar el aislamiento de migraciones Alembic (`version_table_schema="sharink"`).
3. **[`BACKEND_SPEC.md`](file:///home/santiago/Projects/sharink/BACKEND_SPEC.md):**
   * Actualizar el diagrama ER indicando `sharink.users`, `sharink.activities`, `sharink.life_areas`, `sharink.activity_areas`.

---

## 🔷 FASE 5: Instalación y Validación en Samsung Galaxy S24 Ultra

1. **Acceso web:** Abrir el enlace de Vercel en Chrome o Samsung Internet.
2. **Instalación:** Pulsar **"Instalar aplicación"** / **"Añadir a inicio"**.
3. **Experiencia Standalone:** Abrir desde el ícono de la app; validar pantalla completa sin barra de navegación, fondo `#0b0d13` nativo, soporte multitáctil (pinch/drag) y sincronización con el esquema `sharink` en Neon.
