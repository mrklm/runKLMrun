import { afterEach, describe, expect, it } from 'vitest';
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
import { deleteDB } from 'idb';
import { createSessionRepository } from '../storage/database';
import { importPolarArchive } from './archive';
import { parsePolar } from './polar';
import type { ImportReason } from './polar-errors';

// Schéma réel, valeurs entièrement inventées. Aucun extrait d'archive personnelle.
function fixture() {
  return {
    identifier: { id: 'synthetic-modern' }, name: 'Titre libre sans effet',
    startTime: '2026-01-01T10:00:00', durationMillis: 600000,
    hrAvg: 135, hrMax: 165,
    exercises: [{
      sport: { id: '1' }, startTime: '2026-01-01T10:00:00', timezoneOffsetMinutes: 60,
      durationMillis: 600000, distanceMeters: 2000, ascentMeters: 20, descentMeters: 15,
      runningIndex: 40, trainingLoad: 999,
      trainingLoadReport: { cardioLoad: 35, muscleLoad: 888, perceivedLoad: 777 },
      statistics: { statistics: [{ type: 'STATISTICS_TYPE_HEART_RATE', avg: 140, max: 170 }, { type: 'STATISTICS_TYPE_SPEED', avg: 12, max: 20 }] },
      samples: { samples: [
        { type: 'HEART_RATE', intervalMillis: 1000, values: [130, 'NaN', 140, null] },
        { type: 'SPEED', intervalMillis: 500, values: [7.2, 'NaN', 10.8] },
        { type: 'CADENCE', intervalMillis: 1000, values: [80, 'NaN', 82] },
        { type: 'ALTITUDE', intervalMillis: 2000, values: [-5, 'NaN', 10] },
        { type: 'DISTANCE', intervalMillis: 1000, values: [0, 2, 5] },
      ] },
      routes: { route: { startTime: '2026-01-01T10:00:01', wayPoints: [
        { elapsedMillis: 0, latitude: 0, longitude: 0, altitude: -5 },
        { elapsedMillis: 1500, latitude: 0.001, longitude: 0.001, altitude: 0 },
      ] } },
      zones: [
        { type: 'ZONE_TYPE_SPEED', zones: [{ lowerLimit: 8, higherLimit: 10, inZone: 10000 }] },
        { type: 'ZONE_TYPE_HEART_RATE', zones: [{ lowerLimit: 120, higherLimit: 150, inZone: 450000 }] },
      ],
    }],
  };
}
const parse = (input: unknown = fixture(), filename = 'training-session_synthetic.json') => parsePolar(JSON.stringify(input), filename, true);
function rejects(reason: ImportReason, change: (f: ReturnType<typeof fixture>) => void) {
  const f = fixture(); change(f); expect(() => parse(f)).toThrow(expect.objectContaining({ reason }));
}
const names: string[] = [];
afterEach(async () => { await Promise.all(names.splice(0).map(name => deleteDB(name))); });
function repository() { const name = `polar-modern-test-${crypto.randomUUID()}`; names.push(name); return createSessionRepository(name); }
async function archive(files: Record<string, string>) {
  const writer = new ZipWriter(new BlobWriter(), { useWebWorkers: false });
  for (const [name, content] of Object.entries(files)) await writer.add(name, new TextReader(content));
  return writer.close();
}

