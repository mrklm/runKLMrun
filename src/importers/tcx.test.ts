import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { deleteDB } from 'idb';
import { parseTcx, type XmlReader, MAX_TCX_BYTES } from './tcx';
import { importTcxFiles, type TcxReport } from './tcx-files';
import { isTcxDuplicate } from './session-duplicate';
import { createSessionRepository } from '../storage/database';
import { parsePolar } from './polar';
import type { RunningSession } from '../types/session';

// Toutes les valeurs sont synthétiques ; aucune donnée personnelle.
const readXml: XmlReader = text => new DOMParser({ onError: () => { throw new Error('XML invalide'); } }).parseFromString(text, 'application/xml') as unknown as Document;
const stamp = (seconds: number) => new Date(Date.UTC(2026, 0, 1, 10, 0, 0) + seconds * 1000).toISOString();
const point = (seconds: number, values = '<AltitudeMeters>-5</AltitudeMeters><DistanceMeters>10</DistanceMeters><HeartRateBpm><Value>140</Value></HeartRateBpm><Position><LatitudeDegrees>0</LatitudeDegrees><LongitudeDegrees>0</LongitudeDegrees></Position><Extensions><ext:TPX><ext:Speed>2.5</ext:Speed><ext:RunCadence>83</ext:RunCadence></ext:TPX></Extensions>') => `<Trackpoint><Time>${stamp(seconds)}</Time>${values}</Trackpoint>`;
const lap = (start = 0, points = point(start) + point(start + 1.5), duration = 60, distance: number | null = 150) => `<Lap StartTime="${stamp(start)}"><TotalTimeSeconds>${duration}</TotalTimeSeconds>${distance === null ? '' : `<DistanceMeters>${distance}</DistanceMeters>`}<AverageHeartRateBpm><Value>140</Value></AverageHeartRateBpm><MaximumHeartRateBpm><Value>170</Value></MaximumHeartRateBpm><Track>${points}</Track></Lap>`;
const tcx = (laps = lap(), sport = 'Running') => `<?xml version="1.0"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:ext="http://www.garmin.com/xmlschemas/ActivityExtension/v2"><Activities><Activity Sport="${sport}"><Id>${stamp(0)}</Id>${laps}</Activity></Activities></TrainingCenterDatabase>`;
const parse = (text = tcx()) => parseTcx(text, readXml);
const file = (text = tcx(), name = 'sortie.tcx') => new File([text], name);
const names: string[] = [];
function repository() { const name = `tcx-test-${crypto.randomUUID()}`; names.push(name); return createSessionRepository(name); }
afterEach(async () => { vi.unstubAllGlobals(); await Promise.all(names.splice(0).map(name => deleteDB(name))); });

