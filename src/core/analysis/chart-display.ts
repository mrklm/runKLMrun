import type { Sample } from '../../types/session';
export type ChartMetric = 'heartRate' | 'pace' | 'altitude' | 'cadence';
export function compactTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '—';
  const s = Math.round(value), hours = Math.floor(s / 3600), minutes = Math.floor(s / 60) % 60;
  return `${hours ? `${hours}:` : ''}${String(minutes).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
export function paceLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const s = Math.round(seconds); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export function chartScale(samples: readonly Sample[], metric: ChartMetric, full = false): { domain: [number, number]; excluded: number; reversed: boolean } {
  const values = samples.flatMap(p => p.value !== null && Number.isFinite(p.value) ? [p.value] : []).sort((a, b) => a - b);
  if (!values.length) return { domain: [0, 1], excluded: 0, reversed: metric === 'pace' };
  let low = values[0], high = values[values.length - 1];
  // Barrières de Tukey : distribution, jamais un seuil sportif. Minimum 8 observations.
  if (metric === 'pace' && !full && values.length >= 8) {
    const q = (p: number) => { const index = (values.length - 1) * p, i = Math.floor(index); return values[i] + (values[Math.ceil(index)] - values[i]) * (index - i); };
    const q1 = q(.25), q3 = q(.75), spread = q3 - q1;
    const central = values.filter(v => v >= q1 - 1.5 * spread && v <= q3 + 1.5 * spread);
    if (central.length) { low = central[0]; high = central[central.length - 1]; }
  }
  const margin = Math.max((high - low) * .08, metric === 'pace' ? 1 : .5);
  const domain: [number, number] = [metric === 'altitude' ? low - margin : Math.max(0, low - margin), high + margin];
  return { domain, excluded: values.filter(v => v < domain[0] || v > domain[1]).length, reversed: metric === 'pace' };
}
export function displaySeries(samples: readonly Sample[], domain: readonly [number, number]): Sample[] {
  return samples.map(p => ({ ...p, value: p.value !== null && (p.value < domain[0] || p.value > domain[1]) ? null : p.value }));
}
