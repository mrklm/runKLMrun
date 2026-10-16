import type { RunningSession } from '../../types/session';
import { compareMethods, coverage, DEMO, type Parameters } from './analysis';
/** Ouverture native sans version : aucune migration ; une base absente n’est pas créée. */
export function readSummaries(name = 'runklmrun'): Promise<RunningSession[]> {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open(name);
    request.onupgradeneeded = () => { request.transaction?.abort(); };
    request.onerror = () => reject(new Error('Base existante indisponible sur cette origine. Aucun historique créé.'));
    request.onblocked = () => reject(new Error('Accès bloqué par un autre onglet.'));
    request.onsuccess = () => {
      const db = request.result;
      try {
        const tx = db.transaction('sessions','readonly');
        const read = tx.objectStore('sessions').getAll();
        tx.oncomplete = () => { db.close(); resolve(read.result); };
        tx.onabort = tx.onerror = () => { db.close(); reject(new Error('Lecture des résumés impossible.')); };
      } catch { db.close(); reject(new Error('Magasin de résumés absent.')); }
    };
  });
}
export async function diagnostic(parameters?: Parameters) {
  const sessions = await readSummaries();
  if (!parameters) return { units: 'Distance et D+ en mètres ; FC en bpm. Exploitable = nombre fini, distance/FC > 0, D+ ≥ 0. Les catégories estimé, partiel et zéro se recoupent.', coverage: coverage(sessions) };
  const anonymous = [...sessions].sort((a,b) => a.id.localeCompare(b.id)).map((s,i) => ({ ...s, id: `S${String(i+1).padStart(5,'0')}` }));
  return { notice: 'Voisinages directs uniquement, sans chaînage ni reconnaissance d’itinéraire. Seuils expérimentaux. Les exemples sont plafonnés, les comptes sont complets.', ...compareMethods(anonymous, parameters) };
}
if (import.meta.env.DEV && typeof document !== 'undefined' && document.getElementById('diagnostic-run')) {
  const output = document.getElementById('diagnostic-output') as HTMLTextAreaElement;
  const config = document.getElementById('diagnostic-parameters') as HTMLTextAreaElement;
  config.value = JSON.stringify(DEMO,null,2);
  document.getElementById('diagnostic-run')!.onclick = async () => {
    const button = document.getElementById('diagnostic-run') as HTMLButtonElement;
    button.disabled=true;
    try { output.value=JSON.stringify(await diagnostic((document.getElementById('prototype') as HTMLInputElement).checked ? JSON.parse(config.value) : undefined),null,2); }
    catch(error) { output.value=error instanceof Error ? error.message : 'Diagnostic impossible.'; }
    finally { button.disabled=false; }
  };
}
