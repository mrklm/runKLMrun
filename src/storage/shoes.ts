import { shoeTimeline } from '../core/shoes/timeline';
import { localToday } from '../core/analysis/statistics-period';
import { DATABASE_NAME, openDatabase } from './database-connection';
import type { Shoe, ShoeData, ShoeSettings } from '../types/shoe';
import { validateShoe } from '../core/shoes/shoes';
import { canonicalJson } from '../backup/format';

export interface ConversionPreview { expected: string; assignments: { sessionId: string; shoeId: string }[]; km: number }
export interface AssignmentPreview { shoeId: string; replace: boolean; entries: { sessionId: string; previous?: string; summary: string }[]; km: number; missing: number; protectedCount: number }
export const SHOES_CHANGED = 'runklmrun-shoes-changed';
function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SHOES_CHANGED));
  if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(SHOES_CHANGED); channel.postMessage('changed'); channel.close();
  }
}
export function createShoeRepository(name = DATABASE_NAME) {
  return {
    async list(): Promise<ShoeData> {
      const db = await openDatabase(name);
      try {
        const tx = db.transaction(['shoes', 'shoeAssignments', 'shoeSettings']);
        const [shoes, shoeAssignments, settings] = await Promise.all([tx.objectStore('shoes').getAll(), tx.objectStore('shoeAssignments').getAll(), tx.objectStore('shoeSettings').get('local')]);
        await tx.done; return { shoes, shoeAssignments, settings };
      } finally { db.close(); }
    },
    async previewConversion(today = localToday()): Promise<ConversionPreview> {
      const db = await openDatabase(name);
      try {
        const tx = db.transaction(['sessions', 'shoes', 'shoeAssignments', 'shoeSettings']);
        const [sessions, shoes, assignments, settings] = await Promise.all([tx.objectStore('sessions').getAll(), tx.objectStore('shoes').getAll(), tx.objectStore('shoeAssignments').getAll(), tx.objectStore('shoeSettings').get('local')]);
        await tx.done;
        const timeline = shoeTimeline(shoes, sessions, today);
        if (timeline.issues.length) throw new Error('Corrigez les dates des paires avant de convertir les associations.');
        const existing = new Set(assignments.map(a => a.sessionId));
        const selected = timeline.assignments.filter(a => !existing.has(a.sessionId));
        const ids = new Set(selected.map(a => a.sessionId));
        const km = sessions.reduce((sum, s) => sum + (ids.has(s.id) && typeof s.distanceMeters === 'number' && Number.isFinite(s.distanceMeters) && s.distanceMeters >= 0 ? s.distanceMeters / 1000 : 0), 0);
        return { expected: canonicalJson({ sessions, shoes, assignments, settings }), assignments: selected, km };
      } finally { db.close(); }
    },
    async convert(preview: ConversionPreview, confirmed: boolean) {
      if (!confirmed) throw new Error('Confirmez la conversion.');
      const plan = structuredClone(preview);
      const db = await openDatabase(name), tx = db.transaction(['sessions', 'shoes', 'shoeAssignments', 'shoeSettings'], 'readwrite');
      try {
        const [sessions, shoes, assignments, settings] = await Promise.all([tx.objectStore('sessions').getAll(), tx.objectStore('shoes').getAll(), tx.objectStore('shoeAssignments').getAll(), tx.objectStore('shoeSettings').get('local')]);
        if (settings?.mode === 'automatic' || canonicalJson({ sessions, shoes, assignments, settings }) !== plan.expected) throw new Error('Le mode ou les données ont changé. Recommencez l’aperçu.');
        for (const a of plan.assignments) {
          if (!sessions.some(s => s.id === a.sessionId) || !shoes.some(s => s.id === a.shoeId)) throw new Error('Association invalide.');
          await tx.objectStore('shoeAssignments').add(a);
        }
        await tx.done;
      } catch (error) { try { tx.abort(); } catch { /* Déjà terminée. */ } await tx.done.catch(() => undefined); throw error; }
      finally { db.close(); }
      try { notify(); } catch { /* Déjà enregistré. */ }
    },
    async setMode(mode: ShoeSettings['mode'], expectedRevision?: number) {
      if (mode !== 'manual' && mode !== 'automatic') throw new Error('Mode invalide.');
      const db = await openDatabase(name), tx = db.transaction('shoeSettings', 'readwrite');
      try {
        const previous = await tx.store.get('local');
        if (previous?.revision !== expectedRevision) throw new Error('Le mode a changé dans un autre onglet. Actualisez avant de réessayer.');
        await tx.store.put({ id: 'local', mode, revision: (previous?.revision ?? 0) + 1 }); await tx.done;
      } catch (error) { try { tx.abort(); } catch { /* Déjà terminée. */ } await tx.done.catch(() => undefined); throw error; }
      finally { db.close(); }
      try { notify(); } catch { /* Déjà enregistré. */ }
    },
    async save(input: Omit<Shoe, 'revision'>, expectedRevision?: number) {
      const shoe: Shoe = { ...input, revision: (expectedRevision ?? 0) + 1 };
      if (shoe.status === 'archived') shoe.isDefault = false;
      validateShoe(shoe);
      const db = await openDatabase(name), tx = db.transaction('shoes', 'readwrite');
      try {
        const previous = await tx.store.get(shoe.id);
        if (previous?.revision !== expectedRevision) throw new Error('Cette paire a changé dans un autre onglet. Actualisez avant de réessayer.');
        if (shoe.isDefault) for (const other of await tx.store.getAll()) if (other.id !== shoe.id && other.isDefault) await tx.store.put({ ...other, isDefault: false, revision: other.revision + 1 });
        await tx.store.put(shoe); await tx.done;
      } catch (error) { try { tx.abort(); } catch { /* Déjà terminée. */ } await tx.done.catch(() => undefined); throw error; }
      finally { db.close(); }
      try { notify(); } catch { /* L’écriture est déjà validée. */ }
      return shoe;
    },
    async assign(sessionId: string, shoeId: string | undefined, previous?: string) {
      const db = await openDatabase(name), tx = db.transaction(['sessions', 'shoes', 'shoeAssignments'], 'readwrite');
      try {
        if (!await tx.objectStore('sessions').getKey(sessionId)) throw new Error('Cette séance n’existe plus.');
        const old = await tx.objectStore('shoeAssignments').get(sessionId);
        if (old?.shoeId !== previous) throw new Error('L’association a changé. Actualisez avant de réessayer.');
        if (shoeId) {
          const shoe = await tx.objectStore('shoes').get(shoeId);
          if (!shoe || shoe.status !== 'active') throw new Error('Choisissez une paire active.');
          await tx.objectStore('shoeAssignments').put({ sessionId, shoeId });
        } else await tx.objectStore('shoeAssignments').delete(sessionId);
        await tx.done;
      } catch (error) { try { tx.abort(); } catch { /* Déjà terminée. */ } await tx.done.catch(() => undefined); throw error; }
      finally { db.close(); }
      try { notify(); } catch { /* Déjà enregistré. */ }
    },
    async preview(ids: string[], shoeId: string, replace = false): Promise<AssignmentPreview> {
      const db = await openDatabase(name);
      try {
        const tx = db.transaction(['sessions', 'shoes', 'shoeAssignments']);
        const shoe = await tx.objectStore('shoes').get(shoeId);
        if (!shoe || shoe.status !== 'active') { await tx.done; throw new Error('Choisissez une paire active.'); }
        const result: AssignmentPreview = { shoeId, replace, entries: [], km: 0, missing: 0, protectedCount: 0 };
        for (const sessionId of new Set(ids)) {
          const session = await tx.objectStore('sessions').get(sessionId);
          if (!session) continue;
          const previous = (await tx.objectStore('shoeAssignments').get(sessionId))?.shoeId;
          if (previous && (!replace || previous === shoeId)) { result.protectedCount++; continue; }
          result.entries.push({ sessionId, previous, summary: canonicalJson(session) });
          if (typeof session.distanceMeters === 'number' && Number.isFinite(session.distanceMeters) && session.distanceMeters >= 0) result.km += session.distanceMeters / 1000;
          else result.missing++;
        }
        await tx.done; return result;
      } finally { db.close(); }
    },
    async apply(preview: AssignmentPreview, confirmed: boolean) {
      if (!confirmed) throw new Error('Confirmez l’attribution avant de poursuivre.');
      const plan = structuredClone(preview);
      const db = await openDatabase(name), tx = db.transaction(['sessions', 'shoes', 'shoeAssignments'], 'readwrite');
      try {
        const shoe = await tx.objectStore('shoes').get(plan.shoeId);
        if (!shoe || shoe.status !== 'active') throw new Error('Cette paire n’est plus active.');
        for (const entry of plan.entries) {
          const session = await tx.objectStore('sessions').get(entry.sessionId);
          const previous = (await tx.objectStore('shoeAssignments').get(entry.sessionId))?.shoeId;
          if (!session || canonicalJson(session) !== entry.summary || previous !== entry.previous || (previous && !plan.replace)) throw new Error('Les séances ou leurs associations ont changé. Recommencez l’aperçu.');
          await tx.objectStore('shoeAssignments').put({ sessionId: entry.sessionId, shoeId: plan.shoeId });
        }
        await tx.done;
      } catch (error) { try { tx.abort(); } catch { /* Déjà terminée. */ } await tx.done.catch(() => undefined); throw error; }
      finally { db.close(); }
      try { notify(); } catch { /* Déjà enregistré. */ }
      return plan.entries.length;
    },
  };
}
export const shoeRepository = createShoeRepository();
