import { afterEach, describe, expect, it } from 'vitest';
import { deleteDB, openDB } from 'idb';
import { createShoeRepository } from './shoes';
import { createSessionRepository } from './database';
import { openDatabase } from './database-connection';
import { shoeMileage, sessionsInPeriod, validateShoe } from '../core/shoes/shoes';
import type { Shoe } from '../types/shoe';
import type { RunningSession } from '../types/session';
const names: string[] = [];
afterEach(async () => { await Promise.all(names.splice(0).map(n => deleteDB(n))); });
const shoe = (id = 'shoe'): Shoe => ({ id, name: 'Paire synthétique', firstUseDate: '2025-02-07', status: 'active', isDefault: false, revision: 1 });
const sessions: RunningSession[] = [
  { id: 'a', title: 'A', date: '2025-02-07', durationSeconds: 60, distanceMeters: 5000 },
  { id: 'b', title: 'B', date: '2025-02-08', durationSeconds: 60, distanceMeters: 7000 },
  { id: 'c', title: 'C', date: '2025-02-09', durationSeconds: 60 },
];
async function setup() {
  const name = `shoes-test-${crypto.randomUUID()}`; names.push(name);
  const repository = createShoeRepository(name), training = createSessionRepository(name);
  for (const s of sessions) await training.save(s);
  return { name, repository, training };
}
describe('chaussures et associations', () => {
  it('migre une base v3 sans modifier séances, détails ni profil', async () => {
    const name = `shoes-migration-${crypto.randomUUID()}`; names.push(name);
    const old = await openDB(name, 3, { upgrade(db) { for (const store of ['sessions', 'details', 'coachProfile']) db.createObjectStore(store, { keyPath: 'id' }); } });
    await old.put('sessions', sessions[0]); await old.put('details', { id: 'a' }); old.close();
    const db = await openDatabase(name);
    expect(db.version).toBe(5); expect(await db.get('sessions', 'a')).toEqual(sessions[0]); expect(await db.get('details', 'a')).toEqual({ id: 'a' });
    expect(await db.count('shoes')).toBe(0); db.close();
  });
  it('crée et modifie une date de première utilisation indépendante de l’achat, sans attribution', async () => {
    const { repository, name } = await setup();
    const first = await repository.save({ ...shoe(), purchaseDate: '2025-03-01' });
    expect((await createShoeRepository(name).list()).shoes[0].firstUseDate).toBe('2025-02-07');
    await repository.save({ ...first, firstUseDate: '2024-12-25' }, first.revision);
    const data = await repository.list(); expect(data.shoes[0]).toMatchObject({ firstUseDate: '2024-12-25', purchaseDate: '2025-03-01', revision: 2 }); expect(data.shoeAssignments).toEqual([]);
  });
  it('maintient une seule paire active par défaut et détecte une édition concurrente', async () => {
    const { repository } = await setup();
    const first = await repository.save({ ...shoe('one'), isDefault: true });
    await repository.save({ ...shoe('two'), isDefault: true });
    const data = await repository.list(); expect(data.shoes.filter(s => s.isDefault).map(s => s.id)).toEqual(['two']);
    await expect(repository.save(first, first.revision)).rejects.toThrow('changé');
  });
  it('associe, change et retire une paire sans modifier le résumé', async () => {
    const { repository, training } = await setup();
    await repository.save(shoe('one')); await repository.save(shoe('two'));
    await repository.assign('a', 'one'); await repository.assign('a', 'two', 'one');
    expect((await repository.list()).shoeAssignments).toEqual([{ sessionId: 'a', shoeId: 'two' }]);
    await expect(repository.assign('a', 'one')).rejects.toThrow('changé');
    await repository.assign('a', undefined, 'two'); expect((await repository.list()).shoeAssignments).toEqual([]);
    expect(await training.list()).toEqual(sessions);
  });
  it('attribue par période après confirmation et protège les associations existantes', async () => {
    const { repository } = await setup(); await repository.save(shoe('one')); await repository.save(shoe('two'));
    await repository.assign('a', 'one');
    const ids = sessionsInPeriod(sessions, '2025-02-07', '2025-02-08').map(s => s.id);
    const preview = await repository.preview(ids, 'two'); expect(preview.km).toBe(7); expect(preview.protectedCount).toBe(1);
    await expect(repository.apply(preview, false)).rejects.toThrow('Confirmez');
    expect(await repository.apply(preview, true)).toBe(1);
    const replaced = await repository.preview(ids, 'two', true); expect(replaced.entries).toHaveLength(1);
    await repository.apply(replaced, true);
    expect((await repository.list()).shoeAssignments.every(a => a.shoeId === 'two')).toBe(true);
  });
  it('annule tout un lot si une association a changé depuis l’aperçu', async () => {
    const { repository } = await setup(); await repository.save(shoe('one')); await repository.save(shoe('two'));
    const preview = await repository.preview(['a', 'b'], 'one');
    await repository.assign('b', 'two');
    await expect(repository.apply(preview, true)).rejects.toThrow('changé');
    expect((await repository.list()).shoeAssignments).toEqual([{ sessionId: 'b', shoeId: 'two' }]);
  });
  it('archive et réactive sans perdre date, associations ni kilométrage', async () => {
    const { repository } = await setup(); const active = await repository.save({ ...shoe(), isDefault: true });
    await repository.assign('a', active.id);
    const archived = await repository.save({ ...active, status: 'archived' }, active.revision);
    expect(archived.isDefault).toBe(false); expect(archived.firstUseDate).toBe('2025-02-07');
    expect(shoeMileage(archived, sessions, (await repository.list()).shoeAssignments).km).toBe(5);
    await expect(repository.assign('b', archived.id)).rejects.toThrow('active');
    await repository.save({ ...archived, status: 'active' }, archived.revision);
    expect((await repository.list()).shoeAssignments).toHaveLength(1);
  });
  it('ne crée aucune association par défaut ni lors d’une réimportation', async () => {
    const { repository, training } = await setup(); await repository.save({ ...shoe(), isDefault: true });
    expect(await training.addImported(sessions[0])).toBe(false);
    expect(await training.addImported({ ...sessions[0], id: 'new' })).toBe(true);
    expect((await repository.list()).shoeAssignments).toEqual([]);
  });
});
it('compte chaque séance une seule fois et ignore les distances absentes ou invalides', () => {
  const list = [...sessions, sessions[0], { ...sessions[0], id: 'negative', distanceMeters: -1 }, { ...sessions[0], id: 'nan', distanceMeters: NaN }];
  const assignments = list.map(s => ({ sessionId: s.id, shoeId: 'shoe' }));
  expect(shoeMileage(shoe(), list, assignments)).toMatchObject({ km: 12, count: 5, missing: 3, state: 'normal', remainingKm: undefined });
});
it.each([[79, 'normal'], [80, 'warning'], [100, 'limit'], [105, 'limit']] as const)('calcule l’alerte à %s km', (km, state) => {
  const s = { ...shoe(), limitKm: 100, warningKm: 20 };
  const result = shoeMileage(s, [{ ...sessions[0], distanceMeters: km * 1000 }], [{ sessionId: 'a', shoeId: s.id }]);
  expect(result.state).toBe(state); expect(result.percent).toBe(km); expect(result.remainingKm).toBe(Math.max(0, 100 - km));
});
it('valide les dates et seuils sans imposer une limite ni une date d’achat', () => {
  expect(() => validateShoe(shoe())).not.toThrow();
  expect(() => validateShoe({ ...shoe(), firstUseDate: '2025-02-30' })).toThrow();
  expect(() => validateShoe({ ...shoe(), limitKm: 100, warningKm: 101 })).toThrow();
  expect(() => sessionsInPeriod(sessions, '2025-02-09', '2025-02-07')).toThrow();
});

