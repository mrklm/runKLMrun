import { useEffect, useMemo, useState } from 'react';
import type { ShoeData } from '../types/shoe';
import { createShoeRepository, SHOES_CHANGED } from '../storage/shoes';
import { subscribeStorage } from '../storage/changes';
import { useProfileDatabase } from '../storage/profile-context';
export function useShoes() {
  const database=useProfileDatabase(),shoeRepository=useMemo(()=>createShoeRepository(database),[database]);
  const [data, setData] = useState<ShoeData>({ shoes: [], shoeAssignments: [] });
  const [error, setError] = useState(''), [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true, generation = 0;
    const refresh = () => {
      const token = ++generation;
      void shoeRepository.list().then(value => { if (active && token === generation) { setData(value); setError(''); setLoading(false); } }, () => { if (active && token === generation) { setError('Impossible de lire vos chaussures. Rechargez la page pour réessayer.'); setLoading(false); } });
    };
    const unsubscribe = subscribeStorage(['shoes'], refresh,database);
    refresh(); document.addEventListener('visibilitychange', refresh); window.addEventListener(SHOES_CHANGED, refresh);
    const channels = typeof BroadcastChannel === 'undefined' ? [] : [SHOES_CHANGED].map(name => { const channel = new BroadcastChannel(name); channel.onmessage = refresh; return channel; });
    return () => { unsubscribe(); active = false; document.removeEventListener('visibilitychange', refresh); window.removeEventListener(SHOES_CHANGED, refresh); channels.forEach(c => c.close()); };
  }, [database,shoeRepository]);
  return { ...data, error, loading };
}
