import { expect, it } from 'vitest';
import { proposalEvidence, proposeNextSession, type ProposalInput } from './proposals';
import { validateAvailabilityAndPreferences, validateProfile } from './profile';
import type { ProposalPolicy } from '../../types/coach-proposal';
import type { CoachProfileValues, Weekday } from '../../types/coach-profile';
import type { EvolvingCoachValues } from '../../types/evolving-coach';
import type { RunningSession } from '../../types/session';
// Paramètres synthétiques de test, pas des recommandations sportives.
const policy: ProposalPolicy = { horizonDays: 14, evidenceAgeLimitDays: 120, rhythmIntervals: 8, recentCycles: 4, staleCycles: 2, minimumSuggestionSeconds: 300, discoverySeconds: 1200, duration: { minimumReferences: 3, freshCycles: 1, maximumDurationSpread: 0.5, maximumGapSpread: 1, supportedFraction: 0.8, cautiousFraction: 0.5, cautiousMaximumSeconds: 2700 } };
const days: Weekday[] = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const profile: CoachProfileValues = { goal: { kind: 'regular' }, availability: { days, minutesPerSession: 45 }, preferences: { terrain: 'trail' }, accompanimentMode: 'advisor' };
const row = (id: string, date: string, durationSeconds = 1800): RunningSession => ({ id, date, durationSeconds, title: 'Fictif' });
const regular = [row('a','2026-09-20'),row('b','2026-09-25'),row('c','2026-09-30'),row('d','2026-10-05'),row('e','2026-10-10')];
const config = (kind: 'begin' | 'return' | 'endurance' | 'speed' | 'wellbeing' = 'endurance'): EvolvingCoachValues => ({ goal: { model:'evolving', kind }, structuredPlanningPreference:'accepted' });
const input = (overrides: Partial<ProposalInput> = {}): ProposalInput => ({ configuration:config(), historicalProfile:profile, sessions:regular, referenceDate:'2026-10-12', policy, ...overrides });
it('aucune proposition sans configuration, même avec ancien objectif et mode trainer', () => {
  for (const kind of ['regular','return','endurance','distance','race'] as const) {
    const result = proposeNextSession(input({ configuration:null, historicalProfile: { ...profile, goal: { kind }, accompanimentMode:'trainer' } }));
    expect(result.status).toBe('not-enabled'); expect(result.suggestions).toEqual([]);
    expect(result.goal).toEqual({ model:'legacy', value:{kind} }); expect(result.evidence.observed.activities).toHaveLength(5);
  }
});
it('consentement explicite obligatoire pour tous les objectifs, plaisir exclu même accepté', () => {
  const goals: EvolvingCoachValues['goal'][] = ['begin','return','endurance','speed','wellbeing'].map(kind => ({ model:'evolving', kind } as EvolvingCoachValues['goal']));
  goals.push({ model:'evolving', kind:'distance', distanceMeters:50000 }, { model:'evolving', kind:'race', distanceMeters:10000, eventDate:'2027-01-01' });
  for (const goal of goals) for (const preference of [undefined,'declined','unexpressed','accepted'] as const) {
    const r=proposeNextSession(input({configuration:{goal, structuredPlanningPreference:preference}}));
    expect(r.suggestions.length > 0).toBe(preference === 'accepted' && goal.kind !== 'wellbeing');
  }
});
it.each(['begin','return'] as const)('%s peut commencer sans historique et sans test de performance', kind => {
  const r=proposeNextSession(input({configuration:config(kind),sessions:[]}));
  expect(r.status).toBe('cautious'); expect(r.suggestions).toHaveLength(1);
  expect(r.suggestions[0]).toMatchObject({ kind:'discovery', durationSeconds:1200, optional:true, referenceSessionIds:[], intensity:{kind:'easy'} });
});
it('une expérience ancienne ne fournit aucune capacité actuelle', () => {
  const r=proposeNextSession(input({configuration:{...config('return'),experience:'experienced'},sessions:[row('ancien','2024-01-01',18000)]}));
  expect(r.suggestions[0].durationSeconds).toBe(1200); expect(r.evidence.horizons[0].sessionIds).toEqual(['ancien']);
  expect(r.evidence.horizons[2].sessionIds).toEqual(['ancien']); expect(r.suggestions[0].referenceSessionIds).toEqual([]);
  expect(r.evidence).not.toHaveProperty('level');
});
it('respecte deux sorties par mois, même avec sept jours et une fréquence souhaitée supérieure', () => {
  const sessions=[row('a','2026-08-16'),row('b','2026-08-31'),row('c','2026-09-15'),row('d','2026-09-30'),row('e','2026-10-15')];
  const r=proposeNextSession(input({sessions,referenceDate:'2026-10-16',historicalProfile:{...profile,availability:{...profile.availability,sessionsPerWeek:7}}}));
  expect(r.evidence.medianGapDays).toBe(15); expect(r.evidence.recentWindowDays).toBe(60);
  expect(r.suggestions).toHaveLength(1); expect(r.suggestions[0].date).toBe('2026-10-30');
  expect(r.suggestions[0].durationSeconds).toBe(1200);
});
it('une pratique variable reste exploitable sans classement ou observation indéfinie', () => {
  const r=proposeNextSession(input({sessions:[row('a','2026-09-01',1200),row('b','2026-09-03',3600),row('c','2026-09-20',1800),row('d','2026-10-01',2400),row('e','2026-10-10',1500)]}));
  expect(r.suggestions).toHaveLength(1); expect(r.evidence.gapRangeDays).toEqual({min:2,max:17});
  expect(r.limitations.join(' ')).toContain('varient'); expect(r.suggestions[0].intensity.kind).toBe('easy');
});
it('sept jours ne deviennent pas sept séances ; aucun repos fixe ajouté', () => {
  const r=proposeNextSession(input({sessions:[row('a','2026-10-11'),row('b','2026-10-12')]}));
  expect(r.suggestions).toHaveLength(1); expect(r.suggestions[0].date).toBe('2026-10-13');
});
it('distingue disponibilités absentes, vides, incohérentes, et souhait de zéro séance', () => {
  for (const availability of [{}, {days:[]}, {days,sessionsPerWeek:0}, {days:['unknown'] as unknown as Weekday[]}]) {
    const r=proposeNextSession(input({historicalProfile:{...profile,availability}}));
    expect(r.status).toBe('unavailable'); expect(r.suggestions).toEqual([]); expect(r.constraints.length).toBeGreaterThan(0);
  }
});
it('respecte toujours les plafonds quotidiens et ne réutilise pas les durées inactives', () => {
  for (const minutes of [1,4,5,10,20,60]) {
    const r=proposeNextSession(input({historicalProfile:{...profile,availability:{days, durationMode:'custom',minutesPerSession:1,maxMinutesByDay:Object.fromEntries(days.map(day=>[day,minutes]))}}}));
    for (const suggestion of r.suggestions) expect(suggestion.durationSeconds).toBeLessThanOrEqual(minutes*60);
    expect(r.suggestions.length).toBe(minutes<5 ? 0 : 1);
  }
  const r=proposeNextSession(input({historicalProfile:{...profile,availability:{days,durationMode:'simple',minutesPerSession:10,maxMinutesByDay:{monday:1}}}}));
  expect(r.suggestions[0].durationSeconds).toBe(600);
});
it('vitesse sans données : découverte facile, jamais fractionné ou FC cible', () => {
  const r=proposeNextSession(input({configuration:config('speed'),sessions:[]}));
  expect(r.suggestions[0].intensity.kind).toBe('easy'); expect(r.suggestions[0]).not.toHaveProperty('pace'); expect(r.suggestions[0]).not.toHaveProperty('targetHeartRate');
});
it('une cible ambitieuse ou un chrono ne majorent jamais les durées', () => {
  for (const goal of [{ model:'evolving',kind:'distance',distanceMeters:100000 }, {model:'evolving',kind:'race',distanceMeters:42195,eventDate:'2026-10-16'}, {model:'evolving',kind:'race',distanceMeters:42195,eventDate:'2026-10-16',targetSeconds:7200}] as const) {
    const r=proposeNextSession(input({configuration:{goal,structuredPlanningPreference:'accepted'}}));
    expect(r.suggestions[0].durationSeconds).toBe(1200);
    expect(r.suggestions[0].date).toBe('2026-10-15');
    if(goal.kind==='race') expect(r.limitations.join(' ')).toContain('faisabilité');
  }
});
it('course imminente sans historique : explique les limites sans forcer une préparation', () => {
  const r=proposeNextSession(input({sessions:[],configuration:{goal:{model:'evolving',kind:'race',distanceMeters:42195,eventDate:'2026-10-13'},structuredPlanningPreference:'accepted'}}));
  expect(r.status).toBe('unavailable'); expect(r.suggestions).toEqual([]); expect(r.limitations.join(' ')).toContain('faisabilité');
});
it('mesures absentes ou invalides : pas de valeurs inventées, découverte uniquement si paramétrée', () => {
  const sessions=[row('a','2026-10-05',NaN),row('b','2026-10-10',0)];
  const r=proposeNextSession(input({sessions})); expect(r.suggestions[0].durationSeconds).toBe(1200); expect(r.evidence.knownDurations).toBe(0);
  expect(proposeNextSession(input({sessions,policy:{...policy,discoverySeconds:undefined}})).status).toBe('insufficient-data');
  expect(proposeNextSession(input({sessions:[row('a','invalide'),row('b','2027-01-01')]})).evidence.observed.excluded).toHaveLength(2);
});
it('sépare ancien et récent ; un trou est possible, jamais une fatigue certaine', () => {
  const r=proposeNextSession(input({sessions:[row('ancien','2023-01-01',18000),...regular]}));
  expect(r.suggestions[0].durationSeconds).toBe(1200); expect(r.suggestions[0].referenceSessionIds).not.toContain('ancien');
  const gap=proposeNextSession(input({referenceDate:'2026-11-01'}));
  expect(gap.evidence.possibleGap).toBe(true); expect(gap.suggestions[0].durationSeconds).toBe(1200);
  expect(gap.limitations.join(' ')).toContain('cause est inconnue');
});
it('aucune météo ou capacité déduite ; référence injectable, ordre stable et entrées intactes', () => {
  const source=input(), copy=structuredClone(source), r=proposeNextSession(source);
  expect(proposeNextSession({...source,sessions:[...source.sessions].reverse()})).toEqual(r); expect(source).toEqual(copy);
  expect(r).not.toHaveProperty('weather'); expect(r).not.toHaveProperty('capacity');
  r.suggestions[0].referenceSessionIds.push('mutation'); expect(source).toEqual(copy);
  expect(proposalEvidence(regular,'2026-10-12',policy).medianGapDays).toBe(5);
});
it('refuse les paramètres invalides, les doublons et les dates de référence invalides', () => {
  expect(()=>proposeNextSession(input({policy:{...policy,horizonDays:90}}))).toThrow();
  expect(()=>proposeNextSession(input({sessions:[regular[0],regular[0]]}))).toThrow();
  expect(()=>proposeNextSession(input({referenceDate:'invalide'}))).toThrow();
});
it('une durée isolée ne devient pas une capacité actuelle, même sous le plafond historique', () => {
  const r=proposeNextSession(input({sessions:[row('isolée','2026-08-01',18000)],configuration:{...config('return'),experience:'experienced'}}));
  expect(r.evidence.medianGapDays).toBeNull(); expect(r.evidence.medianDurationSeconds).toBeNull();
  expect(r.suggestions[0].durationSeconds).toBe(1200); expect(r.evidence.criteria.join(' ')).toContain('durées isolées');
});
it('une fréquence souhaitée plus faible espace les suggestions sans déplacer des séances existantes', () => {
  const r=proposeNextSession(input({sessions:[row('a','2026-10-10'),row('b','2026-10-12')],historicalProfile:{...profile,availability:{days,sessionsPerWeek:1,minutesPerSession:45}}}));
  expect(r.suggestions[0].date).toBe('2026-10-19'); expect(r.suggestions).toHaveLength(1);
});
it('le passage d’heure et les sorties multiples le même jour ne faussent pas les intervalles civils', () => {
  const r=proposeNextSession(input({referenceDate:'2026-10-25',sessions:[row('a','2026-10-23'),row('b','2026-10-25'),row('c','2026-10-25')]}));
  expect(r.evidence.medianGapDays).toBe(2); expect(r.suggestions[0].date).toBe('2026-10-27');
});

