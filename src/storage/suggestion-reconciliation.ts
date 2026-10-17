import { storageChanges } from './changes';
import { DATABASE_NAME } from './database-connection';
import { createSuggestionRepository } from './coach-suggestions';

const readiness = new Map<string, boolean>();
const observers = new Set<() => void>();
export const reconciliationReady = (name = DATABASE_NAME) => readiness.get(name) === true;
export function subscribeReconciliation(listener: () => void) {
  observers.add(listener); return () => { observers.delete(listener); };
}
function ready(name: string, value: boolean) {
  readiness.set(name, value); observers.forEach(listener => listener());
}

/** Une instance par application, hors du rendu/StrictMode. Coalescence des
 * événements, au plus une transaction en cours. Les imports utilisent déjà
 * beginImportBatch. Aucun détail de mesure n’est chargé. */
export function startSuggestionReconciliation(
  name = DATABASE_NAME,
  reconcile = () => createSuggestionRepository(name).reconcileActivities(),
  onError: () => void = () => console.warn('Rapprochement des suggestions indisponible ; nouvel essai au prochain changement de données ou démarrage.'),
) {
  let stopped = false, running = false, dirty = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function request() {
    if (stopped) return;
    dirty = true; ready(name, false);
    if (running || timer !== undefined) return;
    timer = setTimeout(() => { timer = undefined; void run(); }, 0);
  }
  async function run() {
    if (stopped) return;
    running = true; dirty = false;
    try { await reconcile(); if (!stopped && !dirty) ready(name, true); }
    catch { onError(); /* Pas de données personnelles ni de retry infini. */ }
    finally { running = false; if (dirty) request(); }
  }
  const unsubscribe = storageChanges.subscribe(change => {
    if (change.database === name && change.scopes.some(scope => scope === 'sessions' || scope === 'suggestions')) request();
  });
  // Reprise après fermeture d’onglet, ou import terminé avant l’abonnement.
  request();
  return () => { stopped = true; ready(name, false); unsubscribe(); if (timer !== undefined) clearTimeout(timer); };
}
