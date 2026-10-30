import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { deleteDB } from 'idb';
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
import { createSessionRepository } from '../storage/database';
import { runPolarWorkerImport, type PolarWorkerMessage } from './polar-worker-task';
import { emptyReport } from './import-report';
const databases: string[] = [];
afterEach(async () => { await Promise.all(databases.splice(0).map(name => deleteDB(name))); vi.restoreAllMocks(); });
async function zip() {
  const writer = new ZipWriter(new BlobWriter(), { useWebWorkers: false });
  for (const id of ['a', 'b']) await writer.add(`training-session_${id}.json`, new TextReader(JSON.stringify({ exercises: [{ sport: 'RUNNING', startTime: '2026-10-20T10:00:00', duration: 'PT10M' }] })));
  return writer.close();
}
function setup() {
  const database = `worker-task-test-${crypto.randomUUID()}`; databases.push(database);
  const repository = createSessionRepository(database), messages: PolarWorkerMessage[] = [];
  return { database, repository, messages, post: (message: PolarWorkerMessage) => messages.push(structuredClone(message)) };
}
it('termine avec les seuls identifiants créés et ne recompte pas les doublons', async () => {
  const { database, repository, messages, post } = setup(), file = await zip();
  await runPolarWorkerImport({ file, database, batchId: 'one' }, repository, post);
  expect(messages.at(-1)).toMatchObject({ type: 'done', batchId: 'one', report: { imported: 2 }, importedIds: ['polar:a', 'polar:b'] });
  expect((await repository.list()).map(session => session.id)).toEqual(['polar:a', 'polar:b']);
  await runPolarWorkerImport({ file, database, batchId: 'two' }, repository, post);
  expect(messages.at(-1)).toMatchObject({ type: 'done', batchId: 'two', report: { imported: 0, duplicates: 2 }, importedIds: [] });
});
it('transmet les créations validées après une exception récupérable hors du parseur', async () => {
  const { database, repository, messages, post } = setup();
  await runPolarWorkerImport({ file: new Blob(), database, batchId: 'recoverable' }, repository, post,
    async (_file, repo, progress, _reference, onAdded) => {
      await repo.addImported({ id: 'committed', title: 'Synthétique', date: '2026-10-20', durationSeconds: 600 });
      onAdded?.('committed'); progress({ ...emptyReport(), imported: 1 }); throw new Error('Fermeture ZIP');
    });
  expect(messages.at(-1)).toMatchObject({ type: 'error', batchId: 'recoverable', importedIds: ['committed'], report: { imported: 1 } });
  expect(await repository.list()).toHaveLength(1);
});
it('ne signale aucune création si la transaction échoue et conserve les succès partiels', async () => {
  const { database, repository, messages, post } = setup(), add = repository.addImported.bind(repository);
  vi.spyOn(repository, 'addImported').mockImplementation(async (...args) => {
    if (args[0].id === 'polar:b') throw new Error('Quota synthétique');
    return add(...args);
  });
  await runPolarWorkerImport({ file: await zip(), database, batchId: 'partial' }, repository, post);
  expect(messages.at(-1)).toMatchObject({ type: 'done', importedIds: ['polar:a'], report: { imported: 1, error: expect.any(String) } });
});
it('attend la fin de l’écriture avant le message de création', async () => {
  const { database, repository, messages, post } = setup();
  let release!: () => void;
  const commit = new Promise<void>(resolve => { release = resolve; });
  const imported = runPolarWorkerImport({ file: new Blob(), database, batchId: 'waiting' }, repository, post,
    async (_file, _repo, _progress, _reference, onAdded) => { await commit; onAdded?.('committed'); return { ...emptyReport(), imported: 1 }; });
  expect(messages).toEqual([]); release(); await imported;
  expect(messages).toEqual([{ type: 'done', batchId: 'waiting', importedIds: ['committed'], report: { ...emptyReport(), imported: 1 } }]);
});
