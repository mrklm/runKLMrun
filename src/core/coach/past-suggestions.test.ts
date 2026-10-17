import { expect, it } from 'vitest';
import { pastSuggestionInformation } from './past-suggestions';
import { suggestionId, suggestionExpiry } from './suggestions';
import type { StoredSuggestion } from '../../types/coach-suggestion';
const content = { date: '2026-10-16', kind: 'endurance' as const, durationSeconds: 2100 };
const suggestion: StoredSuggestion = { ...content, id: suggestionId(content), expiresOn: suggestionExpiry(content.date), state: 'current', revision: 1, createdAt: '2026-10-15T00:00:00.000Z', updatedAt: '2026-10-15T00:00:00.000Z' };
const run = { id: 'run', date: content.date, durationSeconds: 2520, title: 'Synthétique' };
it('suggestion passée mémorisée sans activité, pendant sept jours civils seulement', () => {
  expect(pastSuggestionInformation([suggestion], [], '2026-10-16')).toEqual([]);
  expect(pastSuggestionInformation([suggestion], [], '2026-10-17')).toEqual([suggestion]);
  expect(pastSuggestionInformation([suggestion], [], '2026-10-23')).toEqual([suggestion]);
  expect(pastSuggestionInformation([suggestion], [], '2026-10-24')).toEqual([]);
});
it('suggestion associée, obsolète, future ou jamais présentée : aucun message', () => {
  expect(pastSuggestionInformation([{ ...suggestion, activityId: 'run' }], [run], '2026-10-17')).toEqual([]);
  expect(pastSuggestionInformation([{ ...suggestion, state: 'superseded' }], [], '2026-10-17')).toEqual([]);
  expect(pastSuggestionInformation([suggestion], [], '2026-10-15')).toEqual([]);
  expect(pastSuggestionInformation([], [], '2026-10-17')).toEqual([]);
});
it('rapprochement en retard ou lien orphelin : aucune information prématurée', () => {
  expect(pastSuggestionInformation([suggestion], [run], '2026-10-17')).toEqual([]);
  expect(pastSuggestionInformation([{ ...suggestion, activityId: 'run' }], [], '2026-10-17')).toEqual([]);
});
it('plusieurs activités ou plusieurs suggestions : silence', () => {
  expect(pastSuggestionInformation([suggestion], [run, { ...run, id: 'second' }], '2026-10-17')).toEqual([]);
  const other = { ...content, durationSeconds: 1800 };
  expect(pastSuggestionInformation([suggestion, { ...suggestion, ...other, id: suggestionId(other), state: 'superseded' }], [], '2026-10-17')).toEqual([]);
});
it('activité incertaine ou sport non pertinent : ne prétend pas à une absence', () => {
  expect(pastSuggestionInformation([suggestion], [{ ...run, sport: 'UNKNOWN' }], '2026-10-17')).toEqual([]);
  expect(pastSuggestionInformation([suggestion], [{ ...run, date: '', startTime: '2026-10-16T23:59:00Z' }], '2026-10-17')).toEqual([]);
});
it('ne modifie ni résumé ni suggestion', () => {
  const original = structuredClone(suggestion); const activity = structuredClone(run);
  pastSuggestionInformation([suggestion], [run], '2026-10-17');
  expect(suggestion).toEqual(original); expect(run).toEqual(activity);
});
