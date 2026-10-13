import { useEffect, useState, type ReactNode } from 'react';
/** Un timer par opération ; aucune durée minimale ni pourcentage inventé. */
export function DelayedOperation({ active, children }: { active: boolean; children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!active) { setVisible(false); return; }
    const timer = window.setTimeout(() => setVisible(true), 400);
    return () => { window.clearTimeout(timer); setVisible(false); };
  }, [active]);
  return active && visible ? <div role="status" aria-live="polite">{children}</div> : null;
}
