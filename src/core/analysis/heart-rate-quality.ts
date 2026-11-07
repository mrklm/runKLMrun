import type { Sample } from '../../types/session';

/** Seuils éditoriaux TCX-2 : bornes larges, jamais une limite physiologique personnelle. */
export const HEART_RATE_QUALITY_THRESHOLDS = Object.freeze({
  minimumBpm: 25, maximumBpm: 250, partialCoverage: 0.8,
  spikeBpm: 40, spikeNeighbourSeconds: 5, flatSeconds: 120, interruptionSeconds: 120, summaryMismatchBpm: 10,
});

export type HeartRateQualityStatus = 'absent' | 'partial' | 'ok' | 'suspect' | 'invalid';
export type HeartRateIssue =
  | { code: 'out-of-range'; certainty: 'certain'; count: number; timesSeconds: number[] }
  | { code: 'partial-coverage'; certainty: 'certain'; coverage: number }
  | { code: 'isolated-spike'; certainty: 'suspected'; count: number; timesSeconds: number[] }
  | { code: 'flat-signal'; certainty: 'suspected'; count: number; longestSeconds: number }
  | { code: 'interruption'; certainty: 'suspected'; count: number; longestSeconds: number }
  | { code: 'summary-mismatch'; certainty: 'suspected'; summaryAverage: number; measuredAverage: number };
export interface HeartRateQuality {
  status: HeartRateQualityStatus;
  /** Points horodatés de la série, mesurés ou non ; 0 si la série est absente. */
  sampleCount: number;
  /** Valeurs dans les bornes, zéros et valeurs hors bornes exclus. */
  measuredCount: number;
  zeroCount: number;
  /** null lorsque la série est absente : la couverture réelle n'est pas connue. */
  coverage: number | null;
  issues: HeartRateIssue[];
}

const EXAMPLES = 5;
const severity: Record<HeartRateQualityStatus, number> = { absent: 0, ok: 1, partial: 2, suspect: 3, invalid: 4 };

/** Pure et non destructive : aucune valeur n'est corrigée, interpolée ou supprimée.
 * Un zéro est traité comme une absence de mesure. Une absence de FC ne rend pas l'activité invalide
 * et aucune cause n'est déduite. À calculer à côté du parsing, jamais avant l'empreinte TCX.
 */
export function analyzeHeartRateQuality(samples: readonly Sample[] | undefined, summaryAverage?: number): HeartRateQuality {
  const t = HEART_RATE_QUALITY_THRESHOLDS;
  const points = (samples ?? []).filter(p => Number.isFinite(p.timeSeconds) && p.timeSeconds >= 0)
    .map(p => ({ time: p.timeSeconds, value: p.value !== null && Number.isFinite(p.value) ? p.value : null }))
    .sort((a, b) => a.time - b.time);
  const issues: HeartRateIssue[] = [];
  let zeroCount = 0;
  const outOfRange: number[] = [];
  const valid: { time: number; value: number; index: number }[] = [];
  points.forEach((p, index) => {
    if (p.value === null) return;
    if (p.value === 0) { zeroCount++; return; }
    if (p.value < t.minimumBpm || p.value > t.maximumBpm) { outOfRange.push(p.time); return; }
    valid.push({ time: p.time, value: p.value, index });
  });
  const coverage = samples === undefined ? null : points.length ? valid.length / points.length : 0;
  if (outOfRange.length) issues.push({ code: 'out-of-range', certainty: 'certain', count: outOfRange.length, timesSeconds: outOfRange.slice(0, EXAMPLES) });
  if (valid.length && coverage !== null && coverage < t.partialCoverage) issues.push({ code: 'partial-coverage', certainty: 'certain', coverage });

  // Pic isolé : un seul point s'écarte dans le même sens de ses deux voisins mesurés proches.
  const spikes: number[] = [];
  for (let i = 1; i < valid.length - 1; i++) {
    const [before, current, after] = [valid[i - 1], valid[i], valid[i + 1]];
    if (current.time - before.time > t.spikeNeighbourSeconds || after.time - current.time > t.spikeNeighbourSeconds) continue;
    const up = current.value - before.value > t.spikeBpm && current.value - after.value > t.spikeBpm;
    const down = before.value - current.value > t.spikeBpm && after.value - current.value > t.spikeBpm;
    if (up || down) spikes.push(current.time);
  }
  if (spikes.length) issues.push({ code: 'isolated-spike', certainty: 'suspected', count: spikes.length, timesSeconds: spikes.slice(0, EXAMPLES) });

  // Signal constant : valeurs identiques et consécutives dans la série, sans point non mesuré entre elles.
  let flatCount = 0, flatLongest = 0;
  for (let start = 0; start < valid.length;) {
    let end = start;
    while (end + 1 < valid.length && valid[end + 1].value === valid[start].value && valid[end + 1].index === valid[end].index + 1) end++;
    const span = valid[end].time - valid[start].time;
    if (span > t.flatSeconds) { flatCount++; flatLongest = Math.max(flatLongest, span); }
    start = end + 1;
  }
  if (flatCount) issues.push({ code: 'flat-signal', certainty: 'suspected', count: flatCount, longestSeconds: flatLongest });

  // Interruption : l'enregistrement continue (points strictement intermédiaires) sans FC exploitable.
  // Une pause sans aucun point enregistré n'est pas comptée.
  let gapCount = 0, gapLongest = 0;
  for (let i = 1; i < valid.length; i++) {
    const [before, after] = [valid[i - 1], valid[i]], span = after.time - before.time;
    if (span <= t.interruptionSeconds) continue;
    const recorded = points.slice(before.index + 1, after.index).some(p => p.time > before.time && p.time < after.time);
    if (recorded) { gapCount++; gapLongest = Math.max(gapLongest, span); }
  }
  if (gapCount) issues.push({ code: 'interruption', certainty: 'suspected', count: gapCount, longestSeconds: gapLongest });

  // Le résumé provient des tours : comparaison seulement si la courbe est suffisamment couverte.
  if (summaryAverage !== undefined && Number.isFinite(summaryAverage) && summaryAverage > 0 && valid.length
    && coverage !== null && coverage >= t.partialCoverage) {
    const measuredAverage = valid.reduce((sum, p) => sum + p.value, 0) / valid.length;
    if (Math.abs(measuredAverage - summaryAverage) > t.summaryMismatchBpm)
      issues.push({ code: 'summary-mismatch', certainty: 'suspected', summaryAverage, measuredAverage });
  }

  const status = issues.reduce<HeartRateQualityStatus>((worst, issue) => {
    const next: HeartRateQualityStatus = issue.code === 'out-of-range' ? 'invalid' : issue.code === 'partial-coverage' ? 'partial' : 'suspect';
    return severity[next] > severity[worst] ? next : worst;
  }, valid.length ? 'ok' : 'absent');
  return { status, sampleCount: points.length, measuredCount: valid.length, zeroCount, coverage, issues };
}
