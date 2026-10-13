import type { Sample } from '../../types/session';
export interface AscentEstimate { method: 'hysteresis-3m-v1'; quality: 'complete' | 'partial'; meters: number }
/** Seuil de retournement de 3 m : les oscillations inférieures sont ignorées.
 * Aucun raccord entre segments ; zéro signifie aucune montée détectée, pas terrain plat certifié.
 */
export function estimateAscent(samples: readonly Sample[] | undefined): AscentEstimate | undefined {
  if (!samples?.length) return undefined;
  let total = 0, pairs = 0, partial = false;
  let previousTime: number | undefined, anchor: number | undefined, peak = 0, rising = false, count = 0;
  const finish = () => { if (rising) total += peak - anchor!; if (count === 1) partial = true; anchor = undefined; rising = false; count = 0; previousTime = undefined; };
  for (const sample of samples) {
    if (sample.value === null || !Number.isFinite(sample.value) || !Number.isFinite(sample.timeSeconds) || sample.timeSeconds < 0) { partial = true; finish(); continue; }
    if (previousTime !== undefined && sample.timeSeconds <= previousTime) { partial = true; finish(); }
    previousTime = sample.timeSeconds;
    const value = sample.value;
    count++;
    if (anchor === undefined) { anchor = value; peak = value; continue; }
    pairs++;
    if (!rising) {
      if (value < anchor) anchor = value;
      else if (value - anchor >= 3) { rising = true; peak = value; }
    } else if (value > peak) peak = value;
    else if (peak - value >= 3) { total += peak - anchor; rising = false; anchor = value; }
  }
  finish();
  if (!pairs || (!Number.isFinite(total) || total > Number.MAX_SAFE_INTEGER)) return undefined;
  return { method: 'hysteresis-3m-v1', quality: partial ? 'partial' : 'complete', meters: total };
}
export const ascentLabel = (estimate?: AscentEstimate) => estimate ? `D+ estimé${estimate.quality === 'partial' ? ' (partiel)' : ''}` : 'Dénivelé positif';
