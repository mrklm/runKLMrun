import { it, expect, vi } from 'vitest';
import { deleteDB, openDB } from 'idb';
import { readSummaries } from './browser';
import { synthetic } from './fixtures';
it('lit uniquement sessions en readonly sans changer la version ni les données', async () => {
  const name=`diagnostic-${crypto.randomUUID()}`;
  const db=await openDB(name,1,{upgrade(db){db.createObjectStore('sessions',{keyPath:'id'});}});
  const s=synthetic('s',5000,0);await db.put('sessions',s);
  const spy=vi.spyOn(IDBDatabase.prototype,'transaction');
  try { expect(await readSummaries(name)).toEqual([s]);expect(spy.mock.calls.every(call=>call[0]==='sessions'&&call[1]==='readonly')).toBe(true);expect(db.version).toBe(1); }
  finally {spy.mockRestore();db.close();await deleteDB(name);}
});
it('ne crée pas de base inexistante', async () => {
  const name=`absent-${crypto.randomUUID()}`;
  await expect(readSummaries(name)).rejects.toThrow('Base existante');
  expect((await indexedDB.databases()).some(db=>db.name===name)).toBe(false);
});