describe('export Polar à identifiant sportif numérique', () => {
  it('reconnaît le code officiel 1 sans utiliser le titre', () => {
    const f = fixture(); f.name = 'Cyclisme';
    expect(parse(f)?.session).toMatchObject({ polarId: 'synthetic-modern', polarSportId: '1', sport: 'RUNNING', timezoneOffsetMinutes: 60 });
  });
  it.each(['2', '16'])('ignore le code officiel non running %s malgré un titre Running', code => {
    const f = fixture(); f.name = 'Running'; f.exercises[0].sport.id = code; expect(parse(f)).toBeNull();
  });
  it.each(['11', '23', '103', '999999', 'toString', '01'])('laisse inconnu un code non vérifié %s', code => {
    rejects('unknownSport', f => { f.name = 'Running'; f.exercises[0].sport.id = code; });
  });
  it('convertit les millisecondes et conserve les mètres et le dénivelé', () => {
    expect(parse()?.session).toMatchObject({ durationSeconds: 600, distanceMeters: 2000, ascentMeters: 20, descentMeters: 15, averagePaceSecondsPerKm: 300 });
  });
  it('conserve les fractions de seconde', () => { const f = fixture(); f.exercises[0].durationMillis = 1500; expect(parse(f)?.session.durationSeconds).toBe(1.5); });
  it('lit exclusivement les statistiques FC pour les métriques cardiaques', () => {
    expect(parse()?.session).toMatchObject({ averageHeartRate: 140, maximumHeartRate: 170 });
  });
  it('utilise hrAvg/hrMax en l’absence de statistiques FC', () => {
    const f = fixture(); f.exercises[0].statistics.statistics = [{ type: 'STATISTICS_TYPE_SPEED', avg: 12, max: 20 }];
    expect(parse(f)?.session).toMatchObject({ averageHeartRate: 135, maximumHeartRate: 165 });
  });
  it('garde absentes les données facultatives, FC, distance et détails', () => {
    const result = parse({ identifier: { id: 'optional' }, exercises: [{ sport: { id: '1' }, startTime: '2026-01-01T10:00:00', durationMillis: 1000 }] })!;
    expect(result.session.averageHeartRate).toBeUndefined(); expect(result.session.maximumHeartRate).toBeUndefined();
    expect(result.session.distanceMeters).toBeUndefined(); expect(result.session.averagePaceSecondsPerKm).toBeUndefined();
    expect(result.session.cardioLoad).toBeUndefined(); expect(result.details).toEqual({ id: 'polar:optional' });
  });
  it('conserve uniquement la charge cardiovasculaire Polar', () => {
    expect(parse()?.session.cardioLoad).toBe(35);
    const f = fixture(); Reflect.deleteProperty(f.exercises[0].trainingLoadReport, 'cardioLoad');
    expect(parse(f)?.session.cardioLoad).toBeUndefined();
  });
  it('conserve toutes les positions NaN/null et les intervalles propres à chaque série', () => {
    const d = parse()!.details;
    expect(d.heartRate).toEqual([{ timeSeconds: 0, value: 130 }, { timeSeconds: 1, value: null }, { timeSeconds: 2, value: 140 }, { timeSeconds: 3, value: null }]);
    expect(d.speed?.map(s => s.timeSeconds)).toEqual([0, .5, 1]); expect(d.speed?.map(s => s.value)).toEqual([2, null, 3]);
    expect(d.cadence?.map(s => s.value)).toEqual([80, null, 82]);
    expect(d.altitude).toEqual([{ timeSeconds: 0, value: -5 }, { timeSeconds: 2, value: null }, { timeSeconds: 4, value: 10 }]);
    expect(d.distance?.map(s => s.value)).toEqual([0, 2, 5]);
  });
  it('conserve les points GPS, leur ordre et leur origine temporelle', () => {
    expect(parse()?.details).toMatchObject({ gpsStartTime: '2026-01-01T10:00:01', gps: [
      { timeSeconds: 0, latitude: 0, longitude: 0, altitudeMeters: -5 },
      { timeSeconds: 1.5, latitude: .001, longitude: .001, altitudeMeters: 0 },
    ] });
  });
  it('conserve un point GPS manquant sans décaler les suivants', () => {
    const f = fixture(); Object.assign(f.exercises[0].routes.route.wayPoints[0], { latitude: 'NaN', longitude: 'NaN', altitude: 'NaN' });
    expect(parse(f)?.details.gps?.[0]).toEqual({ timeSeconds: 0, latitude: null, longitude: null, altitudeMeters: undefined });
    expect(parse(f)?.details.gps?.[1].timeSeconds).toBe(1.5);
  });
  it('convertit seulement les zones cardiaques depuis les millisecondes', () => {
    expect(parse()?.session.heartRateZones).toEqual([{ lower: 120, upper: 150, durationSeconds: 450 }]);
  });
  it('conserve une zone sans temps renseigné sans inventer zéro', () => {
    const f = fixture(); Reflect.deleteProperty(f.exercises[0].zones[1].zones[0], 'inZone');
    expect(parse(f)?.session.heartRateZones).toEqual([{ lower: 120, upper: 150, durationSeconds: undefined }]);
  });
  it('rejette explicitement une durée absente, sans la déduire des points ou dates', () => {
    rejects('missingDuration', f => { Reflect.deleteProperty(f, 'durationMillis'); Reflect.deleteProperty(f.exercises[0], 'durationMillis'); });
  });
  it('utilise la durée de la racine pour un unique exercice', () => {
    const f = fixture(); Reflect.deleteProperty(f.exercises[0], 'durationMillis'); expect(parse(f)?.session.durationSeconds).toBe(600);
  });
  it.each([-1, '600000', 'NaN', {}, true])('rejette une durée numérique invalide (%j)', duration => {
    rejects('invalidNumbers', f => { Object.assign(f.exercises[0], { durationMillis: duration }); });
  });
  it('rejette un nombre JSON qui déborde vers Infinity', () => { const raw = JSON.stringify(fixture()).replace('"distanceMeters":2000', '"distanceMeters":1e400'); expect(() => parsePolar(raw, 'training-session_synthetic.json')).toThrow(expect.objectContaining({ reason: 'invalidNumbers' })); });
  it.each([-2, '2000', {}])('rejette une distance invalide (%j)', value => { rejects('invalidNumbers', f => { Object.assign(f.exercises[0], { distanceMeters: value }); }); });
  it('conserve une distance nulle sans calculer d’allure', () => { const f = fixture(); f.exercises[0].distanceMeters = 0; expect(parse(f)?.session.averagePaceSecondsPerKm).toBeUndefined(); });
  it('rejette une durée nulle associée à une distance positive', () => { rejects('invalidNumbers', f => { f.exercises[0].durationMillis = 0; }); });
  it('rejette une FC moyenne supérieure à la FC maximale', () => { rejects('invalidNumbers', f => { f.exercises[0].statistics.statistics[0].avg = 200; }); });
  it('rejette une valeur de série inconnue au lieu de compacter le tableau', () => { rejects('invalidNumbers', f => { f.exercises[0].samples.samples[0].values[1] = 'invalid'; }); });
  it('rejette un intervalle nul', () => { rejects('invalidNumbers', f => { f.exercises[0].samples.samples[0].intervalMillis = 0; }); });
  it('rejette deux séries du même type sans en écraser une', () => { rejects('unsupportedStructure', f => { f.exercises[0].samples.samples.push(f.exercises[0].samples.samples[0]); }); });
  it('ignore les types de série dont les unités ne sont pas prises en charge', () => { const f = fixture(); f.exercises[0].samples.samples.push({ type: 'UNKNOWN', intervalMillis: 1000, values: [1] }); expect(parse(f)?.details).toEqual(parse()?.details); });
  it('rejette des points GPS hors limites ou hors ordre', () => {
    rejects('invalidNumbers', f => { f.exercises[0].routes.route.wayPoints[0].latitude = 100; });
    rejects('invalidNumbers', f => { f.exercises[0].routes.route.wayPoints[0].elapsedMillis = 2000; });
  });
  it('distingue une date invalide', () => { rejects('invalidDate', f => { f.exercises[0].startTime = '2026-02-30T12:00:00'; }); });
  it('distingue un identifiant manquant quand aucun nom utilisable n’est fourni', () => { const f = fixture(); Reflect.deleteProperty(f, 'identifier'); expect(() => parse(f, 'unknown.json')).toThrow(expect.objectContaining({ reason: 'missingIdentifier' })); });
  it('distingue les JSON et structures invalides', () => {
    expect(() => parsePolar('{invalid', 'training-session_synthetic.json')).toThrow(expect.objectContaining({ reason: 'invalidJson' }));
    expect(() => parse({ exercises: [] })).toThrow(expect.objectContaining({ reason: 'unsupportedStructure' }));
  });
});