it.each([900, 1200, 1800])('découverte explicitement paramétrée à %s secondes, maximum facultatif', discoverySeconds => {
  for (const kind of ['begin', 'return'] as const) {
    const r = proposeNextSession(input({ configuration: config(kind), sessions: [], policy: { ...policy, discoverySeconds } }));
    const suggestion = r.suggestions[0];
    expect(suggestion.durationSeconds).toBe(discoverySeconds);
    expect(suggestion.durationSeconds).toBeLessThanOrEqual(1800);
    expect(suggestion.intensity.description).toContain('maximum indicatif');
    expect(suggestion.intensity.description).toContain('raccourcir');
    expect(suggestion.intensity.description).toContain('Aucune alternance marche/course imposée');
  }
  expect(() => proposeNextSession(input({ policy: { ...policy, discoverySeconds: 1801 } }))).toThrow();
});
it('un ancien rythme descriptif ne fixe plus la date ni la durée', () => {
  const sessions = ['2025-01-01','2025-01-16','2025-01-31'].map((date,i) => row(String(i),date,7200));
  const r = proposeNextSession(input({ sessions }));
  expect(r.evidence.historicalMedianGapDays).toBe(15);
  expect(r.evidence.medianGapDays).toBeNull();
  expect(r.suggestions[0].date).toBe('2026-10-13');
  expect(r.reasons.join(' ')).not.toContain('Espacement retenu');
  const stale = proposeNextSession(input({referenceDate:'2026-11-01'}));
  expect(stale.evidence.historicalMedianGapDays).toBe(5);
  expect(stale.evidence.medianGapDays).toBeNull();
});
it.each([2250,3375])('petite sortie de 30 à 45 minutes sans recopier la médiane de %s secondes', observed => {
  const r = proposeNextSession(input({sessions:regular.map(s=>({...s,durationSeconds:observed}))}));
  expect(r.suggestions[0].durationSeconds).toBe(observed*0.8);
  expect(r.suggestions[0].durationBasis.observedMedianSeconds).toBe(observed);
  expect(r.suggestions[0].durationBasis.assessment).toBe('supported');
});
it('une médiane élevée peut justifier plus de 45 minutes, sans imposer une sortie longue', () => {
  const sessions = regular.map(s=>({...s,durationSeconds:4500}));
  const r = proposeNextSession(input({ sessions, historicalProfile:{...profile,availability:{days,minutesPerSession:120}} }));
  expect(r.suggestions[0].durationSeconds).toBe(3600);
  expect(r.suggestions[0].durationBasis).toMatchObject({observedMedianSeconds:4500,proposedMaximumSeconds:3600,availableMaximumSeconds:7200});
  const uncertain = proposeNextSession(input({sessions:sessions.slice(-2),historicalProfile:{...profile,availability:{days,minutesPerSession:120}}}));
  expect(uncertain.suggestions[0].durationSeconds).toBe(2100);
  expect(uncertain.status).toBe('cautious');
});
it('fraîcheur, variabilité et objectif modulent prudemment la durée sans pénaliser le rythme', () => {
  const sessions=regular.map(s=>({...s,durationSeconds:3600}));
  const fresh=proposeNextSession(input({sessions}));
  const older=proposeNextSession(input({sessions,referenceDate:'2026-10-16'}));
  expect(older.suggestions[0].durationSeconds).toBe(fresh.suggestions[0].durationSeconds);
  const variable=proposeNextSession(input({sessions:sessions.map((s,i)=>({...s,durationSeconds:i%2 ? 1800:7200}))}));
  expect(variable.suggestions[0].durationBasis.assessment).toBe('cautious');
  expect(variable.suggestions[0].durationSeconds).toBeLessThan(variable.evidence.medianDurationSeconds!);
  const returning=proposeNextSession(input({sessions,configuration:config('return')}));
  expect(returning.suggestions[0].durationBasis.assessment).toBe('cautious');
});
it('plafond disponible distinct du maximum proposé, aucune progression automatique', () => {
  const sessions=regular.map(s=>({...s,durationSeconds:3600}));
  const r=proposeNextSession(input({sessions,historicalProfile:{...profile,availability:{days,minutesPerSession:20}}}));
  expect(r.suggestions[0].durationBasis).toMatchObject({observedMedianSeconds:3600,proposedMaximumSeconds:2880,availableMaximumSeconds:1200});
  expect(r.suggestions[0].durationSeconds).toBe(1200);
  const next=proposeNextSession(input({sessions,referenceDate:'2026-10-13',historicalProfile:{...profile,availability:{days,minutesPerSession:20}}}));
  expect(next.suggestions[0].durationSeconds).toBeLessThanOrEqual(r.suggestions[0].durationSeconds);
});
it('validation ciblée partagée sans objectif historique artificiel', () => {
  const availability = {days,sessionsPerWeek:8,minutesPerSession:0};
  const preferences = {terrain:'unknown'} as unknown as CoachProfileValues['preferences'];
  const errors=validateAvailabilityAndPreferences(availability,preferences);
  expect(errors).toMatchObject({sessionsPerWeek:expect.any(String),minutesPerSession:expect.any(String),terrain:expect.any(String)});
  expect(validateProfile({...profile,availability,preferences},'2026-10-12')).toEqual(errors);
  expect(proposeNextSession(input({historicalProfile:{...profile,goal:{kind:'race',targetDate:'2020-01-01'},accompanimentMode:'trainer'}})).suggestions).toHaveLength(1);
  expect(validateAvailabilityAndPreferences(null as unknown as CoachProfileValues['availability'],{})).toHaveProperty('form');
});
it('paramètres adaptatifs explicites, bornés et indépendants des mutations du résultat', () => {
  for (const duration of [undefined,{...policy.duration,supportedFraction:1},{...policy.duration,cautiousFraction:0.9},{...policy.duration,freshCycles:3}]) {
    expect(()=>proposeNextSession(input({policy:{...policy,duration} as ProposalPolicy}))).toThrow();
  }
  const source=input(), copy=structuredClone(source);
  const r=proposeNextSession(source);
  r.policy.duration.cautiousFraction=0.1;
  expect(source).toEqual(copy);
});
it('les intervalles variables seuls ne réduisent pas la durée ni n’imposent de fréquence', () => {
  const sessions=['2026-09-01','2026-09-03','2026-09-20','2026-10-01','2026-10-10'].map((date,i)=>row(String(i),date,3600));
  const r=proposeNextSession(input({sessions}));
  expect(r.suggestions[0].durationBasis.assessment).toBe('supported');
  expect(r.suggestions[0].durationBasis.diagnostic?.gapSpread).toBeGreaterThan(1);
  expect(r.limitations.join(' ')).toContain('intervalles');
  expect(r.suggestions[0].durationSeconds).toBe(2700);
});
it('une médiane très élevée mais incertaine respecte le plafond prudent explicite', () => {
  const sessions=regular.slice(-2).map(s=>({...s,durationSeconds:14400}));
  const r=proposeNextSession(input({sessions,historicalProfile:{...profile,availability:{days,minutesPerSession:240}}}));
  expect(r.suggestions[0].durationSeconds).toBe(policy.duration.cautiousMaximumSeconds);
  expect(r.suggestions[0].durationBasis.reasons.join(' ')).toContain('plafond prudent');
});

it('arrondit après le plafond du jour et explique une proposition devenue trop courte', () => {
  const r=proposeNextSession(input({historicalProfile:{...profile,availability:{days,minutesPerSession:18}}}));
  expect(r.suggestions[0].durationSeconds).toBe(900);
  expect(r.suggestions[0].durationBasis.proposedMaximumSeconds).toBe(1440);
  const none=proposeNextSession(input({historicalProfile:{...profile,availability:{days,minutesPerSession:4}},policy:{...policy,minimumSuggestionSeconds:1}}));
  expect(none.suggestions).toEqual([]);expect(none.constraints.join(' ')).toContain('disponibilités');
});
it('terrain récent explicite : chemins conservés, aucun relief déduit et historique intact', () => {
  const sessions=regular.map(s=>({...s,sport:'TRAIL_RUNNING',ascentMeters:200})), copy=structuredClone(sessions);
  const r=proposeNextSession(input({sessions,historicalProfile:{...profile,preferences:{}}}));
  expect(r.suggestions[0].recommendedTerrain).toMatchObject({surface:'trail',relief:'free'});
  expect(sessions).toEqual(copy);
});
