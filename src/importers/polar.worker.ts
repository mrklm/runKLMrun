import { importPolarArchive } from './archive';
import { createSessionRepository } from '../storage/database';
self.onmessage = async (event: MessageEvent<{ file: Blob; database: string }>) => {
  try {
    const importedIds: string[] = [];
    const report = await importPolarArchive(event.data.file, createSessionRepository(event.data.database), report => self.postMessage({ type: 'progress', report }), new Date(), id => importedIds.push(id));
    self.postMessage({ type: 'done', report, importedIds });
  } catch {
    self.postMessage({ type: 'error' });
  }
};
