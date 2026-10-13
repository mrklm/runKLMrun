import { importPolarArchive } from './archive';
import { sessionRepository } from '../storage/database';
self.onmessage = async (event: MessageEvent<Blob>) => {
  try {
    const importedIds: string[] = [];
    const report = await importPolarArchive(event.data, sessionRepository, report => self.postMessage({ type: 'progress', report }), new Date(), id => importedIds.push(id));
    self.postMessage({ type: 'done', report, importedIds });
  } catch {
    self.postMessage({ type: 'error' });
  }
};
