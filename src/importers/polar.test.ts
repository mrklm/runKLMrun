import { afterEach, describe, expect, it } from 'vitest';
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
import { deleteDB, openDB } from 'idb';
import { createSessionRepository } from '../storage/database';
import { importPolarArchive } from './archive';
import { parsePolar, seconds } from './polar';

const exercise = { sport: 'RUNNING', startTime: '2026-01-01T10:00:00', duration: 'PT30M', distance: 5000, heartRate: { average: 140, maximum: 170 }, ascent: 50, descent: 45, runningIndex: 48, trainingLoad: { cardioLoad: 32 }, zones: { heartRate: [{ lowerLimit: 120, upperLimit: 150, inZone: 'PT10M' }] }, samples: { heartRate: [{ time: 'PT1S', value: 140 }], speed: [{ time: 'PT1S', value: 12 }], cadence: [{ time: 'PT1S', value: 80 }], altitude: [{ time: 'PT1S', value: 55 }] }, recordedRoute: [{ time: 'PT1S', latitude: 0, longitude: 0, altitude: 55 }] };
const parse = (e: object = exercise) => parsePolar(JSON.stringify({ exercises: [e] }), 'training-session_test-1.json');
const names: string[] = [];
function repo() { const name = `polar-test-${crypto.randomUUID()}`; names.push(name); return { name, storage: createSessionRepository(name) }; }
afterEach(async () => { await Promise.all(names.splice(0).map(name => deleteDB(name))); });
async function zip(files: Record<string, string>) {
  const writer = new ZipWriter(new BlobWriter(), { useWebWorkers: false });
  for (const [name, text] of Object.entries(files)) await writer.add(name, new TextReader(text));
  return writer.close();
}
// All coordinates and activities here are synthetic.
describe('adaptateur Polar', () => {
  it('importe une course et ses métriques', () => { expect(parse()?.session).toMatchObject({ polarId: 'test-1', distanceMeters: 5000, durationSeconds: 1800, averagePaceSecondsPerKm: 360, averageHeartRate: 140, maximumHeartRate: 170, ascentMeters: 50, descentMeters: 45, runningIndex: 48, cardioLoad: 32 }); });
  it.each(['CYCLING', 'WATER_RUNNING', 'RUNNING_UNKNOWN', 'OTHER'])('ignore exactement le sport %s', sport => { expect(parse({ ...exercise, sport })).toBeNull(); });
  it('accepte une course sans fréquence cardiaque', () => { expect(parse({ ...exercise, heartRate: undefined, samples: undefined })?.session.averageHeartRate).toBeUndefined(); });
  it('accepte une course sans GPS', () => { expect(parse({ ...exercise, recordedRoute: undefined })?.details.gps).toBeUndefined(); });
  it('garde les champs facultatifs absents', () => { const p = parse({ sport: 'RUNNING', startTime: exercise.startTime, duration: 'PT1H' }); expect(p?.session.distanceMeters).toBeUndefined(); expect(p?.session.averagePaceSecondsPerKm).toBeUndefined(); expect(p?.session.runningIndex).toBeUndefined(); });
  it('rejette le JSON invalide', () => { expect(() => parsePolar('{broken', 'training-session_1.json')).toThrow(); });
  it('convertit les unités sans arrondir les séries', () => { expect(seconds('PT1H2M3.5S')).toBe(3723.5); expect(parse()?.details.speed?.[0].value).toBeCloseTo(12 / 3.6); expect(parse()?.session.heartRateZones?.[0].durationSeconds).toBe(600); });
  it('conserve chaque série et les coordonnées nulles valides', () => { expect(parse()?.details).toEqual({ id: 'polar:test-1', heartRate: [{ timeSeconds: 1, value: 140 }], speed: [{ timeSeconds: 1, value: 12 * (1 / 3.6) }], cadence: [{ timeSeconds: 1, value: 80 }], altitude: [{ timeSeconds: 1, value: 55 }], gps: [{ timeSeconds: 1, latitude: 0, longitude: 0, altitudeMeters: 55 }] }); });
  it('ne transforme pas une distance nulle en allure infinie', () => { expect(parse({ ...exercise, distance: 0 })?.session.averagePaceSecondsPerKm).toBeUndefined(); });
  it('rejette une date civile impossible', () => { expect(() => parse({ ...exercise, startTime: '2026-02-30T10:00:00' })).toThrow(); });
  it('conserve la charge Polar trainingLoadPro', () => { expect(parse({ ...exercise, trainingLoad: undefined, trainingLoadPro: { cardioLoad: 25 } })?.session.cardioLoad).toBe(25); });
  it('rejette les durées et structures inconnues', () => { expect(() => parse({ ...exercise, duration: -1 })).toThrow(); expect(() => parsePolar('{"exercises":[]}', 'training-session_1.json')).toThrow(); });
});
describe('archive et stockage', () => {
  it('signale une archive invalide', async () => { const { storage } = repo(); const result = await importPolarArchive(new Blob(['invalid']), storage, () => {}); expect(result.error).toContain('ZIP'); expect(await storage.list()).toEqual([]); });
  it('importe progressivement, ignore les fichiers privés, conserve les détails et évite les doublons', async () => {
    const { storage } = repo(); const file = await zip({ 'folder/training-session_test-1.json': JSON.stringify({ exercises: [exercise] }), 'personal.json': '{invalid', 'training-session_broken.json': '{invalid', 'training-session_bike.json': JSON.stringify({ exercises: [{ ...exercise, sport: 'CYCLING' }] }) });
    const progress: number[] = [];
    const first = await importPolarArchive(file, storage, r => progress.push(r.processed));
    expect(first).toMatchObject({ total: 3, processed: 3, imported: 1, invalid: 1, ignored: 1 });
    expect(progress).toContain(1);
    expect(await storage.getDetails('polar:test-1')).toEqual(parse()?.details);
    const second = await importPolarArchive(file, storage, () => {});
    expect(second).toMatchObject({ imported: 0, duplicates: 1 }); expect(await storage.list()).toHaveLength(1);
  });
  it('ne remplace pas une séance existante même modifiée', async () => { const { storage } = repo(); const p = parse()!; await storage.addImported(p.session, p.details); expect(await storage.addImported({ ...p.session, distanceMeters: 1 }, { id: p.session.id })).toBe(false); expect((await storage.list())[0].distanceMeters).toBe(5000); expect(await storage.getDetails(p.session.id)).toEqual(p.details); });
  it('migre une base v1 sans perdre les anciennes sorties', async () => { const { name, storage } = repo(); const db = await openDB(name, 1, { upgrade(db) { db.createObjectStore('sessions', { keyPath: 'id' }); } }); const old = { id: 'legacy', title: 'Ancienne', date: '2025-01-01', distanceMeters: 1000, durationSeconds: 400 }; await db.put('sessions', old); db.close(); expect(await storage.list()).toEqual([old]); const p = parse()!; await storage.addImported(p.session, p.details); expect(await storage.list()).toHaveLength(2); });
  it('arrête proprement sur erreur de stockage', async () => { const { storage } = repo(); storage.addImported = async () => { throw new Error('Quota'); }; const file = await zip({ 'training-session_test.json': JSON.stringify({ exercises: [exercise] }) }); expect((await importPolarArchive(file, storage, () => {})).error).toContain('stockage'); });
  it('gère une archive sans entraînement', async () => { const { storage } = repo(); expect((await importPolarArchive(await zip({ 'sleep.json': '{}' }), storage, () => {})).total).toBe(0); });
  it('sérialise deux importations concurrentes sans doublon', async () => { const { storage } = repo(); const p = parse()!; expect((await Promise.all([storage.addImported(p.session, p.details), storage.addImported(p.session, p.details)])).sort()).toEqual([false, true]); });
});
