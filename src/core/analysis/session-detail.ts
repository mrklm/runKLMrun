import type { Sample } from '../../types/session';

export const sessionHref = (id: string) => `#/seance/${encodeURIComponent(id)}`;
export function sessionIdFromPath(path: string): string | undefined {
  const match = /^\/seance\/([^/]+)$/.exec(path);
  try { return match ? decodeURIComponent(match[1]) || undefined : undefined; } catch { return undefined; }
}
export function speedToPace(value: number | null): number | null {
  const result = value !== null && Number.isFinite(value) && value > 0 ? 1000 / value : null;
  return result !== null && Number.isFinite(result) ? result : null;
}
/** Copies triées ; les temps invalides créent une rupture au point valide suivant. */
export function prepareSeries(samples: readonly Sample[] = [], pace = false): Sample[] {
  let gap = false;
  const result: Sample[] = [];
  for (const sample of samples) {
    if (!Number.isFinite(sample.timeSeconds) || sample.timeSeconds < 0) { gap = true; continue; }
    if (gap) result.push({ timeSeconds: sample.timeSeconds, value: null });
    gap = false;
    const value = pace ? speedToPace(sample.value) : sample.value !== null && Number.isFinite(sample.value) ? sample.value : null;
    result.push({ timeSeconds: sample.timeSeconds, value });
  }
  return result.sort((a, b) => a.timeSeconds - b.timeSeconds);
}
/** Min/max par bloc, avec toutes les ruptures et leurs voisins. Budget souple :
 * une série très fragmentée conserve plus de points pour ne jamais relier ses trous. */
export function reduceSeries(points: readonly Sample[], target = 800): Sample[] {
  if (points.length <= target) return points.map(p => ({ ...p }));
  const keep = new Set<number>([0, points.length - 1]);
  const size = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(target / 2))));
  for (let start = 0; start < points.length; start += size) {
    let min = -1, max = -1;
    for (let i = start; i < Math.min(start + size, points.length); i++) {
      const v = points[i].value;
      if (v === null) {
        if (i === 0 || points[i - 1].value !== null) { keep.add(i); if (i) keep.add(i - 1); }
        if (i === points.length - 1 || points[i + 1].value !== null) { keep.add(i); if (i + 1 < points.length) keep.add(i + 1); }
      } else {
        if (min < 0 || v < points[min].value!) min = i;
        if (max < 0 || v > points[max].value!) max = i;
      }
    }
    if (min >= 0) keep.add(min);
    if (max >= 0) keep.add(max);
  }
  return [...keep].sort((a, b) => a - b).map(i => ({ ...points[i] }));
}
