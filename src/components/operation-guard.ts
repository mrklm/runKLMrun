import { useSyncExternalStore } from 'react';
let occupied = false;
const listeners = new Set<() => void>();
export function acquireOperation(): (() => void) | undefined {
  if (occupied) return undefined;
  occupied = true; listeners.forEach(listener => listener());
  let released = false;
  return () => { if (released) return; released = true; occupied = false; listeners.forEach(listener => listener()); };
}
export function useOperationBusy() {
  return useSyncExternalStore(callback => { listeners.add(callback); return () => { listeners.delete(callback); }; }, () => occupied, () => false);
}
