import type { RunningSession } from '../../types/session';
export const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
export const nonnegative = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const absent = (v: unknown) => v === undefined || v === null;
export function provenance(s: RunningSession) { return s.source === 'tcx' ? 'TCX explicite' : s.polarId !== undefined ? 'Identifiant Polar présent' : 'Inconnue'; }
export function coverage(sessions: readonly RunningSession[]) {
  return {
    total: sessions.length,
    distanceUsable: sessions.filter(s => positive(s.distanceMeters)).length,
    ascentUsable: sessions.filter(s => nonnegative(s.ascentMeters)).length,
    ascentAbsent: sessions.filter(s => absent(s.ascentMeters)).length,
    ascentInvalid: sessions.filter(s => !absent(s.ascentMeters) && !nonnegative(s.ascentMeters)).length,
    ascentZero: sessions.filter(s => s.ascentMeters === 0).length,
    ascentEstimated: sessions.filter(s => s.ascentEstimate !== undefined).length,
    ascentPartial: sessions.filter(s => s.ascentEstimate?.quality === 'partial').length,
    averageHeartRateUsable: sessions.filter(s => positive(s.averageHeartRate)).length,
    distanceAscentHeartRate: sessions.filter(s => positive(s.distanceMeters) && nonnegative(s.ascentMeters) && positive(s.averageHeartRate)).length,
    provenance: Object.fromEntries(['TCX explicite', 'Identifiant Polar présent', 'Inconnue'].map(p => [p, sessions.filter(s => provenance(s) === p).length])),
  };
}
export interface Parameters { fixedDistanceMeters: number; fixedAscentMeters: number; relativeDistance: number; relativeAscent: number; proximityDistanceScaleMeters: number; proximityAscentScaleMeters: number; proximityRadius: number; maxExamples: number }
/** Valeurs de démonstration uniquement, non validées pour le Conseiller. */
export const DEMO: Parameters = { fixedDistanceMeters: 300, fixedAscentMeters: 15, relativeDistance: .04, relativeAscent: .2, proximityDistanceScaleMeters: 300, proximityAscentScaleMeters: 15, proximityRadius: 1, maxExamples: 200 };
type Method = 'fixed' | 'relative' | 'proximity';
export function compareMethods(sessions: readonly RunningSession[], parameters: Parameters) {
  const p = { ...parameters };
  if (Object.keys(DEMO).some(key => !nonnegative(p[key as keyof Parameters])) || p.relativeDistance >= 1 || p.relativeAscent >= 1 || !positive(p.proximityDistanceScaleMeters) || !positive(p.proximityAscentScaleMeters) || !Number.isSafeInteger(p.maxExamples) || p.maxExamples > 10000) throw new Error('Paramètres invalides : nombres finis positifs ou nuls, pourcentages inférieurs à 1, échelles positives et au plus 10 000 exemples.');
  const sorted = [...sessions].sort((a,b) => a.id.localeCompare(b.id));
  if (new Set(sorted.map(s => s.id)).size !== sorted.length) throw new Error('Identifiants dupliqués : comparaison ambiguë.');
  const excluded: { id: string; reasons: string[] }[] = [];
  const usable = sorted.filter(s => {
    const reasons = [];
    if (!positive(s.distanceMeters)) reasons.push('Distance absente, nulle ou invalide');
    if (!nonnegative(s.ascentMeters)) reasons.push('D+ absent ou invalide (jamais remplacé par zéro)');
    if (s.ascentEstimate?.quality === 'partial') reasons.push('D+ partiel exclu de cette comparaison stricte');
    if (s.ascentEstimate && (!nonnegative(s.ascentEstimate.meters) || s.ascentEstimate.meters !== s.ascentMeters || !['complete', 'partial'].includes(s.ascentEstimate.quality))) reasons.push('Métadonnées de D+ incohérentes');
    if (reasons.length) excluded.push({ id: s.id, reasons });
    return !reasons.length;
  }).sort((a,b) => a.distanceMeters! - b.distanceMeters! || a.id.localeCompare(b.id));
  const relative = (a: number, b: number) => Math.max(a,b) === 0 ? 0 : Math.abs(a-b)/Math.max(a,b);
  return { parameters: p, coverage: coverage(sessions), excluded, methods: (['fixed','relative','proximity'] as Method[]).map(method => {
    let pairs = 0, doubtfulPairs = 0;
    const matched = new Set<string>();
    const examples: { a: string; b: string; distanceDifferenceMeters: number; ascentDifferenceMeters: number; score: number; warnings: string[] }[] = [];
    for (let i=0;i<usable.length;i++) {
      const a=usable[i];
      const upper = method === 'fixed' ? a.distanceMeters! + p.fixedDistanceMeters : method === 'relative' ? a.distanceMeters!/(1-p.relativeDistance) : a.distanceMeters!+p.proximityDistanceScaleMeters*p.proximityRadius;
      for (let j=i+1;j<usable.length && usable[j].distanceMeters! <= upper;j++) {
        const b=usable[j], distance=Math.abs(a.distanceMeters!-b.distanceMeters!), ascent=Math.abs(a.ascentMeters!-b.ascentMeters!);
        const score = Math.hypot(distance/p.proximityDistanceScaleMeters, ascent/p.proximityAscentScaleMeters);
        const accepted = method === 'fixed' ? distance <= p.fixedDistanceMeters && ascent <= p.fixedAscentMeters : method === 'relative' ? relative(a.distanceMeters!,b.distanceMeters!) <= p.relativeDistance && relative(a.ascentMeters!,b.ascentMeters!) <= p.relativeAscent : score <= p.proximityRadius;
        if (!accepted) continue;
        const warnings: string[] = [];
        if (provenance(a) !== provenance(b)) warnings.push('Provenances différentes');
        if (provenance(a) === 'Inconnue' || provenance(b) === 'Inconnue') warnings.push('Provenance inconnue');
        if (!!a.ascentEstimate !== !!b.ascentEstimate || a.ascentEstimate?.method !== b.ascentEstimate?.method) warnings.push('Méthodes de D+ différentes ou non documentées');
        if (!a.ascentEstimate || !b.ascentEstimate) warnings.push('D+ fourni : méthode de mesure non documentée');
        pairs++; if (warnings.length) doubtfulPairs++;
        matched.add(a.id); matched.add(b.id);
        if (examples.length < p.maxExamples) examples.push({ a:a.id,b:b.id,distanceDifferenceMeters:distance,ascentDifferenceMeters:ascent,score,warnings });
      }
    }
    return { method, pairs, matchedSessions: matched.size, doubtfulPairs, examples, examplesTruncated: pairs > examples.length, isolated: usable.filter(s => !matched.has(s.id)).map(s => s.id) };
  }) };
}
