import { importPolarArchive } from './archive';
import { sessionRepository } from '../storage/database';
self.onmessage = async (event: MessageEvent<Blob>) => {
  try {
    const report = await importPolarArchive(event.data, sessionRepository, report => self.postMessage({ type: 'progress', report }));
    self.postMessage({ type: 'done', report });
  } catch {
    self.postMessage({ type: 'error' });
  }
};
