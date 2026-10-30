import { createSessionRepository } from '../storage/database';
import { runPolarWorkerImport, type PolarWorkerRequest } from './polar-worker-task';
self.onmessage = (event: MessageEvent<PolarWorkerRequest>) => {
  void runPolarWorkerImport(event.data, createSessionRepository(event.data.database), message => self.postMessage(message));
};
