import { Activity, LifeArea } from '../types';

export const STORAGE_KEYS = {
  ACTIVITIES: 'sharink_activities_v1',
  AREAS: 'sharink_areas_v1',
};

export const INITIAL_AREAS: LifeArea[] = [
  { id: 'area-work', name: 'Trabajo y Carrera', color: '#6366f1', visible: true },
  { id: 'area-health', name: 'Salud y Fitness', color: '#10b981', visible: true },
  { id: 'area-growth', name: 'Desarrollo Personal', color: '#38bdf8', visible: true },
  { id: 'area-social', name: 'Familia y Social', color: '#ec4899', visible: true },
  { id: 'area-leisure', name: 'Ocio y Desconexión', color: '#f59e0b', visible: true },
];

export function getTodayDateString(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

export function getInitialActivities(): Activity[] {
  const today = getTodayDateString();
  const now = Date.now();

  return [
    {
      id: 'act-1',
      name: 'Programación Deep Work',
      hours: 4.5,
      areaIds: ['area-work', 'area-growth'],
      temperature: 4.5, // High blue
      date: today,
      notes: 'Desarrollo del motor de grafo en Sharink',
      createdAt: now - 3600000 * 5,
    },
    {
      id: 'act-2',
      name: 'Entrenamiento de Fuerza / Gym',
      hours: 1.5,
      areaIds: ['area-health'],
      temperature: 5.0, // Pure blue
      date: today,
      notes: 'Rutina de pierna y movilidad',
      createdAt: now - 3600000 * 4,
    },
    {
      id: 'act-3',
      name: 'Reunión de Sincronización Innecesaria',
      hours: 2.0,
      areaIds: ['area-work'],
      temperature: -3.5, // Orange/Red
      date: today,
      notes: 'Pudo haber sido un mensaje',
      createdAt: now - 3600000 * 3,
    },
    {
      id: 'act-4',
      name: 'Lectura de Filosofía / Hábitos',
      hours: 1.0,
      areaIds: ['area-growth'],
      temperature: 3.5, // Cyan/Blue
      date: today,
      notes: 'Capítulo sobre sistemas vs metas',
      createdAt: now - 3600000 * 2,
    },
    {
      id: 'act-5',
      name: 'Doomscrolling en Redes Sociales',
      hours: 2.5,
      areaIds: ['area-leisure'],
      temperature: -4.8, // Deep red
      date: today,
      notes: 'Pérdida de foco y procrastinación',
      createdAt: now - 3600000,
    },
    {
      id: 'act-6',
      name: 'Almuerzo y Charla con Amigos',
      hours: 2.0,
      areaIds: ['area-social', 'area-health'],
      temperature: 3.8, // Cyan/Blue
      date: today,
      notes: 'Comida balanceada y desconexión social',
      createdAt: now,
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
    console.error('Error loading activities from localStorage', e);
    return getInitialActivities();
  }
}

export function saveActivities(activities: Activity[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(activities));
  } catch (e) {
    console.error('Error saving activities to localStorage', e);
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
    console.error('Error loading areas from localStorage', e);
    return INITIAL_AREAS;
  }
}

export function saveAreas(areas: LifeArea[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.AREAS, JSON.stringify(areas));
  } catch (e) {
    console.error('Error saving areas to localStorage', e);
  }
}
