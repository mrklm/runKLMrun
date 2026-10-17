import { describe, expect, it } from 'vitest';
import { calendarEvents, monthDays, shiftMonth } from './month-calendar';
import { totals } from './session-summary';
import type { StoredSuggestion } from '../../types/coach-suggestion';
const suggestion = (overrides: Partial<StoredSuggestion> = {}): StoredSuggestion => ({ id:'test', date:'2026-10-18', kind:'easy', durationSeconds:1800, createdAt:'2026-10-17T10:00:00Z', updatedAt:'2026-10-17T10:00:00Z', revision:1, expiresOn:'2026-10-26', state:'current', ...overrides });
describe('calendrier civil', () => {
  it.each([['2025-02',28],['2024-02',29],['2100-02',28],['2000-02',29],['2026-04',30],['2026-10',31]])('%s : %i jours', (month, count) => {
    expect(monthDays(month).filter(Boolean)).toHaveLength(count); expect(monthDays(month).length % 7).toBe(0);
  });
  it.each([['2026-06',0],['2026-09',1],['2026-04',2],['2026-10',3],['2026-05',4],['2026-08',5],['2026-02',6]])('premier jour %s', (month, offset) => expect(monthDays(month).indexOf(`${month}-01`)).toBe(offset));
  it('change d’année et rejette un mois invalide', () => { expect(shiftMonth('2026-12',1)).toBe('2027-01'); expect(shiftMonth('2026-01',-1)).toBe('2025-12'); expect(monthDays('2026-13')).toEqual([]); });
  it('conserve plusieurs sorties sans convertir leur date près de minuit ni inventer les mesures', () => {
    const sessions=[{id:'a',title:'A',date:'2026-10-17',startTime:'2026-10-17T23:55:00-07:00',durationSeconds:600},{id:'b',title:'B',date:'2026-10-17',durationSeconds:900,ascentMeters:0}];
    const before=JSON.stringify(sessions); const events=calendarEvents(sessions,[suggestion()], '2026-10-17');
    expect(events.activities.get('2026-10-17')).toHaveLength(2); expect(events.activities.has('2026-10-18')).toBe(false);
    expect(totals(sessions)).toMatchObject({count:2,distance:{value:null,known:0},ascent:{value:0,known:1,total:2}}); expect(JSON.stringify(sessions)).toBe(before);
  });
  it('lit seulement les suggestions actuelles, non associées, à venir ou du jour', () => {
    const records=[suggestion(),suggestion({id:'past',date:'2026-10-16'}),suggestion({id:'old',state:'superseded'}),suggestion({id:'linked',activityId:'a'}),suggestion({id:'expired',expiresOn:'2026-10-17'}),suggestion({id:'today',date:'2026-10-17'})];
    const before=JSON.stringify(records); const events=calendarEvents([],records,'2026-10-17');
    expect([...events.future.values()].flat().map(s=>s.id)).toEqual(['test','today']); expect(events.activities.size).toBe(0); expect(JSON.stringify(records)).toBe(before);
    expect(calendarEvents([],records,'2026-10-19').future.size).toBe(0);
  });
});
