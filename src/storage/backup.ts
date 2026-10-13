import { withRestoreLock } from './operation-lock';
import { checkBackupFile } from '../backup/compression';
import type { IDBPTransaction } from 'idb';
import { DATABASE_NAME, openDatabase, type RunDatabase } from './database-connection';
import type { BackupData, BackupDocument, BackupExport, RestoreOptions, RestorePreview, RestoreReport } from '../types/backup';
import type { BackupService } from './contracts';
import { BackupError, validateBackupData } from '../backup/validation';
import { canonicalJson, verifyBackup } from '../backup/format';
import { prepareRestore } from '../backup/merge';

const stores = ['sessions', 'details', 'coachProfile', 'shoes', 'shoeAssignments', 'shoeSettings'] as const;
type SnapshotTx = IDBPTransaction<RunDatabase, typeof stores, 'readonly' | 'readwrite'>;
export const RESTORED_CHANNEL = 'runklmrun-restored';
async function readSnapshot(tx: SnapshotTx): Promise<BackupData> {
  const [sessions, details, profiles, shoes, shoeAssignments, shoeSettings] = await Promise.all(stores.map(store => tx.objectStore(store).getAll()));
  if (profiles.length > 1 || (profiles.length === 1 && (!('id' in profiles[0]) || profiles[0].id !== 'local'))) throw new BackupError('Le stockage contient un profil non reconnu. Aucune donnée n’a été modifiée.');
  if (shoeSettings.length > 1 || (shoeSettings[0] && (!('id' in shoeSettings[0]) || shoeSettings[0].id !== 'local'))) throw new BackupError('Réglage de chaussures invalide.');
  return { sessions, details, coachProfile: profiles[0] ?? null, ...(shoes.length || shoeAssignments.length || shoeSettings.length ? { shoes, shoeAssignments, ...(shoeSettings[0] ? { shoeSettings: shoeSettings[0] } : {}) } : {}) } as BackupData;
}
export async function readBackupSnapshot(name = DATABASE_NAME): Promise<BackupData> {
  const db = await openDatabase(name);
  try {
    const tx = db.transaction(stores, 'readonly');
    try {
      const data = await readSnapshot(tx);
      await tx.done; return data;
    } catch (error) { await tx.done.catch(() => undefined); throw error; }
  } finally { db.close(); }
}
export interface PreparedRestore { expected: string; data: BackupData; report: RestoreReport }
type Processor = {
  export(data: BackupData): Promise<BackupExport>;
  parse(file: Blob, signal?: AbortSignal): Promise<BackupDocument>;
  /** Doit figer les entrées avant le premier await (postMessage dans le worker). */
  prepare(preview: RestorePreview, options: RestoreOptions, signal?: AbortSignal): Promise<PreparedRestore>;
};
/** Toutes les opérations lourdes et les empreintes sont terminées avant la transaction d’écriture. */
export function createBackupService(processor: Processor, name = DATABASE_NAME): BackupService {
  return {
    async exportData() { return processor.export(await readBackupSnapshot(name)); },
    async preview(file, signal) {
      if (signal?.aborted) throw new DOMException('Annulé', 'AbortError');
      await checkBackupFile(file);
      const backup = await processor.parse(file, signal);
      if (signal?.aborted) throw new DOMException('Annulé', 'AbortError');
      const local = await readBackupSnapshot(name);
      const preview = { backup, local };
      const { report } = await processor.prepare(preview, { mode: 'merge', profile: 'keep' }, signal);
      if (signal?.aborted) throw new DOMException('Annulé', 'AbortError');
      return { ...preview, mergeReport: report };
    },
    async restore(preview, requestedOptions) {
      return withRestoreLock(name, async () => {
      const options = { ...requestedOptions };
      if (!['replace', 'merge'].includes(options.mode) || !['keep', 'restore'].includes(options.profile)) throw new BackupError('Choisissez un mode de restauration valide.');
      if (options.mode === 'merge' && options.profile === 'restore' && !preview.backup.data.coachProfile) throw new BackupError('Cette sauvegarde ne contient pas de profil à restaurer.');
      const prepared = await processor.prepare(preview, { ...options });
      validateBackupData(prepared.data);
      if (preview.mergeReport && preview.mergeReport.retention.ignoredDetails !== prepared.report.retention.ignoredDetails) {
        throw new BackupError('La limite des 30 jours a changé depuis l’aperçu. Annulez puis sélectionnez à nouveau le fichier pour confirmer le bilan actualisé.');
      }
      const db = await openDatabase(name);
      const tx = db.transaction(stores, 'readwrite');
      try {
        // Comparaison dans la transaction verrouillée, sans digest asynchrone.
        const current = await readSnapshot(tx);
        if (canonicalJson(current) !== prepared.expected) throw new BackupError('Les données locales ont changé depuis la prévisualisation, peut-être dans un autre onglet. Annulez puis sélectionnez à nouveau le fichier.');
        if (options.mode === 'replace') {
          for (const store of stores) await tx.objectStore(store).clear();
        }
        // En fusion, seules les nouvelles entrées sont écrites.
        const sessionIds = new Set(options.mode === 'merge' ? current.sessions.map(s => s.id) : []);
        const detailIds = new Set(options.mode === 'merge' ? current.details.map(d => d.id) : []);
        for (const s of prepared.data.sessions) if (!sessionIds.has(s.id)) await tx.objectStore('sessions').add(s);
        for (const d of prepared.data.details) if (!detailIds.has(d.id)) await tx.objectStore('details').add(d);
        const shoeIds = new Set(options.mode === 'merge' ? (current.shoes ?? []).map(s => s.id) : []);
        const assignmentIds = new Set(options.mode === 'merge' ? (current.shoeAssignments ?? []).map(a => a.sessionId) : []);
        for (const shoe of prepared.data.shoes ?? []) if (!shoeIds.has(shoe.id)) await tx.objectStore('shoes').add(shoe);
        for (const association of prepared.data.shoeAssignments ?? []) if (!assignmentIds.has(association.sessionId)) await tx.objectStore('shoeAssignments').add(association);
        if (prepared.data.shoeSettings && (options.mode === 'replace' || !current.shoeSettings)) await tx.objectStore('shoeSettings').put(prepared.data.shoeSettings);
        if (options.mode === 'replace' || options.profile === 'restore') {
          if (prepared.data.coachProfile) await tx.objectStore('coachProfile').put(prepared.data.coachProfile);
          else await tx.objectStore('coachProfile').delete('local');
        }
        await tx.done;
      } catch (error) {
        try { tx.abort(); } catch { /* Transaction déjà annulée. */ }
        await tx.done.catch(() => undefined); throw error;
      } finally { db.close(); }
      // Notification sans contenu personnel ; pas de synchronisation réseau.
      if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
        try { const channel = new BroadcastChannel(RESTORED_CHANNEL); channel.postMessage('restored'); channel.close(); } catch { /* La notification ne remet pas en cause la transaction déjà validée. */ }
      }
      return prepared.report;
      });
    },
  };
}
/** Processeur natif pour tests et intégrations non-React ; même validation que le worker. */
export async function prepareNative(preview: RestorePreview, options: RestoreOptions, reference = new Date()): Promise<PreparedRestore> {
  // Le worker copie à postMessage ; le processeur natif doit figer l’entrée lui-même.
  const copy = structuredClone(preview);
  await verifyBackup(copy.backup);
  return { expected: canonicalJson(copy.local), ...prepareRestore(copy.local, copy.backup.data, options, reference.toISOString()) };
}
