import { Activity, LifeArea } from '../types';

export const STORAGE_KEYS = {
  ACTIVITIES: 'sharink_activities_v3', // v3 to load the new interconnected dataset
  AREAS: 'sharink_areas_v3',
};

export const INITIAL_AREAS: LifeArea[] = [
  { id: 'area-work', name: 'Trabajo & Carrera', color: '#0284c7', visible: true },
  { id: 'area-health', name: 'Salud & Cuerpo', color: '#22c55e', visible: true },
  { id: 'area-growth', name: 'Desarrollo & Mente', color: '#eab308', visible: true },
  { id: 'area-social', name: 'Vínculos & Familia', color: '#ec4899', visible: true },
  { id: 'area-leisure', name: 'Ocio & Calma', color: '#f97316', visible: true },
];

export function getTodayDateString(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

// Compute Monday through Sunday dates for current week
export function getWeekDates(): string[] {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon...
  const distanceToMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - distanceToMonday);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export function getInitialActivities(): Activity[] {
  const w = getWeekDates();
  const baseTime = Date.now() - 7 * 86400000;

  return [
    // LUNES
    {
      id: 'act-1',
      name: 'Cocina & Nutrición',
      hours: 1.0,
      areaIds: ['area-health'],
      temperature: 4.2,
      date: w[0],
      notes: 'Preparación de comidas saludables para la semana',
      createdAt: baseTime + 1000,
    },
    {
      id: 'act-2',
      name: 'Deep Work Arquitectura',
      hours: 4.0,
      areaIds: ['area-work'],
      temperature: 4.8,
      date: w[0],
      notes: 'Diseño técnico y contratos de API',
      createdAt: baseTime + 2000,
    },
    {
      id: 'act-3',
      name: 'Entrenamiento de Fuerza',
      hours: 1.5,
      areaIds: ['area-health'],
      temperature: 4.5,
      date: w[0],
      notes: 'Rutina de tren superior',
      createdAt: baseTime + 3000,
    },

    // MARTES
    {
      id: 'act-4',
      name: 'Cocina & Nutrición',
      hours: 1.0,
      areaIds: ['area-health'],
      temperature: 4.0,
      date: w[1],
      notes: 'Almuerzo balanceado en casa',
      createdAt: baseTime + 4000,
    },
    {
      id: 'act-5',
      name: 'Corrida Matutina',
      hours: 0.8,
      areaIds: ['area-health'],
      temperature: 5.0,
      date: w[1],
      notes: '5k a ritmo constante',
      createdAt: baseTime + 5000,
    },
    {
      id: 'act-6',
      name: 'Lectura & Filosofía',
      hours: 1.5,
      areaIds: ['area-growth'],
      temperature: 4.0,
      date: w[1],
      notes: 'Reflexiones sobre estoicismo y atención',
      createdAt: baseTime + 6000,
    },

    // MIÉRCOLES
    {
      id: 'act-7',
      name: 'Deep Work Arquitectura',
      hours: 3.5,
      areaIds: ['area-work'],
      temperature: 4.5,
      date: w[2],
      notes: 'Implementación del modelo de agregación temporal',
      createdAt: baseTime + 7000,
    },
    {
      id: 'act-8',
      name: 'Entrenamiento de Fuerza',
      hours: 1.2,
      areaIds: ['area-health'],
      temperature: 4.2,
      date: w[2],
      notes: 'Piernas y movilidad',
      createdAt: baseTime + 8000,
    },
    {
      id: 'act-9',
      name: 'Social & Amigos',
      hours: 2.0,
      areaIds: ['area-social'],
      temperature: 4.5,
      date: w[2],
      notes: 'Charla y café con amigos de la universidad',
      createdAt: baseTime + 9000,
    },

    // JUEVES
    {
      id: 'act-10',
      name: 'Cocina & Nutrición',
      hours: 1.5,
      areaIds: ['area-health'],
      temperature: 4.5,
      date: w[3],
      notes: 'Cena elaborada y saludable',
      createdAt: baseTime + 10000,
    },
    {
      id: 'act-11',
      name: 'Debugging & Soporte',
      hours: 2.5,
      areaIds: ['area-work'],
      temperature: -2.0,
      date: w[3],
      notes: 'Resolución de bugs bloqueantes en producción',
      createdAt: baseTime + 11000,
    },
    {
      id: 'act-12',
      name: 'Lectura & Filosofía',
      hours: 1.0,
      areaIds: ['area-growth'],
      temperature: 4.2,
      date: w[3],
      notes: 'Capítulo sobre la gestión de la energía',
      createdAt: baseTime + 12000,
    },

    // VIERNES
    {
      id: 'act-13',
      name: 'Deep Work Arquitectura',
      hours: 3.0,
      areaIds: ['area-work'],
      temperature: 4.0,
      date: w[4],
      notes: 'Refactorización y testing unitario',
      createdAt: baseTime + 13000,
    },
    {
      id: 'act-14',
      name: 'Cena Familiar',
      hours: 3.0,
      areaIds: ['area-social'],
      temperature: 5.0,
      date: w[4],
      notes: 'Vínculo cálido y desconexión total del trabajo',
      createdAt: baseTime + 14000,
    },
    {
      id: 'act-15',
      name: 'Videojuegos & Relax',
      hours: 2.0,
      areaIds: ['area-leisure'],
      temperature: 2.0,
      date: w[4],
      notes: 'Sesión casual de juegos de estrategia',
      createdAt: baseTime + 15000,
    },

    // SÁBADO
    {
      id: 'act-16',
      name: 'Corrida Matutina',
      hours: 1.2,
      areaIds: ['area-health'],
      temperature: 5.0,
      date: w[5],
      notes: 'Ruta larga por el parque',
      createdAt: baseTime + 16000,
    },
    {
      id: 'act-17',
      name: 'Guitarra & Creatividad',
      hours: 1.5,
      areaIds: ['area-growth', 'area-leisure'],
      temperature: 4.2,
      date: w[5],
      notes: 'Práctica de escalas y composición',
      createdAt: baseTime + 17000,
    },
    {
      id: 'act-18',
      name: 'Procrastinación & Doomscroll',
      hours: 2.0,
      areaIds: ['area-leisure'],
      temperature: -4.5,
      date: w[5],
      notes: 'Exceso de tiempo en feeds infinitos',
      createdAt: baseTime + 18000,
    },

    // DOMINGO
    {
      id: 'act-19',
      name: 'Lectura & Filosofía',
      hours: 2.0,
      areaIds: ['area-growth'],
      temperature: 4.5,
      date: w[6],
      notes: 'Cierre del libro y notas de síntesis',
      createdAt: baseTime + 19000,
    },
    {
      id: 'act-20',
      name: 'Planificación Semanal',
      hours: 1.5,
      areaIds: ['area-work', 'area-growth'],
      temperature: 3.8,
      date: w[6],
      notes: 'Organización de prioridades de la próxima semana',
      createdAt: baseTime + 20000,
    },
  ];
}

export function loadActivities(): Activity[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVITIES);
    if (!raw) {
      const initial = getInitialActivities();
      saveActivities(initial);
      return initial;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading activities', e);
    return getInitialActivities();
  }
}

export function saveActivities(activities: Activity[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(activities));
  } catch (e) {
    console.error('Error saving activities', e);
  }
}

export function loadAreas(): LifeArea[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AREAS);
    if (!raw) {
      saveAreas(INITIAL_AREAS);
      return INITIAL_AREAS;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading areas', e);
    return INITIAL_AREAS;
  }
}

export function saveAreas(areas: LifeArea[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.AREAS, JSON.stringify(areas));
  } catch (e) {
    console.error('Error saving areas', e);
  }
}
