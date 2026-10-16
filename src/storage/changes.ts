import { DATABASE_NAME } from './database-connection';
export type ChangeScope = 'sessions' | 'profile' | 'configuration' | 'planning' | 'shoes';
export interface StorageChange { database: string; scopes: ChangeScope[] }
const channelName = 'runklmrun-storage-changed';
const scopes: ChangeScope[] = ['sessions', 'profile', 'configuration', 'planning', 'shoes'];
/** Invalidation seulement : aucun contenu personnel, aucune écriture à la réception. */
export function createChangeBus(transport = typeof self !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
  const source = crypto.randomUUID();
  const listeners = new Set<(change: StorageChange) => void>();
  const pending = new Map<string, Set<ChangeScope>>();
  const batches = new Map<string, { depth: number; scopes: Set<ChangeScope> }>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let receiver: BroadcastChannel | undefined;
  const deliver = (change: StorageChange) => {
    const set = pending.get(change.database) ?? new Set<ChangeScope>();
    change.scopes.forEach(scope => set.add(scope)); pending.set(change.database, set);
    if (timer !== undefined) return;
    timer = setTimeout(() => {
      timer = undefined;
      const changes = [...pending]; pending.clear();
      for (const [database, set] of changes) for (const listener of listeners) {
        try { listener({ database, scopes: [...set] }); } catch { /* L’écriture est déjà validée. */ }
      }
    }, 0);
  };
  const emit = (change: StorageChange) => {
    deliver(change);
    if (transport) try {
      const channel = new BroadcastChannel(channelName);
      channel.postMessage({ ...change, source }); channel.close();
    } catch { /* Le rafraîchissement local reste disponible. */ }
  };
  return {
    subscribe(listener: (change: StorageChange) => void) {
      listeners.add(listener);
      if (transport && !receiver) try {
        receiver = new BroadcastChannel(channelName);
        receiver.onmessage = ({ data }) => {
          if (!data || data.source === source || typeof data.database !== 'string' || !Array.isArray(data.scopes)
            || !data.scopes.every((scope: unknown) => scopes.includes(scope as ChangeScope))) return;
          deliver({ database: data.database, scopes: data.scopes });
        };
      } catch { /* Sans BroadcastChannel, notifications locales uniquement. */ }
      return () => { listeners.delete(listener); if (!listeners.size) { receiver?.close(); receiver = undefined; } };
    },
    committed(database: string, changed: ChangeScope[]) {
      const batch = batches.get(database);
      const immediate: ChangeScope[] = [];
      for (const scope of changed) {
        if (batch && scope === 'sessions') batch.scopes.add(scope);
        else immediate.push(scope);
      }
      if (immediate.length) emit({ database, scopes: immediate });
    },
    batch(database: string) {
      const batch = batches.get(database) ?? { depth: 0, scopes: new Set<ChangeScope>() };
      batch.depth++; batches.set(database, batch); let ended = false;
      return () => {
        if (ended) return; ended = true;
        if (--batch.depth) return;
        batches.delete(database);
        if (batch.scopes.size) emit({ database, scopes: [...batch.scopes] });
      };
    },
  };
}
export const storageChanges = createChangeBus();
export function subscribeStorage(scopes: ChangeScope[], listener: () => void, database = DATABASE_NAME) {
  return storageChanges.subscribe(change => { if (change.database === database && change.scopes.some(scope => scopes.includes(scope))) listener(); });
}
