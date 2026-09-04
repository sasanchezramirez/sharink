import { Activity, LifeArea } from '../types';

export const STORAGE_KEYS = {
  ACTIVITIES: 'sharink_activities_v2', // v2 to cleanly load the new dataset
  AREAS: 'sharink_areas_v2',
};

export const INITIAL_AREAS: LifeArea[] = [
  { id: 'area-work', name: 'Trabajo & Carrera', color: '#6366f1', visible: true },
  { id: 'area-health', name: 'Salud & Cuerpo', color: '#10b981', visible: true },
  { id: 'area-growth', name: 'Desarrollo & Mente', color: '#38bdf8', visible: true },
  { id: 'area-social', name: 'Vínculos & Familia', color: '#ec4899', visible: true },
  { id: 'area-leisure', name: 'Ocio & Calma', color: '#f59e0b', visible: true },
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
      name: 'Deep Work Arquitectura',
      hours: 4.0,
      areaIds: ['area-work'],
      temperature: 4.5,
      date: w[0],
      notes: 'Modelado de la base de datos y flujos principales',
      createdAt: baseTime + 1000,
    },
    {
      id: 'act-2',
      name: 'Entrenamiento de Fuerza',
      hours: 1.5,
      areaIds: ['area-health'],
      temperature: 4.8,
      date: w[0],
      notes: 'Sentadillas pesadas y movilidad de hombros',
      createdAt: baseTime + 2000,
    },
    {
      id: 'act-3',
      name: 'Standup & Tareas Menores',
      hours: 1.5,
      areaIds: ['area-work'],
      temperature: -2.0,
      date: w[0],
      notes: 'Interrupciones continuas en mensajería',
      createdAt: baseTime + 3000,
    },

    // MARTES
    {
      id: 'act-4',
      name: 'Prototipado UX & Wireframes',
      hours: 3.5,
      areaIds: ['area-work', 'area-growth'],
      temperature: 4.0,
      date: w[1],
      notes: 'Exploración de la interfaz espacial del grafo',
      createdAt: baseTime + 4000,
    },
    {
      id: 'act-5',
      name: 'Corrida Matutina 5k',
      hours: 0.8,
      areaIds: ['area-health'],
      temperature: 5.0,
      date: w[1],
      notes: 'Paz mental al amanecer',
      createdAt: baseTime + 5000,
    },
    {
      id: 'act-6',
      name: 'Doomscrolling en Redes',
      hours: 2.0,
      areaIds: ['area-leisure'],
      temperature: -4.5,
      date: w[1],
      notes: 'Pérdida de tiempo en shorts y feeds algorítmicos',
      createdAt: baseTime + 6000,
    },

    // MIÉRCOLES
    {
      id: 'act-7',
      name: 'Refactor Backend & APIs',
      hours: 5.0,
      areaIds: ['area-work'],
      temperature: 3.5,
      date: w[2],
      notes: 'Optimización de endpoints y consultas SQL',
      createdAt: baseTime + 7000,
    },
    {
      id: 'act-8',
      name: 'Almuerzo con Colegas',
      hours: 1.5,
      areaIds: ['area-social', 'area-health'],
      temperature: 4.0,
      date: w[2],
      notes: 'Comida fresca y conversación enriquecedora',
      createdAt: baseTime + 8000,
    },
    {
      id: 'act-9',
      name: 'Trámites Burocráticos',
      hours: 1.2,
      areaIds: ['area-work'],
      temperature: -3.8,
      date: w[2],
      notes: 'Facturación e informes fiscales engorrosos',
      createdAt: baseTime + 9000,
    },

    // JUEVES
    {
      id: 'act-10',
      name: 'Lectura de Filosofía & Hábitos',
      hours: 1.0,
      areaIds: ['area-growth'],
      temperature: 4.2,
      date: w[3],
      notes: 'Epicteto sobre el control de la atención',
      createdAt: baseTime + 10000,
    },
    {
      id: 'act-11',
      name: 'Debugging de Incidencia Crítica',
      hours: 3.0,
      areaIds: ['area-work'],
      temperature: -1.8,
      date: w[3],
      notes: 'Presión por caída temporal de servicio',
      createdAt: baseTime + 11000,
    },
    {
      id: 'act-12',
      name: 'Yoga & Meditación',
      hours: 0.7,
      areaIds: ['area-health', 'area-growth'],
      temperature: 4.5,
      date: w[3],
      notes: 'Respiración consciente y estiramientos profundos',
      createdAt: baseTime + 12000,
    },

    // VIERNES
    {
      id: 'act-13',
      name: 'Demo y Lanzamiento de Sprint',
      hours: 2.5,
      areaIds: ['area-work'],
      temperature: 3.8,
      date: w[4],
      notes: 'Feedback positivo del equipo sobre las nuevas features',
      createdAt: baseTime + 13000,
    },
    {
      id: 'act-14',
      name: 'Cena Familiar & Charla',
      hours: 3.0,
      areaIds: ['area-social'],
      temperature: 5.0,
      date: w[4],
      notes: 'Momento íntimo de conexión sin pantallas',
      createdAt: baseTime + 14000,
    },
    {
      id: 'act-15',
      name: 'Videojuegos / Desconexión',
      hours: 2.5,
      areaIds: ['area-leisure'],
      temperature: 2.0,
      date: w[4],
      notes: 'Partidas casuales para despejar la cabeza',
      createdAt: baseTime + 15000,
    },

    // SÁBADO
    {
      id: 'act-16',
      name: 'Senderismo en Montaña',
      hours: 4.0,
      areaIds: ['area-health', 'area-leisure'],
      temperature: 5.0,
      date: w[5],
      notes: 'Contacto total con la naturaleza y aire puro',
      createdAt: baseTime + 16000,
    },
    {
      id: 'act-17',
      name: 'Práctica de Guitarra',
      hours: 1.5,
      areaIds: ['area-growth', 'area-leisure'],
      temperature: 4.0,
      date: w[5],
      notes: 'Aprendiendo progresiones de jazz y arpegios',
      createdAt: baseTime + 17000,
    },
    {
      id: 'act-18',
      name: 'Discusión Imprevista',
      hours: 1.0,
      areaIds: ['area-social'],
      temperature: -4.2,
      date: w[5],
      notes: 'Malentendido que drenó energía',
      createdAt: baseTime + 18000,
    },

    // DOMINGO
    {
      id: 'act-19',
      name: 'Planificación Semanal & Journaling',
      hours: 1.5,
      areaIds: ['area-growth', 'area-work'],
      temperature: 3.8,
      date: w[6],
      notes: 'Revisión de objetivos y balance del tiempo',
      createdAt: baseTime + 19000,
    },
    {
      id: 'act-20',
      name: 'Cine & Descanso Total',
      hours: 2.5,
      areaIds: ['area-leisure'],
      temperature: 3.0,
      date: w[6],
      notes: 'Película clásica y té caliente',
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
