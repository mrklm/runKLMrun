import { describe, expect, it } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { analyzeHeartRateQuality, HEART_RATE_QUALITY_THRESHOLDS } from './heart-rate-quality';
import { parseTcx, type XmlReader } from '../../importers/tcx';
import type { Sample } from '../../types/session';

// Données entièrement synthétiques ; aucune activité réelle.
/** Une mesure par seconde, valeur légèrement variable : ni pic, ni signal constant. */
const series = (count: number, value = (i: number) => 140 + (i % 7)): Sample[] =>
  Array.from({ length: count }, (_, i) => ({ timeSeconds: i, value: value(i) }));
const codes = (samples: readonly Sample[] | undefined, average?: number) => analyzeHeartRateQuality(samples, average).issues.map(i => i.code);

describe('qualité de la fréquence cardiaque', () => {
  it('distingue une série absente, vide ou uniquement nulle, sans en faire une erreur', () => {
    expect(analyzeHeartRateQuality(undefined)).toEqual({ status: 'absent', sampleCount: 0, measuredCount: 0, zeroCount: 0, coverage: null, issues: [] });
    expect(analyzeHeartRateQuality([])).toMatchObject({ status: 'absent', coverage: 0, issues: [] });
    expect(analyzeHeartRateQuality(series(10, () => null as unknown as number))).toMatchObject({ status: 'absent', sampleCount: 10, coverage: 0, issues: [] });
  });

  it('accepte une série complète et plausible', () => {
    expect(analyzeHeartRateQuality(series(600), 143)).toMatchObject({ status: 'ok', sampleCount: 600, measuredCount: 600, coverage: 1, issues: [] });
  });

  it('traite les zéros comme une absence de mesure', () => {
    expect(analyzeHeartRateQuality(series(10, () => 0))).toMatchObject({ status: 'absent', zeroCount: 10, measuredCount: 0, issues: [] });
    const result = analyzeHeartRateQuality(series(100, i => i === 50 ? 0 : 140 + (i % 7)));
    expect(result).toMatchObject({ status: 'ok', zeroCount: 1, measuredCount: 99 });
  });

  it('signale une couverture partielle sous 80 %', () => {
    const result = analyzeHeartRateQuality(series(100, i => i < 70 ? 140 + (i % 7) : null as unknown as number));
    expect(result.status).toBe('partial');
    expect(result.issues).toEqual([{ code: 'partial-coverage', certainty: 'certain', coverage: 0.7 }]);
    expect(analyzeHeartRateQuality(series(100, i => i < 80 ? 140 + (i % 7) : null as unknown as number)).status).toBe('ok');
  });

  it('classe comme certaines les valeurs hors des bornes larges, frontières incluses', () => {
    const { minimumBpm: low, maximumBpm: high } = HEART_RATE_QUALITY_THRESHOLDS;
    const at = (value: number) => analyzeHeartRateQuality(series(10, i => i === 5 ? value : 140));
    expect(at(low).status).not.toBe('invalid');
    expect(at(high).status).not.toBe('invalid');
    expect(analyzeHeartRateQuality(series(10, i => 205 + (i % 3))).issues).toEqual([]);
    for (const value of [low - 1, high + 1, 400]) {
      expect(at(value)).toMatchObject({ status: 'invalid', issues: [{ code: 'out-of-range', certainty: 'certain', count: 1, timesSeconds: [5] }] });
    }
    expect(analyzeHeartRateQuality(series(3, () => 300))).toMatchObject({ status: 'invalid', measuredCount: 0 });
  });

  it('repère un pic isolé, mais pas un changement durable ni des voisins éloignés', () => {
    const spike = analyzeHeartRateQuality(series(100, i => i === 50 ? 200 : 145));
    expect(spike).toMatchObject({ status: 'suspect', issues: [{ code: 'isolated-spike', count: 1, timesSeconds: [50] }] });
    expect(codes(series(100, i => i === 50 ? 100 : 145))).toContain('isolated-spike');
    expect(codes(series(100, i => i === 50 ? 185 : 145))).not.toContain('isolated-spike');
    expect(codes(series(100, i => (i < 50 ? 120 : 175) + (i % 7)))).toEqual([]);
    const distant: Sample[] = [{ timeSeconds: 0, value: 140 }, { timeSeconds: 10, value: 200 }, { timeSeconds: 20, value: 140 }];
    expect(codes(distant)).not.toContain('isolated-spike');
  });

  it('repère un signal constant au-delà de deux minutes', () => {
    expect(codes(series(121, () => 150))).toEqual([]);
    const flat = analyzeHeartRateQuality(series(300, i => i < 200 ? 150 : 150 + (i % 7) + 1));
    expect(flat.issues).toEqual([{ code: 'flat-signal', certainty: 'suspected', count: 1, longestSeconds: 199 }]);
    // Un point non mesuré interrompt la série constante.
    expect(codes(series(240, i => i === 120 ? null as unknown as number : 150))).toEqual([]);
  });

  it('repère une interruption pendant l’enregistrement, pas une pause sans points', () => {
    const interrupted = series(1000, i => i >= 200 && i < 330 ? null as unknown as number : 140 + (i % 7));
    expect(analyzeHeartRateQuality(interrupted).issues).toEqual([{ code: 'interruption', certainty: 'suspected', count: 1, longestSeconds: 131 }]);
    const short = series(1000, i => i >= 200 && i < 300 ? null as unknown as number : 140 + (i % 7));
    expect(codes(short)).toEqual([]);
    const paused = series(600).filter(p => p.timeSeconds < 200 || p.timeSeconds >= 400);
    expect(codes(paused)).toEqual([]);
  });

  it('compare le résumé des tours à la courbe seulement si elle est bien couverte', () => {
    expect(analyzeHeartRateQuality(series(100, () => 150), 158).issues).toEqual([]);
    expect(analyzeHeartRateQuality(series(100, i => 150 + (i % 3)), 170).issues)
      .toEqual([{ code: 'summary-mismatch', certainty: 'suspected', summaryAverage: 170, measuredAverage: 150.99 }]);
    expect(codes(series(100, i => i < 50 ? 150 + (i % 3) : null as unknown as number), 170)).toEqual(['partial-coverage']);
    expect(codes(series(100), 0)).toEqual([]);
  });

  it('retient la gravité maximale et conserve tous les motifs', () => {
    const result = analyzeHeartRateQuality(series(100, i => i === 10 ? 300 : i === 50 ? 210 : i > 60 ? null as unknown as number : 145));
    expect(result.status).toBe('invalid');
    expect(result.issues.map(i => i.code)).toEqual(['out-of-range', 'partial-coverage', 'isolated-spike']);
  });

  it('ne compte pas les séparateurs de segments TCX comme des mesures manquantes', () => {
    const segmented: Sample[] = [...series(10), { timeSeconds: 20, value: null }, ...series(10).map(p => ({ ...p, timeSeconds: p.timeSeconds + 20 }))];
    expect(analyzeHeartRateQuality(segmented)).toMatchObject({ status: 'ok', sampleCount: 20, measuredCount: 20, coverage: 1 });
  });
  it('ne modifie pas l’entrée, trie une copie et ignore les temps invalides', () => {
    const input: Sample[] = [{ timeSeconds: 2, value: 141 }, { timeSeconds: 0, value: 140 }, { timeSeconds: Number.NaN, value: 300 }, { timeSeconds: 1, value: 142 }];
    const copy = structuredClone(input);
    expect(analyzeHeartRateQuality(input)).toMatchObject({ status: 'ok', sampleCount: 3, measuredCount: 3 });
    expect(input).toEqual(copy);
  });
});