describe('compte rendu et persistance du nouveau schéma', () => {
  it('importe partiellement, agrège les motifs, conserve les détails et réimporte sans écrasement', async () => {
    const other = fixture(); other.exercises[0].sport.id = '16';
    const unknown = fixture(); unknown.exercises[0].sport.id = '999';
    const noDuration = fixture(); Reflect.deleteProperty(noDuration, 'durationMillis'); Reflect.deleteProperty(noDuration.exercises[0], 'durationMillis');
    const badNumber = fixture(); badNumber.exercises[0].distanceMeters = -1;
    const file = await archive({
      'folder/training-session_ok.json': JSON.stringify(fixture()),
      'training-session_other.json': JSON.stringify(other), 'training-session_unknown.json': JSON.stringify(unknown),
      'training-session_duration.json': JSON.stringify(noDuration), 'training-session_numbers.json': JSON.stringify(badNumber),
      'training-session_json.json': '{invalid', 'training-session_structure.json': '{}', 'sleep.json': '{invalid',
    });
    const storage = repository();
    const report = await importPolarArchive(file, storage, () => {});
    expect(report).toMatchObject({ total: 7, processed: 7, imported: 1, ignored: 1, invalid: 5, reasons: {
      otherSport: 1, unknownSport: 1, missingDuration: 1, invalidNumbers: 1, invalidJson: 1, unsupportedStructure: 1,
    } });
    expect(JSON.stringify(report)).not.toContain('synthetic-modern');
    expect(await storage.getDetails('polar:synthetic-modern')).toEqual(parse()?.details);
    const second = await importPolarArchive(file, storage, () => {});
    expect(second).toMatchObject({ imported: 0, duplicates: 1, invalid: 5 });
    expect(await storage.list()).toHaveLength(1);
    const changed = fixture(); changed.exercises[0].distanceMeters = 3;
    await importPolarArchive(await archive({ 'training-session_changed.json': JSON.stringify(changed) }), storage, () => {});
    expect((await storage.list())[0].distanceMeters).toBe(2000);
    expect(await storage.getDetails('polar:synthetic-modern')).toEqual(parse()?.details);
  });
  it('distingue un sport textuel inconnu dans le bilan tout en gardant l’API historique', async () => {
    const text = JSON.stringify({ exercises: [{ sport: 'RUNNING_UNKNOWN' }] });
    expect(parsePolar(text, 'training-session_unknown.json')).toBeNull();
    const report = await importPolarArchive(await archive({ 'training-session_unknown.json': text }), repository(), () => {});
    expect(report.reasons).toEqual({ unknownSport: 1 });
  });
  it('les progressions sont des instantanés indépendants des compteurs de motifs', async () => {
    const snapshots: object[] = [];
    await importPolarArchive(await archive({ 'training-session_bad.json': '{}' }), repository(), r => snapshots.push(r.reasons));
    expect(snapshots[0]).toEqual({}); expect(snapshots.at(-1)).toEqual({ unsupportedStructure: 1 });
  });
});


