import { interpolateRgb } from 'd3';
import { ThemeMode } from '../context/ThemeContext';

/**
 * Electromagnetic-inspired Temperature Scale:
 * Refined, non-garish palette:
 * -5 (Negative / Draining): Muted Crimson (#e11d48)
 * -2.5 (Demanding): Warm Ochre (#d97706)
 *  0 (Neutral / Equilibrium): Sage / Slate (#64748b)
 * +2.5 (Engaging): Soft Teal (#14b8a6)
 * +5 (Positive / Flow): Deep Azure (#2563eb) to Cosmic Indigo (#4f46e5)
 */
export function getTemperatureColor(score: number, theme: ThemeMode = 'linear'): string {
  const clamped = Math.max(-5, Math.min(5, score));
  const norm = (clamped + 5) / 10; // 0 to 1

  if (theme === 'hacker') {
    // Hacker theme EM spectrum: Amber/Phosphor Red (-5) to Lime/Green/Cyan (+5)
    if (norm <= 0.5) {
      const t = norm / 0.5;
      return interpolateRgb('#ef4444', '#f59e0b')(t);
    } else {
      const t = (norm - 0.5) / 0.5;
      return interpolateRgb('#f59e0b', '#22c55e')(t);
    }
  }

  if (theme === 'editorial') {
    // Monochromatic / Architectural high-contrast precision
    if (norm <= 0.5) {
      const t = norm / 0.5;
      return interpolateRgb('#71717a', '#a1a1aa')(t);
    } else {
      const t = (norm - 0.5) / 0.5;
      return interpolateRgb('#a1a1aa', '#f4f4f5')(t);
    }
  }

  // Linear & Zen default palette
  if (norm <= 0.25) {
    const t = norm / 0.25;
    return interpolateRgb('#e11d48', '#ea580c')(t);
  } else if (norm <= 0.5) {
    const t = (norm - 0.25) / 0.25;
    return interpolateRgb('#ea580c', '#64748b')(t);
  } else if (norm <= 0.75) {
    const t = (norm - 0.5) / 0.25;
    return interpolateRgb('#64748b', '#0ea5e9')(t);
  } else {
    const t = (norm - 0.75) / 0.25;
    return interpolateRgb('#0ea5e9', '#6366f1')(t);
  }
}

export function getTemperatureLabel(score: number): { label: string; textClass: string } {
  if (score >= 3.5) return { label: 'Flujo / Trascendente (+5)', textClass: 'text-indigo-400' };
  if (score >= 1.5) return { label: 'Energizante (+2)', textClass: 'text-sky-400' };
  if (score >= -1.4) return { label: 'Neutro / Funcional (0)', textClass: 'text-slate-400' };
  if (score >= -3.4) return { label: 'Fricción / Desgaste (-2)', textClass: 'text-amber-400' };
  return { label: 'Drenante / Tóxico (-5)', textClass: 'text-rose-400' };
}

export const DEFAULT_AREA_COLORS = [
  '#6366f1', // Indigo
  '#0ea5e9', // Sky
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f43f5e', // Rose
];
