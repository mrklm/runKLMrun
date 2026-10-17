import { useEffect, useState } from 'react';
import { createSuggestionRepository } from '../storage/coach-suggestions';
import { subscribeStorage } from '../storage/changes';
import { reconciliationReady, subscribeReconciliation } from '../storage/suggestion-reconciliation';
import { localToday } from '../core/analysis/statistics-period';
import type { StoredSuggestion } from '../types/coach-suggestion';
const repository = createSuggestionRepository();

export function PastSuggestions() {
  const [records, setRecords] = useState<StoredSuggestion[]>([]);
  useEffect(() => {
    let generation = 0, stopped = false, today = localToday();
    const refresh = () => {
      const current = ++generation;
      setRecords([]);
      if (!reconciliationReady() || document.visibilityState === 'hidden') return;
      void repository.pastInformation(today).then(result => {
        if (!stopped && current === generation && reconciliationReady()) setRecords(result);
      }).catch(() => { /* En cas d’incertitude, aucune information d’absence. */ });
    };
    const checkDate = () => {
      const date = localToday();
      if (date !== today) { today = date; refresh(); }
    };
    const resume = () => { today = localToday(); refresh(); };
    const unsubscribe = subscribeStorage(['sessions', 'suggestions'], refresh);
    const unsubscribeReady = subscribeReconciliation(refresh);
    const timer = window.setInterval(checkDate, 1000);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    refresh();
    return () => {
      stopped = true; generation++; unsubscribe(); unsubscribeReady(); clearInterval(timer);
      window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume);
    };
  }, []);
  if (!records.length) return null;
  return <section className="notice" aria-label="Suggestions passées">
    {records.map(record => <p key={record.id}>Sortie suggérée le {record.date.split('-').reverse().join('/')} : aucune activité correspondante enregistrée. Elle n’a peut-être pas été effectuée ou n’a pas encore été importée.</p>)}
  </section>;
}
