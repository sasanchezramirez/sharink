import asyncio
from datetime import date, timedelta
import uuid

from sqlalchemy.orm import selectinload
from sqlmodel import col, delete, func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import get_settings
from app.database import async_session_maker, engine
from app.models import Activity, LifeArea, User

settings = get_settings()
DEMO_USER_ID = settings.DEFAULT_USER_ID
DEMO_EMAIL = "demo@sharink.app"

AREA_SEEDS = [
    {
        "slug": "area-work",
        "name": "Trabajo & Carrera",
        "color": "#0284c7",
        "visible": True,
    },
    {
        "slug": "area-health",
        "name": "Salud & Cuerpo",
        "color": "#22c55e",
        "visible": True,
    },
    {
        "slug": "area-growth",
        "name": "Desarrollo & Mente",
        "color": "#eab308",
        "visible": True,
    },
    {
        "slug": "area-social",
        "name": "Vínculos & Familia",
        "color": "#ec4899",
        "visible": True,
    },
    {
        "slug": "area-leisure",
        "name": "Ocio & Calma",
        "color": "#f97316",
        "visible": True,
    },
]

ACTIVITY_DEFINITIONS = [
    # LUNES
    {
        "day_idx": 0,
        "name": "Cocina & Nutrición",
        "hours": 1.0,
        "temperature": 4.2,
        "areas": ["area-health"],
        "notes": "Preparación de comidas saludables para la semana",
    },
    {
        "day_idx": 0,
        "name": "Deep Work Arquitectura",
        "hours": 4.0,
        "temperature": 4.8,
        "areas": ["area-work"],
        "notes": "Diseño técnico y contratos de API",
    },
    {
        "day_idx": 0,
        "name": "Entrenamiento de Fuerza",
        "hours": 1.5,
        "temperature": 4.5,
        "areas": ["area-health"],
        "notes": "Rutina de tren superior",
    },
    # MARTES
    {
        "day_idx": 1,
        "name": "Cocina & Nutrición",
        "hours": 1.0,
        "temperature": 4.0,
        "areas": ["area-health"],
        "notes": "Almuerzo balanceado en casa",
    },
    {
        "day_idx": 1,
        "name": "Corrida Matutina",
        "hours": 0.8,
        "temperature": 5.0,
        "areas": ["area-health"],
        "notes": "5k a ritmo constante",
    },
    {
        "day_idx": 1,
        "name": "Lectura & Filosofía",
        "hours": 1.5,
        "temperature": 4.0,
        "areas": ["area-growth"],
        "notes": "Reflexiones sobre estoicismo y atención",
    },
    # MIÉRCOLES
    {
        "day_idx": 2,
        "name": "Deep Work Arquitectura",
        "hours": 3.5,
        "temperature": 4.5,
        "areas": ["area-work"],
        "notes": "Implementación del modelo de agregación temporal",
    },
    {
        "day_idx": 2,
        "name": "Entrenamiento de Fuerza",
        "hours": 1.2,
        "temperature": 4.2,
        "areas": ["area-health"],
        "notes": "Piernas y movilidad",
    },
    {
        "day_idx": 2,
        "name": "Social & Amigos",
        "hours": 2.0,
        "temperature": 4.5,
        "areas": ["area-social"],
        "notes": "Charla y café con amigos de la universidad",
    },
    # JUEVES
    {
        "day_idx": 3,
        "name": "Cocina & Nutrición",
        "hours": 1.5,
        "temperature": 4.5,
        "areas": ["area-health"],
        "notes": "Cena elaborada y saludable",
    },
    {
        "day_idx": 3,
        "name": "Debugging & Soporte",
        "hours": 2.5,
        "temperature": -2.0,
        "areas": ["area-work"],
        "notes": "Resolución de bugs bloqueantes en producción",
    },
    {
        "day_idx": 3,
        "name": "Lectura & Filosofía",
        "hours": 1.0,
        "temperature": 4.2,
        "areas": ["area-growth"],
        "notes": "Capítulo sobre la gestión de la energía",
    },
    # VIERNES
    {
        "day_idx": 4,
        "name": "Deep Work Arquitectura",
        "hours": 3.0,
        "temperature": 4.0,
        "areas": ["area-work"],
        "notes": "Refactorización y testing unitario",
    },
    {
        "day_idx": 4,
        "name": "Cena Familiar",
        "hours": 3.0,
        "temperature": 5.0,
        "areas": ["area-social"],
        "notes": "Vínculo cálido y desconexión total del trabajo",
    },
    {
        "day_idx": 4,
        "name": "Videojuegos & Relax",
        "hours": 2.0,
        "temperature": 2.0,
        "areas": ["area-leisure"],
        "notes": "Sesión casual de juegos de estrategia",
    },
    # SÁBADO
    {
        "day_idx": 5,
        "name": "Corrida Matutina",
        "hours": 1.2,
        "temperature": 5.0,
        "areas": ["area-health"],
        "notes": "Ruta larga por el parque",
    },
    {
        "day_idx": 5,
        "name": "Guitarra & Creatividad",
        "hours": 1.5,
        "temperature": 4.2,
        "areas": ["area-growth", "area-leisure"],
        "notes": "Práctica de escalas y composición",
    },
    {
        "day_idx": 5,
        "name": "Procrastinación & Doomscroll",
        "hours": 2.0,
        "temperature": -4.5,
        "areas": ["area-leisure"],
        "notes": "Exceso de tiempo en feeds infinitos",
    },
    # DOMINGO
    {
        "day_idx": 6,
        "name": "Lectura & Filosofía",
        "hours": 2.0,
        "temperature": 4.5,
        "areas": ["area-growth"],
        "notes": "Cierre del libro y notas de síntesis",
    },
    {
        "day_idx": 6,
        "name": "Planificación Semanal",
        "hours": 1.5,
        "temperature": 3.8,
        "areas": ["area-work", "area-growth"],
        "notes": "Organización de prioridades de la próxima semana",
    },
]


