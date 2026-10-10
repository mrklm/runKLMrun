import type { SessionRepository } from './contracts';
import type { SessionDetails } from '../types/session';
export type DetailsState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; details: SessionDetails | undefined };
/** Le nettoyage de l'effet invalide cette lecture, même si IndexedDB finit plus tard. */
export function loadSessionDetails(repository: Pick<SessionRepository, 'getDetails'>, id: string, publish: (state: DetailsState) => void): () => void {
  let active = true;
  publish({ status: 'loading' });
  Promise.resolve().then(() => repository.getDetails(id)).then(
    details => { if (active) publish({ status: 'ready', details }); },
    () => { if (active) publish({ status: 'error' }); },
  );
  return () => { active = false; };
}
