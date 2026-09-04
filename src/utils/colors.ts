import { interpolateRgb } from 'd3';

export interface NodeShading {
  coreColor: string;
  midColor: string;
  darkColor: string;
  glowColor: string;
}

/**
 * Optical Electromagnetic spectrum color mapping.
 * Generates 3 stops for realistic depth:
 * 0% Luminous Core -> 70% Body Tone -> 100% Deep Edge
 */
export function getNodeShading(score: number): NodeShading {
  const clamped = Math.max(-5, Math.min(5, score));
  const norm = (clamped + 5) / 10; // 0 (Red) to 1 (Blue)

  // Mid tone interpolation
  let midColor: string;
  if (norm <= 0.25) {
    midColor = interpolateRgb('#e11d48', '#ea580c')(norm / 0.25);
  } else if (norm <= 0.5) {
    midColor = interpolateRgb('#ea580c', '#64748b')((norm - 0.25) / 0.25);
  } else if (norm <= 0.75) {
    midColor = interpolateRgb('#64748b', '#0ea5e9')((norm - 0.5) / 0.25);
  } else {
    midColor = interpolateRgb('#0ea5e9', '#4f46e5')((norm - 0.75) / 0.25);
  }

  // Core color (illuminated highlight center)
  let coreColor: string;
  if (norm <= 0.3) {
    coreColor = '#fda4af'; // soft rose
  } else if (norm <= 0.6) {
    coreColor = '#94a3b8'; // soft slate
  } else {
    coreColor = '#93c5fd'; // soft sky blue
  }

  // Dark perimeter edge (blends into #08090d)
  const darkColor = '#0b0e14';

  return {
    coreColor,
    midColor,
    darkColor,
    glowColor: midColor,
  };
}

export function getTemperatureColor(score: number): string {
  return getNodeShading(score).midColor;
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
  '#10b981', // Emerald
  '#0ea5e9', // Sky
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#14b8a6', // Teal
];
