import type { Shoe, ShoeAssignment } from '../../types/shoe';
import type { RunningSession } from '../../types/session';
import { validSessionDate } from '../analysis/session-summary';

export function validateShoe(value: unknown): asserts value is Shoe {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Paire invalide.');
  const shoe = value as Shoe;
  const allowed = ['id', 'name', 'brand', 'purchaseDate', 'firstUseDate', 'limitKm', 'warningKm', 'status', 'isDefault', 'revision'];
  if (Object.keys(shoe).some(k => !allowed.includes(k)) || typeof shoe.id !== 'string' || !shoe.id.trim() || shoe.id.length > 4096
    || typeof shoe.name !== 'string' || !shoe.name.trim() || shoe.name.length > 200
    || (shoe.brand !== undefined && (typeof shoe.brand !== 'string' || shoe.brand.length > 200))
    || !['active', 'archived'].includes(shoe.status) || typeof shoe.isDefault !== 'boolean'
    || (shoe.status === 'archived' && shoe.isDefault) || !Number.isSafeInteger(shoe.revision) || shoe.revision < 1) throw new Error('Renseignez un nom de paire et un statut valides.');
  for (const date of [shoe.purchaseDate, shoe.firstUseDate]) if (date !== undefined && (typeof date !== 'string' || !validSessionDate(date))) throw new Error('Renseignez une date valide ou laissez le champ vide.');
  if (shoe.limitKm !== undefined && (!Number.isFinite(shoe.limitKm) || shoe.limitKm <= 0)) throw new Error('La limite doit être un nombre strictement positif.');
  // Champ historique conservé : il ne doit plus contraindre la limite modifiable.
  if (shoe.warningKm !== undefined && (!Number.isFinite(shoe.warningKm) || shoe.warningKm < 0)) throw new Error('Ancienne valeur de chaussure invalide.');
}
export function shoeMileage(shoe: Shoe, sessions: readonly RunningSession[], assignments: readonly ShoeAssignment[]) {
  const ids = new Set(assignments.filter(a => a.shoeId === shoe.id).map(a => a.sessionId));
  const seen = new Set<string>();
  let meters = 0, count = 0, missing = 0;
  for (const session of sessions) {
    if (!ids.has(session.id) || seen.has(session.id)) continue;
    seen.add(session.id); count++;
    if (typeof session.distanceMeters === 'number' && Number.isFinite(session.distanceMeters) && session.distanceMeters >= 0) meters += session.distanceMeters;
    else missing++;
  }
  const km = meters / 1000;
  const state: 'normal' | 'limit' = shoe.limitKm !== undefined && km >= shoe.limitKm ? 'limit' : 'normal';
  return { km, count, missing, state, remainingKm: shoe.limitKm === undefined ? undefined : Math.max(0, shoe.limitKm - km), percent: shoe.limitKm === undefined ? undefined : km / shoe.limitKm * 100 };
}
export function sessionsInPeriod(sessions: readonly RunningSession[], from: string, to: string): RunningSession[] {
  if (!validSessionDate(from) || !validSessionDate(to) || from > to) throw new Error('Choisissez une période valide, avec la date de début avant la date de fin.');
  return sessions.filter(s => validSessionDate(s.date) && s.date >= from && s.date <= to);
}
