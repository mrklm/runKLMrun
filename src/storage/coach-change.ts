/** Notification locale sans contenu personnel ; les révisions restent la garantie d'écriture. */
export const COACH_CHANGED = 'runklmrun-coach-changed';
export function notifyCoachChanged(): void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
  try { const channel=new BroadcastChannel(COACH_CHANGED);channel.postMessage('changed');channel.close(); }
  catch { /* Une notification indisponible ne remet pas en cause la transaction. */ }
}