describe('lecture TCX', () => {
  it('importe date, sport, métriques, GPS et extensions avec leurs unités', async () => {
    const result = (await parse())!;
    expect(result.session).toMatchObject({ source: 'tcx', sport: 'RUNNING', startTime: stamp(0), durationSeconds: 60, distanceMeters: 150, averagePaceSecondsPerKm: 400, averageHeartRate: 140, maximumHeartRate: 170 });
    expect(result.details.speed).toEqual([{ timeSeconds: 0, value: 2.5 }, { timeSeconds: 1.5, value: 2.5 }]);
    expect(result.details.altitude?.[0].value).toBe(-5); expect(result.details.cadence?.[0].value).toBe(83);
    expect(result.details.gps?.[0]).toMatchObject({ timeSeconds: 0, latitude: 0, longitude: 0, altitudeMeters: -5 });
    expect(result.details.distance?.[0].value).toBe(10); expect(result.session.id).toMatch(/^tcx:[0-9a-f]{64}$/);
  });
  it('utilise le DOMParser navigateur par défaut', async () => {
    vi.stubGlobal('DOMParser', class { parseFromString(text: string) { return readXml(text); } });
    expect((await parseTcx(tcx()))?.session.sport).toBe('RUNNING');
  });
  it('rejette le document parsererror renvoyé par un navigateur', async () => {
    await expect(parseTcx(tcx(), () => readXml('<parsererror xmlns="urn:parsererror">Erreur</parsererror>'))).rejects.toThrow();
  });
  it('accepte les préfixes XML sans dépendre de leur orthographe', async () => {
    expect((await parse(tcx().replaceAll('ext:', 'a:').replace('xmlns:ext', 'xmlns:a')))?.details.speed?.[0].value).toBe(2.5);
  });
  it('regroupe plusieurs tours, conserve leurs métadonnées et les ruptures entre pistes', async () => {
    const result = (await parse(tcx(lap() + lap(70, point(70), 120, 300).replace('<Value>140</Value>', '<Value>155</Value>'))))!;
    expect(result.session.durationSeconds).toBe(180); expect(result.session.distanceMeters).toBe(450);
    expect(result.session.averageHeartRate).toBe(150);
    expect(result.details.laps).toHaveLength(2);
    expect(result.details.heartRate?.map(p => [p.timeSeconds, p.value])).toEqual([[0, 140], [1.5, 140], [70, null], [70, 140]]);
  });
  it('préserve les absences sans produire de totaux partiels ni de données inventées', async () => {
    const xml = tcx(lap(0, point(0, '') + point(1.5), 60, null) + lap(70, '', 60, 150)).replace(/<AverageHeartRateBpm>.*?<\/AverageHeartRateBpm>/g, '');
    const result = (await parse(xml))!;
    expect(result.session.distanceMeters).toBeUndefined(); expect(result.session.averageHeartRate).toBeUndefined();
    expect(result.session.averagePaceSecondsPerKm).toBeUndefined(); expect(result.session.cardioLoad).toBeUndefined();
    expect(result.session.ascentMeters).toBeUndefined(); expect(result.session.runningIndex).toBeUndefined();
    expect(result.details.heartRate?.[0]).toEqual({ timeSeconds: 0, value: null });
    expect((await parse(tcx(lap(0, ''))))?.details.heartRate).toBeUndefined();
  });
  it('garde les points GPS invalides comme interruptions sans affecter les autres mesures', async () => {
    const result = (await parse(tcx(lap(0, point(0) + point(1).replace('<LatitudeDegrees>0', '<LatitudeDegrees>100')))))!;
    expect(result.details.gps?.[1].latitude).toBeNull(); expect(result.details.heartRate?.[1].value).toBe(140);
  });
  it('conserve les intervalles irréguliers et la cadence TCX directe sans doublement', async () => {
    const result = (await parse(tcx(lap(0, point(0, '<Cadence>81</Cadence>') + point(.25, '') + point(25.5, '<Cadence>82</Cadence>')))))!;
    expect(result.details.cadence).toEqual([{ timeSeconds: 0, value: 81 }, { timeSeconds: .25, value: null }, { timeSeconds: 25.5, value: 82 }]);
    expect(result.details.cadenceUnit).toBe('source');
  });
  it('donne le même identifiant au contenu normalisé malgré le formatage', async () => {
    expect((await parse())?.session.id).toBe((await parse(tcx().replaceAll('><', '>\n<')))?.session.id);
  });
  it.each(['Biking', 'Other', 'Swimming'])('classe le sport %s comme non pris en charge', async sport => { expect(await parse(tcx(lap(), sport))).toBeNull(); });
  it.each([
    '<broken', tcx().replace('</Activity>', '</Wrong>'), '<!DOCTYPE x><x/>', '<x/>',
    tcx().replace('<TotalTimeSeconds>60</TotalTimeSeconds>', ''),
    tcx().replace('<TotalTimeSeconds>60', '<TotalTimeSeconds>-1'),
    tcx().replace('<TotalTimeSeconds>60', '<TotalTimeSeconds>NaN'),
    tcx().replaceAll('2026-01-01', '2026-02-30'),
    tcx(lap(0, point(10) + point(5))), tcx(lap(0, '<Trackpoint><AltitudeMeters>2</AltitudeMeters></Trackpoint>')),
    tcx().replaceAll(stamp(0), '2026-01-01T10:00:00'),
    tcx().replace('</Activities>', '<Activity Sport="Running"/></Activities>'),
  ])('rejette une structure ou des mesures non exploitables (%#)', async xml => { await expect(parse(xml)).rejects.toThrow(); });
});

