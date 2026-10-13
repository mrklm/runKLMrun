import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteDB } from 'idb';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { browserRetentionLock, createRetentionService, RETENTION_KEY, type RetentionLock } from './detail-retention';
import { openDatabase } from './database-connection';
import { createSessionRepository } from './database';
import { totals } from '../core/analysis/session-summary';
import { History } from '../pages/History';
import { SessionCurves, SessionInformation } from '../pages/Session';
import type { RunningSession } from '../types/session';

const names: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllGlobals(); await Promise.all(names.splice(0).map(name => deleteDB(name))); });
const reference = new Date('2026-10-13T12:00:00Z');
const old = (id: string): RunningSession => ({ id, title: 'Sortie synthétique', date: '2026-01-01', startTime: '2026-01-01T12:00:00Z', durationSeconds: 600, distanceMeters: 2000 });
function sharedLock(): RetentionLock {
  let busy = false;
  return async task => {
    if (busy) return undefined;
    busy = true;
    try { return await task(); } finally { busy = false; }
  };
}
async function setup(sessions = [old('old')], options: { pause?: () => Promise<void>; now?: () => Date } = {}) {
  const name = `retention-test-${crypto.randomUUID()}`; names.push(name);
  const map = new Map<string, string>();
  const preferences = { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); } };
  const lock = sharedLock();
  const config = { name, preferences, lock, now: () => reference, pause: async () => {}, ...options };
  const repository = createSessionRepository(name);
  for (const s of sessions) await repository.addImported(s, { id: s.id, heartRate: [{ timeSeconds: 0, value: 140 }] });
  return { name, map, repository, config, service: createRetentionService(config) };
}

