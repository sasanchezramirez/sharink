import { SimulationNodeDatum } from 'd3';

export type TemperatureScore = number; // -5 (Extremely Negative / Red) to +5 (Extremely Positive / Blue)

export interface LifeArea {
  id: string;
  name: string;
  color: string; // Hex color
  visible: boolean;
}

export interface Activity {
  id: string;
  name: string;
  hours: number;
  areaIds: string[]; // 1 or more areas (for intersections)
  temperature: TemperatureScore;
  date: string; // ISO date YYYY-MM-DD
  notes?: string;
  createdAt: number;
}

export type ViewMode = 'day' | 'week' | 'month' | 'global';

export interface ViewportSettings {
  viewMode: ViewMode;
  selectedDate: string; // YYYY-MM-DD
  showLabels: boolean;
  showAreaHulls: boolean;
  activeAreaFilters: string[]; // empty means all visible
}

// Node used in D3 Simulation
export interface ActivityNode extends SimulationNodeDatum {
  id: string;
  activity: Activity;
  radius: number;
  color: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}