describe('importation TCX et dédoublonnage atomique', () => {
  it('traite plusieurs fichiers, poursuit après erreur et publie des instantanés', async () => {
    const storage = repository(); const reports: TcxReport[] = [];
    const report = await importTcxFiles([file(), file(tcx(), 'renommee.tcx'), file('<bad'), file(tcx(lap(), 'Biking')), file(tcx(lap(120, point(120))))], storage, r => reports.push(r), readXml);
    expect(report).toMatchObject({ total: 5, processed: 5, imported: 2, duplicates: 1, invalid: 1, unsupported: 1 });
    expect(reports[0].processed).toBe(0); expect(reports.at(-1)?.processed).toBe(5);
    expect(await storage.list()).toHaveLength(2);
    const parsed = (await parse())!; expect(await storage.getDetails(parsed.session.id)).toEqual(parsed.details);
  });
  it('ne remplace jamais un identifiant ni ses détails', async () => {
    const storage = repository(), result = (await parse())!;
    await storage.addImported(result.session, result.details);
    expect(await storage.addImported({ ...result.session, durationSeconds: 100 }, { id: result.session.id })).toBe(false);
    expect(await storage.getDetails(result.session.id)).toEqual(result.details);
  });
  it('détecte un doublon JSON/TCX avec fuseau connu sans modifier la séance Polar', async () => {
    const storage = repository();
    const polar = parsePolar(JSON.stringify({ id: 'synthetic-tcx-comparison', exercises: [{ sport: { id: '1' }, startTime: '2026-01-01T11:00:00', timezoneOffsetMinutes: 60, durationMillis: 60000, distanceMeters: 150 }] }), 'training-session_synthetic.json')!;
    await storage.addImported(polar.session, polar.details);
    expect(await importTcxFiles([file()], storage, () => {}, readXml)).toMatchObject({ duplicates: 1, imported: 0 });
    expect(await storage.list()).toEqual([polar.session]); expect(await storage.getDetails(polar.session.id)).toEqual(polar.details);
  });
  it('sérialise deux imports TCX de contenus différents mais équivalents', async () => {
    const storage = repository(); const a = (await parse())!, b = (await parse(tcx(lap(0, point(0, '<Cadence>80</Cadence>')))))!;
    expect(a.session.id).not.toBe(b.session.id);
    expect((await Promise.all([storage.addImported(a.session, a.details), storage.addImported(b.session, b.details)])).sort()).toEqual([false, true]);
    expect(await storage.list()).toHaveLength(1);
  });
  it('conserve les séances distinctes proches, sans distance ou sans fuseau fiable', async () => {
    const base = (await parse())!.session;
    for (const extra of [{ startTime: stamp(2) }, { durationSeconds: 63 }, { distanceMeters: 151 }, { distanceMeters: undefined }, { startTime: '2026-01-01T10:00:00', timezoneOffsetMinutes: undefined }]) {
      expect(isTcxDuplicate(base, { ...base, ...extra, id: 'other' })).toBe(false);
    }
    const storage = repository(); await storage.addImported({ ...base, id: 'polar:uncertain', source: undefined, startTime: '2026-01-01T10:00:00' }, { id: 'polar:uncertain' });
    expect(await importTcxFiles([file()], storage, () => {}, readXml)).toMatchObject({ imported: 1, duplicates: 0 });
  });
  it('applique les trois tolérances simultanément et refuse la seule distance', async () => {
    const base = { ...(await parse())!.session, distanceMeters: 5000 };
    expect(isTcxDuplicate(base, { ...base, startTime: stamp(1), durationSeconds: 62, distanceMeters: 5005 })).toBe(true);
    expect(isTcxDuplicate(base, { ...base, startTime: stamp(10) })).toBe(false);
    expect(isTcxDuplicate(base, { ...base, distanceMeters: 5006 })).toBe(false);
    expect(isTcxDuplicate(base, { ...base, sport: 'CYCLING' })).toBe(false);
  });
  it('interrompt proprement en cas d’erreur de stockage', async () => {
    const storage = repository(); storage.addImported = vi.fn().mockRejectedValue(new Error('quota'));
    const result = await importTcxFiles([file(), file()], storage, () => {}, readXml);
    expect(result.error).toContain('stockage'); expect(result.invalid).toBe(0); expect(result.processed).toBe(0);
  });
  it('refuse une extension inattendue et un fichier trop volumineux avant lecture', async () => {
    const storage = repository(), large = file(); Object.defineProperty(large, 'size', { value: MAX_TCX_BYTES + 1 });
    const read = vi.spyOn(large, 'text');
    expect(await importTcxFiles([large, file(tcx(), 'sortie.zip')], storage, () => {}, readXml)).toMatchObject({ invalid: 2, imported: 0 });
    expect(read).not.toHaveBeenCalled();
  });
  it('ne change pas la politique historique entre deux imports JSON', async () => {
    const storage = repository(), base: RunningSession = { ...(await parse())!.session, id: 'polar:a', source: undefined };
    expect(await storage.addImported(base, { id: base.id })).toBe(true);
    expect(await storage.addImported({ ...base, id: 'polar:b' }, { id: 'polar:b' })).toBe(true);
  });
});


