import { interpolateRgb } from 'd3';

/**
 * Aesthetic Modern Color Palette for the EM Spectrum:
 * High-vibrancy, matte contemporary tones (no garish primary bucket colors).
 * +5: Deep Electric Indigo (#4f46e5)
 * +2.5: Clean Cyan (#06b6d4)
 *  0: Balanced Emerald/Slate (#10b981 / #64748b)
 * -2.5: Warm Amber (#f59e0b)
 * -5: Crimson Rose (#f43f5e)
 */
export function getTemperatureColor(score: number): string {
  const clamped = Math.max(-5, Math.min(5, score));
  const norm = (clamped + 5) / 10; // 0 (Red) to 1 (Blue)

  if (norm <= 0.25) {
    return interpolateRgb('#f43f5e', '#f97316')(norm / 0.25);
  } else if (norm <= 0.5) {
    return interpolateRgb('#f97316', '#10b981')((norm - 0.25) / 0.25);
  } else if (norm <= 0.75) {
    return interpolateRgb('#10b981', '#06b6d4')((norm - 0.5) / 0.25);
  } else {
    return interpolateRgb('#06b6d4', '#4f46e5')((norm - 0.75) / 0.25);
  }
}

export function getTemperatureLabel(score: number): { label: string; textClass: string } {
  if (score >= 3.5) return { label: 'Flujo / Trascendente (+5)', textClass: 'text-indigo-400' };
  if (score >= 1.5) return { label: 'Energizante (+2)', textClass: 'text-cyan-400' };
  if (score >= -1.4) return { label: 'Neutro / Funcional (0)', textClass: 'text-emerald-400' };
  if (score >= -3.4) return { label: 'Fricción / Desgaste (-2)', textClass: 'text-amber-400' };
  return { label: 'Drenante / Negativo (-5)', textClass: 'text-rose-400' };
}

export const DEFAULT_AREA_COLORS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#0ea5e9', // Sky
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#14b8a6', // Teal
];
