import { interpolateRgb } from 'd3';

/**
 * Escala cromática natural y cálida:
 * Rojo -> Naranja -> Amarillo -> Verde -> Azul (sin índigos ni tonos fríos)
 * 
 * -5.0: Rojo cálido intenso (#ef4444)
 * -2.5: Naranja brillante (#f97316)
 *  0.0: Amarillo cálido / solar (#eab308)
 * +2.5: Verde vivo (#22c55e)
 * +5.0: Azul puro (#0284c7)
 */
export function getTemperatureColor(score: number): string {
  const clamped = Math.max(-5, Math.min(5, score));
  const norm = (clamped + 5) / 10; // 0 (Rojo) a 1 (Azul)

  if (norm <= 0.25) {
    // -5 a -2.5: Rojo a Naranja
    return interpolateRgb('#ef4444', '#f97316')(norm / 0.25);
  } else if (norm <= 0.5) {
    // -2.5 a 0: Naranja a Amarillo
    return interpolateRgb('#f97316', '#eab308')((norm - 0.25) / 0.25);
  } else if (norm <= 0.75) {
    // 0 a +2.5: Amarillo a Verde
    return interpolateRgb('#eab308', '#22c55e')((norm - 0.5) / 0.25);
  } else {
    // +2.5 a +5: Verde a Azul
    return interpolateRgb('#22c55e', '#0284c7')((norm - 0.75) / 0.25);
  }
}

export function getTemperatureLabel(score: number): { label: string; textClass: string } {
  if (score >= 3.5) return { label: 'Flujo / Positivo (+5)', textClass: 'text-sky-400' };
  if (score >= 1.5) return { label: 'Energizante / Productivo (+2)', textClass: 'text-emerald-400' };
  if (score >= -1.4) return { label: 'Neutro / Balance (0)', textClass: 'text-yellow-400' };
  if (score >= -3.4) return { label: 'Fricción / Desgaste (-2)', textClass: 'text-orange-400' };
  return { label: 'Drenante / Negativo (-5)', textClass: 'text-rose-400' };
}

export const DEFAULT_AREA_COLORS = [
  '#0284c7', // Azul puro
  '#22c55e', // Verde vivo
  '#eab308', // Amarillo cálido
  '#f97316', // Naranja
  '#ef4444', // Rojo
  '#14b8a6', // Teal
  '#ec4899', // Rosa
];
