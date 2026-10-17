import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteDB, openDB } from 'idb';
import { createCoachProfileRepository, ProfileConflictError } from './coach-profile';
import { createSessionRepository } from './database';
import { openDatabase, StorageBlockedError } from './database-connection';
import { emptyProfileValues, type CoachProfileValues } from '../types/coach-profile';
const names: string[] = [];
const name = () => { const n = `profile-test-${crypto.randomUUID()}`; names.push(n); return n; };
const now = () => new Date('2026-10-10T12:00:00Z');
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(names.splice(0).map(n => deleteDB(n))); });
describe('dépôt et migration du profil', () => {
  it('retourne undefined pour un profil absent', async () => { expect(await createCoachProfileRepository(name(), now).get()).toBeUndefined(); });
  it('crée, relit et modifie le profil unique après réouverture', async () => {
    const n = name(), repository = createCoachProfileRepository(n, now);
    const initial = await repository.save(emptyProfileValues(), undefined);
    expect(initial.id).toBe('local'); expect(initial.createdAt).toBe(now().toISOString()); expect(initial.revision).toBe(1);
    const reopened = createCoachProfileRepository(n, () => new Date('2026-10-11T12:00:00Z'));
    expect(await reopened.get()).toEqual(initial);
    const updated = await reopened.save({ ...initial, goal: { kind: 'endurance' }, preferences: { terrain: 'none' } }, initial.revision);
    expect(updated.createdAt).toBe(initial.createdAt); expect(updated.updatedAt).not.toBe(initial.updatedAt); expect(updated.revision).toBe(2);
    expect((await reopened.get())?.goal.kind).toBe('endurance');
    const db = await openDatabase(n); expect(await db.count('coachProfile')).toBe(1); db.close();
  });
  it('préserve exactement sessions et details lors de la migration v2 et des éditions du profil', async () => {
    const n = name();
    const old = await openDB(n, 2, { upgrade(db) { db.createObjectStore('sessions', { keyPath: 'id' }); db.createObjectStore('details', { keyPath: 'id' }); } });
    const session = { id: 'polar:synthetic', title: 'Synthétique', date: '2026-10-01', durationSeconds: 600, distanceMeters: 1000 };
    const details = { id: session.id, heartRate: [{ timeSeconds: 0, value: 130 }, { timeSeconds: 5, value: null }] };
    await old.put('sessions', session); await old.put('details', details); old.close();
    const repository = createCoachProfileRepository(n, now);
    expect(await repository.get()).toBeUndefined();
    const p = await repository.save({ goal: { kind: 'race', distance: { kind: 'custom', meters: 12000 } }, availability: { days: ['monday'], sessionsPerWeek: 1, minutesPerSession: 45 }, preferences: { terrain: 'road' } }, undefined);
    await repository.save({ ...p, goal: { ...p.goal, kind: 'regular' }, availability: { ...p.availability, durationMode: 'custom', maxMinutesByDay: { monday: 90 } } }, p.revision);
    const sessions = createSessionRepository(n);
    expect(await sessions.list()).toEqual([session]); expect(await sessions.getDetails(session.id)).toEqual(details);
    const db = await openDatabase(n); expect(db.version).toBe(8); expect([...db.objectStoreNames]).toEqual(['coachPlanning', 'coachProfile', 'coachSuggestions', 'details', 'evolvingCoach', 'sessions', 'shoeAssignments', 'shoeSettings', 'shoes']); db.close();
  });
  it('refuse les données invalides sans modifier le profil existant', async () => {
    const repo = createCoachProfileRepository(name(), now), p = await repo.save(emptyProfileValues(), undefined);
    await expect(repo.save({ ...p, availability: { sessionsPerWeek: 3, days: ['monday'] } }, p.revision)).rejects.toThrow('3 séances');
    expect(await repo.get()).toEqual(p);
  });
  it('refuse une écriture concurrente obsolète', async () => {
    const n = name(), a = createCoachProfileRepository(n, now), b = createCoachProfileRepository(n, now);
    const p = await a.save(emptyProfileValues(), undefined);
    await b.save({ ...p, goal: { kind: 'return' } }, p.revision);
    await expect(a.save(p, p.revision)).rejects.toBeInstanceOf(ProfileConflictError);
    expect((await a.get())?.goal.kind).toBe('return');
  });
  it('remonte une erreur de lecture et ferme la connexion', async () => {
    const repo = createCoachProfileRepository(name(), now); await repo.get();
    vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementation(() => { throw new Error('Lecture indisponible'); });
    await expect(repo.get()).rejects.toThrow('Lecture indisponible');
  });
  it('remonte une erreur d’écriture sans altérer le profil', async () => {
    const repo = createCoachProfileRepository(name(), now), p = await repo.save(emptyProfileValues(), undefined);
    const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new Error('Quota dépassé'); });
    await expect(repo.save({ ...p, goal: { kind: 'race' } }, p.revision)).rejects.toThrow('Quota dépassé'); spy.mockRestore();
    expect(await repo.get()).toEqual(p);
  });
  it('signale une migration bloquée puis permet la reprise après fermeture de l’ancien onglet', async () => {
    const n = name(), old = await openDB(n, 2, { upgrade(db) { db.createObjectStore('sessions', { keyPath: 'id' }); db.createObjectStore('details', { keyPath: 'id' }); } });
    try { await expect(createCoachProfileRepository(n, now).get()).rejects.toBeInstanceOf(StorageBlockedError); }
    finally { old.close(); }
    expect(await createCoachProfileRepository(n, now).get()).toBeUndefined();
  });
  it('ferme les connexions à la demande d’une autre version', async () => {
    const n = name(), db = await openDatabase(n);
    const next = await openDB(n, db.version + 1); next.close();
    expect(() => db.transaction('sessions')).toThrow();
  });
  it('ne transforme pas un profil corrompu en profil vide', async () => {
    const n = name(), db = await openDatabase(n); await db.put('coachProfile', { id: 'local' } as never); db.close();
    await expect(createCoachProfileRepository(n, now).get()).rejects.toThrow('invalide');
  });
  it('n’écrit pas de profil si l’échéance passée vient d’être choisie', async () => {
    const repo = createCoachProfileRepository(name(), now);
    await expect(repo.save({ ...emptyProfileValues(), goal: { targetDate: '2026-01-01' } } as CoachProfileValues, undefined)).rejects.toThrow('échéance');
    expect(await repo.get()).toBeUndefined();
  });
});

