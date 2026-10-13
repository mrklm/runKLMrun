import { createContext, useContext, useId, useState, type ReactNode } from 'react';
import { useShoes } from './use-shoes';
import { shoeRepository } from '../storage/shoes';
const Context = createContext<ReturnType<typeof useShoes> | undefined>(undefined);
export function ShoeHistoryProvider({ children }: { children: ReactNode }) {
  const data = useShoes(); return <Context.Provider value={data}>{children}</Context.Provider>;
}
export function ShoeHistorySelect({ sessionId }: { sessionId: string }) {
  const data = useContext(Context), id = useId();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (!data || data.settings?.mode === 'automatic') return null;
  const current = data.shoeAssignments.find(a => a.sessionId === sessionId)?.shoeId;
  async function change(shoeId: string) {
    setBusy(true); setError('');
    try { await shoeRepository.assign(sessionId, shoeId || undefined, current); }
    catch (e) { setError(e instanceof Error ? e.message : 'Association impossible.'); }
    finally { setBusy(false); }
  }
  return <div className="shoe-history"><label htmlFor={id}>Chaussures utilisées</label><select id={id} value={current ?? ''} disabled={busy || data.loading || !!data.error} onChange={e => void change(e.target.value)}><option value="">Non renseignées</option>{data.shoes.filter(s => s.status === 'active' || s.id === current).map(s => <option value={s.id} key={s.id}>{s.name}{s.status === 'archived' ? ' (archivée)' : ''}</option>)}</select>{(error || data.error) && <p role="alert">{error || data.error}</p>}</div>;
}