describe('erreurs de conteneur ZIP', () => {
  async function alteredZip(kind: 'oversized' | 'decompression' | 'encrypted') {
    const blob = await archive({ 'training-session_synthetic.json': JSON.stringify(fixture()) });
    const bytes = new Uint8Array(await blob.arrayBuffer()), view = new DataView(bytes.buffer);
    let found = false;
    for (let i = 0; i <= bytes.length - 46; i++) {
      if (view.getUint32(i, true) !== 0x02014b50) continue;
      found = true;
      if (kind === 'oversized') view.setUint32(i + 24, 64 * 1024 * 1024 + 1, true);
      if (kind === 'decompression') view.setUint32(i + 16, view.getUint32(i + 16, true) ^ 1, true);
      if (kind === 'encrypted') view.setUint16(i + 8, view.getUint16(i + 8, true) | 1, true);
      break;
    }
    expect(found).toBe(true);
    return new Blob([bytes]);
  }
  it.each(['oversized', 'decompression', 'encrypted'] as const)('distingue le motif %s sans exposer le nom du fichier', async reason => {
    const report = await importPolarArchive(await alteredZip(reason), repository(), () => {});
    expect(report).toMatchObject({ processed: 1, imported: 0, invalid: 1, reasons: { [reason]: 1 } });
    expect(report.issues.join('')).not.toContain('synthetic');
  });
  it('conserve aussi les trous des séries du schéma historique', () => {
    const result = parsePolar(JSON.stringify({ exercises: [{ sport: 'RUNNING', startTime: '2026-01-01T10:00:00', duration: 'PT1M', samples: { heartRate: [{ time: 'PT0S', value: 130 }, { time: 'PT1S', value: 'NaN' }, { time: 'PT2S', value: 140 }] } }] }), 'training-session_synthetic.json');
    expect(result?.details.heartRate).toEqual([{ timeSeconds: 0, value: 130 }, { timeSeconds: 1, value: null }, { timeSeconds: 2, value: 140 }]);
  });
});
