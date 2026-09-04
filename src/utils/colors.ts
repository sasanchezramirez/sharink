import { interpolateRgb } from 'd3';

/**
 * Electromagnetic-inspired Temperature Scale:
 * -5 (Negative): Intense Red / Infrared
 * -2.5: Orange
 *  0 (Neutral): Green / Lime
 * +2.5: Cyan
 * +5 (Positive): Deep Blue / Violet
 */
export function getTemperatureColor(score: number): string {
  // Clamp score between -5 and +5
  const clamped = Math.max(-5, Math.min(5, score));
  
  // Normalized to [0, 1]
  // 0 -> Red (-5)
  // 0.25 -> Orange (-2.5)
  // 0.5 -> Green/Lime (0)
  // 0.75 -> Cyan (+2.5)
  // 1.0 -> Blue/Violet (+5)
  const norm = (clamped + 5) / 10;

  if (norm <= 0.25) {
    const t = norm / 0.25;
    return interpolateRgb('#ef4444', '#f97316')(t);
  } else if (norm <= 0.5) {
    const t = (norm - 0.25) / 0.25;
    return interpolateRgb('#f97316', '#10b981')(t);
  } else if (norm <= 0.75) {
    const t = (norm - 0.5) / 0.25;
    return interpolateRgb('#10b981', '#06b6d4')(t);
  } else {
    const t = (norm - 0.75) / 0.25;
    return interpolateRgb('#06b6d4', '#3b82f6')(t);
  }
}

/**
 * Get human-readable description for temperature score
 */
export function getTemperatureLabel(score: number): { label: string; textClass: string } {
  if (score >= 3.5) return { label: 'Muy Positivo (Foco/Flujo)', textClass: 'text-blue-400' };
  if (score >= 1.5) return { label: 'Positivo', textClass: 'text-cyan-400' };
  if (score >= -1.4) return { label: 'Neutro / Necesario', textClass: 'text-emerald-400' };
  if (score >= -3.4) return { label: 'Desgastante / Negativo', textClass: 'text-amber-500' };
  return { label: 'Muy Tóxico / Drenante', textClass: 'text-rose-500' };
}

/**
 * Predefined palette for life areas
 */
export const DEFAULT_AREA_COLORS = [
  '#38bdf8', // Sky Blue
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#f43f5e', // Rose
];
