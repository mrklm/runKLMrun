import { useEffect, useState } from 'react';
import type { ShoeData } from '../types/shoe';
import { shoeRepository, SHOES_CHANGED } from '../storage/shoes';
import { RESTORED_CHANNEL } from '../storage/backup';
export function useShoes() {
  const [data, setData] = useState<ShoeData>({ shoes: [], shoeAssignments: [] });
  const [error, setError] = useState(''), [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true, generation = 0;
    const refresh = () => {
      const token = ++generation;
      void shoeRepository.list().then(value => { if (active && token === generation) { setData(value); setError(''); setLoading(false); } }, () => { if (active && token === generation) { setError('Impossible de lire vos chaussures. Rechargez la page pour réessayer.'); setLoading(false); } });
    };
    refresh(); document.addEventListener('visibilitychange', refresh); window.addEventListener(SHOES_CHANGED, refresh);
    const channels = typeof BroadcastChannel === 'undefined' ? [] : [SHOES_CHANGED, RESTORED_CHANNEL].map(name => { const channel = new BroadcastChannel(name); channel.onmessage = refresh; return channel; });
    return () => { active = false; document.removeEventListener('visibilitychange', refresh); window.removeEventListener(SHOES_CHANGED, refresh); channels.forEach(c => c.close()); };
  }, []);
  return { ...data, error, loading };
}