it('change de mode sans perdre les associations puis convertit explicitement les dates', async () => {
  const { repository, training } = await setup();
  const before = await training.list();
  await repository.save(shoe()); await repository.assign('a', 'shoe');
  await repository.setMode('automatic');
  const automatic = await repository.list(); expect(automatic.settings?.mode).toBe('automatic'); expect(automatic.shoeAssignments).toHaveLength(1);
  await repository.setMode('manual', automatic.settings?.revision);
  const preview = await repository.previewConversion('2026-10-16');
  expect(preview.assignments).toHaveLength(2);
  await expect(repository.convert(preview, false)).rejects.toThrow('Confirmez');
  expect((await repository.list()).shoeAssignments).toHaveLength(1);
  await repository.convert(preview, true);
  expect((await repository.list()).shoeAssignments).toHaveLength(3);
  const manual = await repository.list(); await repository.setMode('automatic', manual.settings?.revision);
  expect((await repository.list()).shoeAssignments).toHaveLength(3); expect(await training.list()).toEqual(before);
});
it('annule la conversion si une date change après l’aperçu', async () => {
  const { repository } = await setup(); const saved = await repository.save(shoe());
  const preview = await repository.previewConversion('2026-10-16');
  await repository.save({ ...saved, firstUseDate: '2025-02-08' }, saved.revision);
  await expect(repository.convert(preview, true)).rejects.toThrow('changé');
  expect((await repository.list()).shoeAssignments).toEqual([]);
});
it('refuse un changement de mode concurrent', async () => {
  const { repository } = await setup(); await repository.setMode('manual');
  await expect(repository.setMode('automatic')).rejects.toThrow('changé');
});