describe('qualité de la fréquence cardiaque après lecture TCX', () => {
  const readXml: XmlReader = text => new DOMParser().parseFromString(text, 'application/xml') as unknown as Document;
  const stamp = (seconds: number) => new Date(Date.UTC(2026, 0, 1, 10, 0, 0) + seconds * 1000).toISOString();
  const tcx = (heart: (i: number) => number | null, count = 300) => {
    const points = Array.from({ length: count }, (_, i) => {
      const value = heart(i);
      return `<Trackpoint><Time>${stamp(i)}</Time><Position><LatitudeDegrees>45.${1000 + i}</LatitudeDegrees><LongitudeDegrees>4.${1000 + i}</LongitudeDegrees></Position><DistanceMeters>${i * 3}</DistanceMeters>${value === null ? '' : `<HeartRateBpm><Value>${value}</Value></HeartRateBpm>`}</Trackpoint>`;
    }).join('');
    return `<?xml version="1.0"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Running"><Id>${stamp(0)}</Id><Lap StartTime="${stamp(0)}"><TotalTimeSeconds>${count}</TotalTimeSeconds><DistanceMeters>${count * 3}</DistanceMeters><Track>${points}</Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
  };

  it('conserve durée, distance et GPS lorsqu’aucune FC n’est enregistrée', async () => {
    const parsed = (await parseTcx(tcx(() => null), readXml))!;
    expect(parsed.session).toMatchObject({ durationSeconds: 300, distanceMeters: 900 });
    expect(parsed.details.gps).toHaveLength(300);
    expect(analyzeHeartRateQuality(parsed.details.heartRate, parsed.session.averageHeartRate)).toMatchObject({ status: 'absent', coverage: null });
  });

  it('analyse sans changer l’identifiant ni les mesures importées', async () => {
    const text = tcx(i => i === 150 ? 230 : 140 + (i % 7));
    const first = (await parseTcx(text, readXml))!, before = structuredClone(first);
    expect(analyzeHeartRateQuality(first.details.heartRate).issues.map(i => i.code)).toEqual(['isolated-spike']);
    expect(first).toEqual(before);
    expect((await parseTcx(text, readXml))!.session.id).toBe(first.session.id);
  });
});