describe('conservation explicite des détails', () => {
  it('compte les clés sans lire les mesures et protège les cas incertains ou sans résumé valide', async () => {
    const { name, service } = await setup([
      old('old'), { ...old('recent'), date: '2026-10-12', startTime: '2026-10-12T12:00:00Z' },
      { ...old('uncertain'), date: '', startTime: undefined }, { ...old('invalid'), durationSeconds: -1 },
    ]);
    const db = await openDatabase(name); await db.put('details', { id: 'orphan' }); db.close();
    const get = vi.spyOn(IDBObjectStore.prototype, 'get');
    const getAll = vi.spyOn(IDBObjectStore.prototype, 'getAll');
    const cursor = vi.spyOn(IDBObjectStore.prototype, 'openCursor');
    expect(await service.analyze()).toEqual({ total: 5, expired: 1, kept: 1, uncertain: 1, invalidSummary: 2 });
    expect(get.mock.contexts.every(store => (store as IDBObjectStore).name === 'sessions')).toBe(true);
    expect(getAll).not.toHaveBeenCalled(); expect(cursor).not.toHaveBeenCalled();
  });
  it('nettoie automatiquement sans activation après analyse', async () => {
    const { service, repository } = await setup();
    await service.analyze();
    await expect(service.activateAndClean(false)).rejects.toThrow('Confirmez');
    expect((await service.maintain())?.deleted).toBe(1);
    expect(await repository.getDetails('old')).toBeUndefined();
  });
  it('préserve résumés, coach, dates incertaines et détails orphelins après confirmation', async () => {
    const { name, service, repository } = await setup([old('old'), { ...old('uncertain'), date: 'invalide' }, { ...old('invalid'), title: 42 as unknown as string }]);
    const before = await repository.list();
    const db = await openDatabase(name);
    const profile = { id: 'local' as const, goal: {}, availability: {}, preferences: {}, revision: 1, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
    await db.put('coachProfile', profile); await db.put('details', { id: 'orphan' });
    expect((await service.activateAndClean(true))?.deleted).toBe(1);
    expect(await repository.list()).toEqual(before);
    expect(await repository.getDetails('old')).toBeUndefined();
    for (const id of ['uncertain', 'orphan', 'invalid']) expect(await repository.getDetails(id)).toBeDefined();
    expect(await db.get('coachProfile', 'local')).toEqual(profile); db.close();
    expect(service.isEnabled()).toBe(true);
  });
  it('traite par lots, interrompt entre les lots et reprend', async () => {
    const controller = new AbortController();
    const { service } = await setup(Array.from({ length: 61 }, (_, i) => old(`s${String(i).padStart(3, '0')}`)));
    const progress: number[] = [];
    const first = await service.activateAndClean(true, { signal: controller.signal, progress: value => { progress.push(value.deleted); controller.abort(); } });
    expect(first).toEqual({ deleted: 25, scanned: 25, interrupted: true });
    expect((await service.analyze()).total).toBe(36);
    const second = await service.activateAndClean(true, { progress: value => progress.push(value.deleted) });
    expect(second?.deleted).toBe(36); expect(progress).toEqual([25, 25, 36]);
    expect((await service.analyze()).total).toBe(0);
  });
  it('revérifie le résumé dans chaque lot', async () => {
    let name = '';
    const fixture = await setup(Array.from({ length: 26 }, (_, i) => old(`s${String(i).padStart(3, '0')}`)), { pause: async () => {
      const db = await openDatabase(name); await db.delete('sessions', 's025'); db.close();
    } }); name = fixture.name;
    expect((await fixture.service.activateAndClean(true))?.deleted).toBe(25);
    expect(await fixture.repository.getDetails('s025')).toBeDefined();
  });
  it('conserve un état reprenable après une erreur entre les lots', async () => {
    let fail = true;
    const { service, repository } = await setup(Array.from({ length: 26 }, (_, i) => old(`s${i}`)), { pause: async () => { if (fail) throw new Error('synthetic failure'); } });
    await expect(service.activateAndClean(true)).rejects.toThrow('synthetic failure');
    expect(await repository.list()).toHaveLength(26);
    expect((await service.analyze()).total).toBe(1);
    fail = false;
    expect((await service.activateAndClean(true))?.deleted).toBe(1);
  });
  it('refuse deux nettoyages concurrents utilisant le même verrou', async () => {
    let release!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    let entered!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const { service, config } = await setup(Array.from({ length: 26 }, (_, i) => old(`s${i}`)), { pause: async () => { entered(); await waiting; } });
    const first = service.activateAndClean(true);
    await started;
    const secondTab = createRetentionService(config);
    expect(await secondTab.activateAndClean(true)).toBeUndefined();
    release(); expect((await first)?.deleted).toBe(26);
  });
  it('revérifie au démarrage même sans attendre 24 heures', async () => {
    let current = new Date('2026-01-31T12:00:00Z');
    const { service, config, repository } = await setup([old('old')], { now: () => current });
    expect((await service.activateAndClean(true))?.deleted).toBe(0);
    const restarted = createRetentionService(config);
    expect((await restarted.maintain())?.scanned).toBe(1);
    current = new Date('2026-02-01T12:00:00Z');
    expect((await restarted.maintain())?.deleted).toBe(1);
    expect(await repository.list()).toEqual([old('old')]);
  });
  it('ne dépend plus des préférences pour l’entretien automatique', async () => {
    const { config, repository, map } = await setup();
    map.set(RETENTION_KEY, '{invalid');
    const broken = createRetentionService({ ...config, preferences: { getItem: () => null, setItem: () => { throw new Error('stockage bloqué'); } } });
    await expect(broken.activateAndClean(true)).rejects.toThrow('stockage bloqué');
    expect(await repository.getDetails('old')).toBeDefined();
    expect((await broken.maintain())?.deleted).toBe(1);
  });
  it('préserve historique, liens, statistiques et consultation du résumé sans courbes', async () => {
    const { service, repository } = await setup();
    const before = await repository.list(), stats = totals(before);
    const history = renderToStaticMarkup(createElement(History, { sessions: before }));
    await service.activateAndClean(true);
    const after = await repository.list();
    expect(totals(after)).toEqual(stats);
    expect(renderToStaticMarkup(createElement(History, { sessions: after }))).toBe(history);
    expect(history).toContain('#/seance/old');
    expect(renderToStaticMarkup(createElement(SessionInformation, { session: after[0] }))).toContain('Informations générales');
    expect(renderToStaticMarkup(createElement(SessionCurves, { details: await repository.getDetails('old') }))).toContain('Détails indisponibles');
  });
});

it('annule entièrement le lot défaillant sans supprimer ses résumés', async () => {
  const { service, repository } = await setup([old('a'), old('b')]);
  const original = IDBObjectStore.prototype.delete;
  const spy = vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(function (this: IDBObjectStore, key) {
    if (this.name === 'details' && key === 'b') throw new Error('Erreur synthétique');
    return original.call(this, key);
  });
  await expect(service.activateAndClean(true)).rejects.toThrow('Erreur synthétique');
  spy.mockRestore();
  expect((await service.analyze()).total).toBe(2);
  expect(await repository.list()).toHaveLength(2);
  expect((await service.activateAndClean(true))?.deleted).toBe(2);
});
it('refuse le nettoyage si le navigateur ne dispose pas du verrou partagé', async () => {
  vi.stubGlobal('navigator', {});
  const task = vi.fn();
  await expect(browserRetentionLock('synthetic')(task)).rejects.toThrow('verrouiller');
  expect(task).not.toHaveBeenCalled();
});
it('respecte une interruption demandée avant le premier lot', async () => {
  const { service, repository } = await setup();
  const controller = new AbortController(); controller.abort();
  expect((await service.activateAndClean(true, { signal: controller.signal }))?.interrupted).toBe(true);
  expect(service.isEnabled()).toBe(false);
  expect(await repository.getDetails('old')).toBeDefined();
});