describe('régression sélection et comptage TCX', () => {
  it.each(['sortie.TCX', 'sortie.tcx', 'sortie.TcX'])('traite le fichier sélectionné %s et garde son total à chaque progression', async name => {
    const storage = repository(), reports: TcxReport[] = [];
    const result = await importTcxFiles([file(tcx(), name)], storage, r => reports.push(r), readXml);
    expect(result).toMatchObject({ total: 1, processed: 1, imported: 1, invalid: 0 });
    expect(reports.every(r => r.total === 1)).toBe(true); expect(reports[0].processed).toBe(0);
  });
  it('annonce explicitement la sélection vide sans accéder au stockage', async () => {
    const storage = repository(), add = vi.spyOn(storage, 'addImported');
    const report = await importTcxFiles([], storage, () => {}, readXml);
    expect(report.total).toBe(0); expect(report.error).toContain('Aucun fichier TCX sélectionné'); expect(add).not.toHaveBeenCalled();
  });
  it('compte un XML invalide et publie un motif sans nom personnel ni contenu XML', async () => {
    const reports: TcxReport[] = [];
    const result = await importTcxFiles([file('<private-example', 'nom-prive.TCX')], repository(), r => reports.push(r), readXml);
    expect(result).toMatchObject({ total: 1, processed: 1, invalid: 1, imported: 0 });
    expect(result.issues[0]).toContain('Fichier n°1'); expect(result.issues[0]).toContain('TCX invalide');
    expect(JSON.stringify(result)).not.toContain('nom-prive'); expect(JSON.stringify(result)).not.toContain('private-example');
    expect(reports[0].issues).toEqual([]);
  });
  it('distingue une erreur de lecture, une extension incorrecte et la limite de taille', async () => {
    const unreadable = file(); vi.spyOn(unreadable, 'text').mockRejectedValue(new Error('private-path'));
    const large = file(); Object.defineProperty(large, 'size', { value: MAX_TCX_BYTES + 1 });
    const result = await importTcxFiles([unreadable, file(tcx(), 'sortie.zip'), large], repository(), () => {}, readXml);
    expect(result).toMatchObject({ total: 3, processed: 3, invalid: 3 });
    expect(result.issues[0]).toContain('Lecture du fichier impossible');
    expect(result.issues[1]).toContain('Extension non prise en charge'); expect(result.issues[2]).toContain('16 Mio');
    expect(JSON.stringify(result)).not.toContain('private-path');
  });
  it('conserve la sélection initiale même si le tableau fourni est vidé pendant la progression', async () => {
    const files = [file()];
    const report = await importTcxFiles(files, repository(), () => { files.length = 0; }, readXml);
    expect(report).toMatchObject({ total: 1, processed: 1, imported: 1 });
  });
});
