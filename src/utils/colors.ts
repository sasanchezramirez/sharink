import { interpolateRgb } from 'd3';

/**
 * Warm, vibrant, natural chromatic spectrum for the EM scale (no cold/washed-out grays):
 * +5: Warm Royal Indigo / Violet (#6366f1)
 * +3: Rich Cobalt / Azure (#3b82f6)
 * +1.5: Vivid Turquoise / Cyan (#06b6d4)
 *  0: Lush Spring Emerald / Green (#10b981)
 * -1.5: Warm Golden Amber (#f59e0b)
 * -3: Vivid Warm Tangerine (#f97316)
 * -5: Warm Radiant Crimson / Coral (#f43f5e)
 */
export function getTemperatureColor(score: number): string {
  const clamped = Math.max(-5, Math.min(5, score));
  const norm = (clamped + 5) / 10; // 0 (Red) to 1 (Blue/Violet)

  if (norm <= 0.25) {
    // -5 to -2.5: Crimson to Tangerine
    return interpolateRgb('#f43f5e', '#f97316')(norm / 0.25);
  } else if (norm <= 0.5) {
    // -2.5 to 0: Tangerine to Lush Emerald
    return interpolateRgb('#f97316', '#10b981')((norm - 0.25) / 0.25);
  } else if (norm <= 0.75) {
    // 0 to +2.5: Emerald to Vibrant Cyan
    return interpolateRgb('#10b981', '#06b6d4')((norm - 0.5) / 0.25);
  } else {
    // +2.5 to +5: Cyan to Warm Royal Indigo
    return interpolateRgb('#06b6d4', '#6366f1')((norm - 0.75) / 0.25);
  }
}

export function getTemperatureLabel(score: number): { label: string; textClass: string } {
  if (score >= 3.5) return { label: 'Flujo / Inspirador (+5)', textClass: 'text-indigo-400' };
  if (score >= 1.5) return { label: 'Energizante (+2)', textClass: 'text-cyan-400' };
  if (score >= -1.4) return { label: 'Neutro / Armónico (0)', textClass: 'text-emerald-400' };
  if (score >= -3.4) return { label: 'Desgaste / Fricción (-2)', textClass: 'text-amber-400' };
  return { label: 'Drenante / Negativo (-5)', textClass: 'text-rose-400' };
}

export const DEFAULT_AREA_COLORS = [
  '#6366f1', // Royal Indigo
  '#10b981', // Spring Emerald
  '#f59e0b', // Warm Amber
  '#ec4899', // Radiant Pink
  '#06b6d4', // Turquoise
  '#f97316', // Warm Tangerine
  '#8b5cf6', // Violet
];