def get_week_dates() -> list[date]:
    """Calculate Monday through Sunday dates for the current week."""
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    return [monday + timedelta(days=i) for i in range(7)]


async def seed_data(session: AsyncSession) -> int:
    """Idempotently seed demo user, life areas, and 20 weekly activities."""
    # 1. Upsert Demo User
    user_stmt = select(User).where(User.id == DEMO_USER_ID)
    user = (await session.exec(user_stmt)).first()
    if not user:
        user = User(id=DEMO_USER_ID, email=DEMO_EMAIL)
        session.add(user)
        await session.flush()

    # 2. Upsert Life Areas with deterministic UUIDs
    area_map: dict[str, LifeArea] = {}
    for area_def in AREA_SEEDS:
        area_id = uuid.uuid5(DEMO_USER_ID, area_def["slug"])
        area_stmt = select(LifeArea).where(LifeArea.id == area_id)
        area = (await session.exec(area_stmt)).first()
        if not area:
            area = LifeArea(
                id=area_id,
                user_id=DEMO_USER_ID,
                name=area_def["name"],
                color=area_def["color"],
                visible=area_def["visible"],
            )
            session.add(area)
        else:
            area.name = area_def["name"]
            area.color = area_def["color"]
            area.visible = area_def["visible"]
        area_map[area_def["slug"]] = area

    await session.flush()

    # 3. Upsert 20 Activities for current week
    week_dates = get_week_dates()
    seed_ids: set[uuid.UUID] = set()

    for act_def in ACTIVITY_DEFINITIONS:
        act_date = week_dates[act_def["day_idx"]]
        norm_name = act_def["name"].strip().lower()
        act_id = uuid.uuid5(DEMO_USER_ID, f"{act_def['day_idx']}:{norm_name}")
        seed_ids.add(act_id)

        linked_areas = [area_map[slug] for slug in act_def["areas"] if slug in area_map]

        act_stmt = (
            select(Activity)
            .where(Activity.id == act_id)
            .options(selectinload(Activity.areas))
        )
        activity = (await session.exec(act_stmt)).first()

        if not activity:
            activity = Activity(
                id=act_id,
                user_id=DEMO_USER_ID,
                name=act_def["name"],
                name_normalized=norm_name,
                hours=act_def["hours"],
                temperature=act_def["temperature"],
                date=act_date,
                notes=act_def["notes"],
                areas=linked_areas,
            )
            session.add(activity)
        else:
            activity.name = act_def["name"]
            activity.name_normalized = norm_name
            activity.hours = act_def["hours"]
            activity.temperature = act_def["temperature"]
            activity.date = act_date
            activity.notes = act_def["notes"]
            activity.areas = linked_areas

    await session.flush()

    # 4. Clean any legacy or extra activities for DEMO_USER_ID
    clean_stmt = delete(Activity).where(
        Activity.user_id == DEMO_USER_ID,
        ~col(Activity.id).in_(seed_ids),
    )
    await session.exec(clean_stmt)
    await session.commit()

    # 5. Return count of seeded activities
    count_stmt = select(func.count(col(Activity.id))).where(
        Activity.user_id == DEMO_USER_ID
    )
    count = (await session.exec(count_stmt)).one()
    return count


async def main() -> None:
    """Entrypoint for python -m app.seed."""
    async with async_session_maker() as session:
        total = await seed_data(session)
        print(f"Seed completed successfully! Total demo activities: {total}")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
