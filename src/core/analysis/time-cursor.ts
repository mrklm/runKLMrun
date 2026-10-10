import type { Sample } from '../../types/session';
export interface TimeIndex { points: readonly Sample[]; tolerance: number; gapLimit: number }
/** Séries déjà triées par prepareSeries. Préparation une seule fois par séance. */
export function createTimeIndex(points: readonly Sample[]): TimeIndex {
  const gaps: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const gap = points[i].timeSeconds - points[i - 1].timeSeconds;
    if (gap > 0 && Number.isFinite(gap)) gaps.push(gap);
  }
  gaps.sort((a, b) => a - b);
  const middle = Math.floor(gaps.length / 2);
  const interval = gaps.length ? (gaps[middle] + gaps[Math.floor((gaps.length - 1) / 2)]) / 2 : 0;
  return { points, tolerance: Math.min(5, interval / 2), gapLimit: Math.max(10, interval * 3) };
}
export function nearestMeasurement(index: TimeIndex, time: number): Sample | undefined {
  const { points, tolerance, gapLimit } = index;
  if (!Number.isFinite(time) || !points.length || time < points[0].timeSeconds || time > points[points.length - 1].timeSeconds) return undefined;
  let low = 0, high = points.length;
  while (low < high) { const mid = (low + high) >>> 1; if (points[mid].timeSeconds < time) low = mid + 1; else high = mid; }
  const right = points[low], left = points[low - 1];
  if (right?.timeSeconds === time) return right.value !== null && Number.isFinite(right.value) ? right : undefined;
  if (!left || !right || left.value === null || right.value === null || right.timeSeconds - left.timeSeconds > gapLimit) return undefined;
  const closest = time - left.timeSeconds <= right.timeSeconds - time ? left : right;
  return Number.isFinite(closest.value) && Math.abs(closest.timeSeconds - time) <= tolerance ? closest : undefined;
}
export type CursorState = { time: number; mode: 'hover' | 'pinned' } | null;
export type CursorAction = { type: 'hover' | 'select'; time: number } | { type: 'leave' } | { type: 'clear' };
export function cursorReducer(state: CursorState, action: CursorAction): CursorState {
  if (action.type === 'clear') return null;
  if (action.type === 'leave') return state?.mode === 'hover' ? null : state;
  if (!Number.isFinite(action.time) || action.time < 0) return state;
  const mode = action.type === 'select' ? 'pinned' : 'hover';
  return state && state.time === action.time && state.mode === mode ? state : { time: action.time, mode };
}
export function pointerTime(clientX: number, left: number, width: number, domain: readonly [number, number]): number | undefined {
  if (!Number.isFinite(clientX) || width <= 0) return undefined;
  return domain[0] + Math.max(0, Math.min(1, (clientX - left) / width)) * (domain[1] - domain[0]);
}
export function isTap(start: { x: number; y: number } | null, end: { x: number; y: number }): boolean {
  return start !== null && Math.hypot(end.x - start.x, end.y - start.y) <= 8;
}
