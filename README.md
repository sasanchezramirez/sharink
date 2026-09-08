# Sharink 🌌

Visualizador espacial interactivo de actividades diarias y distribución del tiempo basado en **grafos dinámicos con físicas orgánicas** (estilo Obsidian) y **mapa de calor vital en el espectro electromagnético** (-5 drenante a +5 flujo inspirador).

Arquitectura completa cliente-servidor con frontend en **React 18 + TypeScript + Vite + D3** y backend en **Python 3.12 + FastAPI + SQLModel + PostgreSQL**.

---

## 🌟 Características Principales

* **Grafo Dinámico con Físicas D3 (`d3-force`):** Simulación espacial fluida, colisiones orgánicas, atracción hacia centros de aspectos de vida y repulsión natural. Soporte completo de arrastre, zoom suave y recentrado.
* **Proporcionalidad Temporal:** Diámetro de cada nodo circular proporcional a las horas dedicadas a la actividad en el período seleccionado.
* **Agrupación por Aspectos de Vida (Hulls):** Regiones sombreadas orgánicas y convex hulls con degradados para actividades vinculadas a múltiples aspectos vitales.
* **Temperatura Vital (Espectro EM):** Mapeo continuo de color desde **Rojo (-5, drenante/negativo)** hasta **Azul (+5, positivo/flujo)** pasando por verde neutro (+0).
* **Motor Backend de Acumulación Intra-Día:** Múltiples registros de una misma actividad en el mismo día se fusionan automáticamente sumando horas, recalculando la temperatura ponderada y uniendo aspectos de vida.
* **Consolidación Multi-Período:** Vistas de **Día**, **Semana**, **Mes** y acumulado **Global** calculadas de forma determinista y eficiente mediante agregaciones SQL en PostgreSQL.
* **Aislamiento Multi-Usuario:** Toda la persistencia y consultas respetan el aislamiento de datos por usuario (`X-User-Id`).
* **Resiliencia y Estado Offline:** Manejo elegante de estados de carga cósmicos, reconexión con reintento y estado vacío en tema *Deep Space Obsidian*.

---

## 🛠️ Requisitos del Sistema

- **Node.js 20+** y **npm 10+**
- **Python 3.12+** y **Poetry 2.0+**
- **Docker** y **Docker Compose** (para PostgreSQL o arranque unificado)

---

## 🚀 Arranque Rápido de Todo el Sistema

### 1. Iniciar la Base de Datos y el Backend

```bash
# 1.1 Entrar al directorio del backend y configurar entorno
cd backend
cp .env.example .env

# 1.2 Iniciar la base de datos PostgreSQL
docker compose up -d db

# 1.3 Instalar dependencias, aplicar migraciones y cargar seed de desarrollo
poetry install
poetry run alembic upgrade head
poetry run python -m app.seed

# 1.4 Iniciar el servidor FastAPI
poetry run uvicorn app.main:app --reload --port 8000
```

> **Alternativa 100% Docker:** Puedes levantar PostgreSQL y la API en un solo comando con:
> `docker compose up --build` dentro de `backend/`.

La API estará lista en `http://localhost:8000/api` y su documentación OpenAPI interactiva en `http://localhost:8000/docs`.

---

### 2. Iniciar el Frontend Web

En otra terminal en la raíz del proyecto:

```bash
# 2.1 Configurar variables de entorno del frontend
cp .env.example .env.local

# 2.2 Instalar dependencias de Node
npm install

# 2.3 Iniciar servidor de desarrollo Vite
npm run dev
```

La aplicación web estará disponible en **`http://localhost:5173`**.

---

## 🧪 Verificación y Pruebas

### Backend (Python / Pytest / Ruff)

```bash
cd backend
poetry run pytest -v                 # 102 pruebas unitarias y de integración
poetry run ruff check .              # Linter estricto
poetry run ruff format --check .     # Formato de código
```

### Frontend (TypeScript / Vite)

```bash
npm run lint                         # Verificación de tipos TypeScript (tsc --noEmit)
npm run build                        # Compilación y bundling para producción
```

---

## 📡 Endpoints de la API Backend

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/health` | Chequeo de estado de la aplicación y la base de datos |
| `GET` | `/api/areas` | Listado de aspectos de vida del usuario |
| `POST` | `/api/areas` | Creación de nuevo aspecto de vida |
| `PUT` | `/api/areas/{id}` | Actualización de nombre, color o visibilidad |
| `DELETE` | `/api/areas/{id}` | Eliminación de aspecto de vida |
| `GET` | `/api/activities` | Nodos consolidados para el grafo (`view=day\|week\|month\|global&date=YYYY-MM-DD`) |
| `POST` | `/api/activities` | Creación o acumulación intra-día de actividades |
| `PUT` | `/api/activities/{id}` | Edición de actividad, horas, temperatura o áreas |
| `DELETE` | `/api/activities/{id}` | Eliminación de actividad y sus enlaces asociados |

---

## 📁 Estructura del Repositorio

```
sharink/
├── backend/                  # API FastAPI + SQLModel + PostgreSQL
│   ├── app/                  # Código fuente (routers, models, schemas, services)
│   ├── migrations/           # Migraciones de esquema Alembic
│   ├── tests/                # Suite de 102 tests automatizados con pytest
│   ├── Dockerfile            # Imagen multi-stage python:3.12-slim
│   ├── docker-compose.yml    # Servicios PostgreSQL 16 y FastAPI
│   └── README.md             # Guía detallada del backend
├── src/                      # Frontend React 18 + TypeScript + D3
│   ├── api/                  # Cliente HTTP tipado y schemas TypeScript
│   ├── components/           # GraphCanvas, TopBar, FloatingDock, EditActivityModal
│   ├── hooks/                # Hooks de estado remoto (useActivities, useAreas)
│   └── utils/                # Colores espectro EM y utilidades
├── .github/workflows/ci.yml  # Pipeline de Integración Continua (Backend + Frontend)
├── BACKEND_SPEC.md           # Especificación técnica exhaustiva del backend
└── SPEC.md                   # Especificación funcional original
```
