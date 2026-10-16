import type { CoachPlanning, PlannedSession } from '../../types/coach-planning';
import { validSessionDate } from '../analysis/session-summary';
const fail = (): never => { throw new Error('Données du planning invalides.'); };
function fields(v: unknown, keys: string): asserts v is Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k=>!keys.split(' ').includes(k))) fail();
}
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const date = (v: unknown) => typeof v === 'string' && validSessionDate(v);
const time = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
const seconds = (v: unknown) => Number.isSafeInteger(v) && (v as number) > 0 && (v as number) <= 86400;
export const proposalKeyValid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export function validatePlannedSession(v: unknown): asserts v is PlannedSession {
  fields(v,'id proposalKey date durationSeconds kind intention origin status note createdAt updatedAt original');
  if (!text(v.id,128) || !v.id.trim() || !proposalKeyValid(v.proposalKey) || !date(v.date) || !seconds(v.durationSeconds)
    || !['discovery','easy','endurance'].includes(v.kind as string) || !text(v.intention,2000) || !v.intention.trim()
    || v.origin !== 'coach' || !['planned','cancelled'].includes(v.status as string) || !text(v.note,2000)
    || !time(v.createdAt) || !time(v.updatedAt) || v.updatedAt < v.createdAt) fail();
  fields(v.original,'date durationSeconds explanation policyVersion');
  if (!date(v.original.date) || !seconds(v.original.durationSeconds) || !text(v.original.explanation,12000) || v.original.policyVersion !== 1) fail();
}
export function validateCoachPlanning(v: unknown): asserts v is CoachPlanning {
  fields(v,'id revision createdAt updatedAt sessions dismissed');
  if (v.id !== 'local' || !Number.isSafeInteger(v.revision) || (v.revision as number)<1 || !time(v.createdAt) || !time(v.updatedAt) || v.updatedAt < v.createdAt
    || !Array.isArray(v.sessions) || !Array.isArray(v.dismissed)) fail();
  const ids = new Set(), keys = new Set();
  for (const session of v.sessions as unknown[]) {
    validatePlannedSession(session);
    if (ids.has(session.id) || keys.has(session.proposalKey)) fail();
    ids.add(session.id); keys.add(session.proposalKey);
  }
  const dismissed = new Set();
  for (const key of v.dismissed as unknown[]) { if (!proposalKeyValid(key) || dismissed.has(key)) fail(); dismissed.add(key); }
}
