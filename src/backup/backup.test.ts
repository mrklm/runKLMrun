import { describe, expect, it } from 'vitest';
import { canonicalJson, createBackup, parseBackup, sha256, verifyBackup } from './format';
import { validateBackupData } from './validation';
import { prepareRestore } from './merge';
import type { BackupData } from '../types/backup';

import { fixture } from './test-fixture';
const empty = (): BackupData => ({ sessions: [], details: [], coachProfile: null });
describe('format de sauvegarde', () => {
  it('exporte le format vide indépendant de la version IndexedDB', async () => {
    const b = await createBackup(empty(), '0.4.0', '2026-10-10T10:00:00Z');
    expect(b.formatVersion).toBe(1); expect(b.appVersion).toBe('0.4.0');
    expect(await parseBackup(JSON.stringify(b))).toEqual(b);
  });
  it('préserve toutes les données, nulls, unités, champs facultatifs et durées personnalisées', async () => {
    const data = fixture(), before = structuredClone(data);
    const b = await createBackup(data, '0.4.0');
    expect((await parseBackup(JSON.stringify(b))).data).toEqual(data); expect(data).toEqual(before);
    b.data.sessions[0].title = 'Modification'; expect(data).toEqual(before);
  });
  it('calcule SHA-256 selon le vecteur connu et sérialise de façon déterministe', async () => {
    expect(await sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(canonicalJson({ b: 2, a: { z: null, x: 1 }, absent: undefined })).toBe(canonicalJson({ a: { x: 1, z: null }, b: 2 }));
    expect(canonicalJson([2, 1])).not.toBe(canonicalJson([1, 2]));
  });
  it('refuse une altération des données ou des métadonnées', async () => {
    const b = await createBackup(fixture(), '0.4.0'); b.data.sessions[0].title = 'Altération';
    await expect(verifyBackup(b)).rejects.toThrow('intégrité');
    const other = await createBackup(empty(), '0.4.0'); other.exportedAt = '2026-10-01T10:00:00Z';
    await expect(verifyBackup(other)).rejects.toThrow('intégrité');
  });
  it.each([['format', 'unknown', 'pas une sauvegarde'], ['formatVersion', 3, 'version'], ['integrity', null, 'invalides']])('refuse %s non reconnu', async (key, value, error) => {
    const b = { ...await createBackup(empty(), '0.4.0'), [key]: value };
    await expect(verifyBackup(b)).rejects.toThrow(String(error));
  });
  it('refuse un JSON mal formé', async () => { await expect(parseBackup('{')).rejects.toThrow('JSON'); });
  it('accepte un ancien profil et des séances sans détails', async () => {
    const data = fixture(); data.details = []; data.coachProfile!.availability = { minutesPerSession: 40 };
    expect((await createBackup(data, '0.4.0')).data).toEqual(data);
  });
  it.each([
    (d: BackupData) => { d.sessions.push(d.sessions[0]); },
    (d: BackupData) => { d.details.push(d.details[0]); },
    (d: BackupData) => { d.details[0].id = 'orphan'; },
    (d: BackupData) => { d.sessions[0].id = ''; },
    (d: BackupData) => { d.sessions[0].durationSeconds = -1; },
    (d: BackupData) => { d.sessions[0].date = 42 as unknown as string; },
    (d: BackupData) => { d.details[0].gps![0].latitude = 91; },
    (d: BackupData) => { d.details[0].heartRate![0].timeSeconds = NaN; },
    (d: BackupData) => { d.coachProfile!.availability.maxMinutesByDay!.monday = 0; },
    (d: BackupData) => { d.coachProfile!.revision = 0; },
    (d: BackupData) => { d.coachProfile!.id = 'unknown' as 'local'; },
    (d: BackupData) => { (d as unknown as Record<string, unknown>).unknown = {}; },
  ])('refuse une structure incohérente sans la modifier (%#)', change => {
    const data = fixture(); change(data); const before = structuredClone(data);
    expect(() => validateBackupData(data)).toThrow(); expect(data).toEqual(before);
  });
  it('refuse les clés étrangères et les tentatives de pollution de prototype', async () => {
    const b = await createBackup(empty(), '0.4.0');
    const text = JSON.stringify(b).replace('"data":{', '"data":{"__proto__":{"polluted":true},');
    await expect(parseBackup(text)).rejects.toThrow();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
describe('préparation pure des restaurations', () => {
  it('remplace intégralement et respecte un profil absent', () => {
    const result = prepareRestore(fixture(), empty(), { mode: 'replace', profile: 'restore' }, '2026-10-10T10:00:00Z');
    expect(result.data).toEqual(empty()); expect(result.report.profile).toBe('removed');
  });
  it('conserve un couple local conflictuel, même si le fichier contient davantage de détails', () => {
    const local = fixture(), incoming = fixture(); incoming.sessions[0].title = 'Autre résumé'; incoming.details[0].speed = [{ timeSeconds: 0, value: 2 }];
    const before = structuredClone(local);
    const result = prepareRestore(local, incoming, { mode: 'merge', profile: 'keep' }, '');
    expect(result.data).toEqual(local); expect(result.report.conflicts).toBe(1); expect(local).toEqual(before);
  });
  it('conserve les détails locaux différents et complète seulement les détails absents', () => {
    const local = fixture(), incoming = fixture(); incoming.details[0].heartRate = [];
    expect(prepareRestore(local, incoming, { mode: 'merge', profile: 'keep' }, '').data.details).toEqual(local.details);
    local.details = [];
    expect(prepareRestore(local, incoming, { mode: 'merge', profile: 'keep' }, '').data.details).toEqual(incoming.details);
  });
  it('garde les identifiants différents malgré une ressemblance TCX/Polar et avertit symétriquement', () => {
    const polar = fixture(), tcx = fixture(); tcx.sessions[0].id = 'tcx:synthetic'; tcx.sessions[0].source = 'tcx'; tcx.details[0].id = 'tcx:synthetic';
    for (const [local, incoming] of [[polar, tcx], [tcx, polar]]) {
      const result = prepareRestore(local, incoming, { mode: 'merge', profile: 'keep' }, '');
      expect(result.data.sessions).toHaveLength(2); expect(result.data.details).toHaveLength(2); expect(result.report.warnings.join()).toContain('ressemblance');
    }
  });
  it('conserve le profil local ou son absence sauf choix explicite', () => {
    expect(prepareRestore(empty(), fixture(), { mode: 'merge', profile: 'keep' }, '').data.coachProfile).toBeNull();
    const local = fixture(), incoming = fixture(); incoming.coachProfile!.availability.maxMinutesByDay!.monday = 90;
    expect(prepareRestore(local, incoming, { mode: 'merge', profile: 'keep' }, '').data.coachProfile).toEqual(local.coachProfile);
    const restored = prepareRestore(local, incoming, { mode: 'merge', profile: 'restore' }, '2026-10-10T10:00:00Z').data.coachProfile!;
    expect(restored.availability).toEqual(incoming.coachProfile!.availability);
    expect(restored.createdAt).toBe(incoming.coachProfile!.createdAt); expect(restored.updatedAt).toBe('2026-10-10T10:00:00Z'); expect(restored.revision).toBe(2);
  });
});
