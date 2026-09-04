# Especificación de Arquitectura Backend: Sharink API (Python + PostgreSQL)

**Documento:** `BACKEND_SPEC.md`  
**Proyecto:** Sharink  
**Stack Backend:** Python 3.11+ / FastAPI / SQLModel (SQLAlchemy 2.0 + Pydantic) / PostgreSQL  
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
├── requirements.txt         # fastapi, uvicorn, sqlmodel, asyncpg, psycopg2-binary, pydantic
└── README.md
```

---

## 6. Próximos Pasos para la Implementación

1. Crear el directorio `Projects/sharink/backend`.
2. Configurar el entorno virtual de Python y `requirements.txt`.
3. Crear los modelos de datos SQLModel y el motor de conexión a PostgreSQL.
4. Implementar los servicios de **Acumulación Intra-Día** y **Agregación por Rango Temporal**.
5. Conectar el cliente de React al backend mediante un cliente API ligero (`src/api/client.ts`).