it('fait évoluer un ancien profil et conserve mode, durées inactives, dates et révisions après réouverture', async () => {
  const n = name(), repo = createCoachProfileRepository(n, now);
  const old = await repo.save({ ...emptyProfileValues(), availability: { days: ['monday'], minutesPerSession: 40 } }, undefined);
  expect(old.availability.durationMode).toBeUndefined();
  const custom = await repo.save({ ...old, availability: { ...old.availability, durationMode: 'custom', maxMinutesByDay: { monday: 45, saturday: 90 } } }, old.revision);
  const reopened = createCoachProfileRepository(n, () => new Date('2026-10-11T12:00:00Z'));
  expect(await reopened.get()).toEqual(custom);
  const simple = await reopened.save({ ...custom, availability: { ...custom.availability, durationMode: 'simple' } }, custom.revision);
  expect(await createCoachProfileRepository(n).get()).toEqual(simple);
  expect(simple.availability.maxMinutesByDay).toEqual({ monday: 45, saturday: 90 });
  expect(simple.availability.minutesPerSession).toBe(40);
  expect(simple.createdAt).toBe(old.createdAt); expect(simple.updatedAt).not.toBe(old.updatedAt); expect(simple.revision).toBe(3);
  await expect(reopened.save({ ...simple, availability: { ...simple.availability, maxMinutesByDay: { monday: 0 } } }, simple.revision)).rejects.toThrow('durées');
  expect(await reopened.get()).toEqual(simple);
});
