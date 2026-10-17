/** Banc synthétique uniquement : aucun import de stockage, aucune horloge système. */
import { proposeSuggestions, type ProposalInput } from '../proposals';
import { productPolicy } from '../product-policy';
import { replacementCandidates, suggestionExpiry, suggestionId, validateStoredSuggestion } from '../suggestions';
import { suggestionAssociations } from '../suggestion-matching';
import type { RunningSession } from '../../../types/session';
import type { PresentedSuggestion, StoredSuggestion } from '../../../types/coach-suggestion';
import type { EvolvingCoachValues } from '../../../types/evolving-coach';

export const START = '2026-01-05';
export const dateAt = (offset: number) => new Date(Date.parse(`${START}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
export type Behaviour = 'all' | 'alternate' | 'none' | 'personal';
export const behaviours: Behaviour[] = ['all', 'alternate', 'none', 'personal'];
export interface Profile { id: string; label: string; input: ProposalInput }
const run = (id: string, date: string, minutes: number): RunningSession => ({id, date, title: 'Sortie synthétique', sport: 'RUNNING', durationSeconds: minutes * 60});
function history(frequency: 2 | 3, age = 0) {
  const days = frequency === 2 ? [1, 5] : [0, 2, 5];
  return Array.from({length: 42}, (_, i) => i - 42).filter(d => days.includes((d % 7 + 7) % 7))
    .map((d, i) => run(`seed-${i}`, dateAt(d - age), [35, 40, 45, 38][i % 4]));
}
function profile(id: string, label: string, goal: EvolvingCoachValues['goal'], frequency: 2 | 3, age = 0, empty = false): Profile {
  return {id, label, input: {
    sessions: empty ? [] : history(frequency, age), referenceDate: START, policy: productPolicy(goal.kind),
    configuration: {goal, experience: goal.kind === 'begin' ? 'beginner' : 'experienced', structuredPlanningPreference: 'accepted'},
    historicalProfile: {goal: {}, availability: {days: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'], sessionsPerWeek: frequency, minutesPerSession: 60}, preferences: {terrain: 'trail'}},
  }};
}
export function profiles(): Profile[] {
  return [
    profile('begin', 'Débutant sans historique', {model:'evolving',kind:'begin'}, 2, 0, true),
    profile('regular2', 'Régulier, deux sorties/semaine', {model:'evolving',kind:'endurance'}, 2),
    profile('regular3', 'Régulier, trois sorties/semaine', {model:'evolving',kind:'endurance'}, 3),
    profile('old', 'Expérimenté, historique ancien', {model:'evolving',kind:'endurance'}, 3, 210),
    profile('return', 'Reprise après quatre mois', {model:'evolving',kind:'return'}, 2, 120),
    profile('endurance', 'Objectif endurance', {model:'evolving',kind:'endurance'}, 3),
    profile('speed', 'Objectif vitesse', {model:'evolving',kind:'speed'}, 3),
    profile('distance', 'Objectif 10 km', {model:'evolving',kind:'distance',distanceMeters:10000}, 3),
    profile('race', 'Course 10 km après les douze semaines', {model:'evolving',kind:'race',distanceMeters:10000,eventDate:dateAt(98)}, 3),
  ];
}
export interface Week {
  week: number; presentedDurations: number[]; durations: number[]; suggestedSeconds: number; actualSeconds: number; actualCount: number;
  recentMedian: number | null; reference: number | null; easy: number; demanding: number;
  newIdentities: number; noProposalDays: number; associated: number;
}
export interface Trace {
  date: string; result: ReturnType<typeof proposeSuggestions>;
  due: PresentedSuggestion[]; performed: RunningSession[];
}
export interface Simulation { profile: string; behaviour: Behaviour; weeks: Week[]; trace: Trace[]; records: StoredSuggestion[]; sessions: RunningSession[] }
const median = (values: number[]) => {
  const sorted = [...values].sort((a,b)=>a-b), n=sorted.length;
  return n ? (sorted[Math.floor((n-1)/2)] + sorted[Math.floor(n/2)]) / 2 : null;
};
/** Adaptateur mémoire : ensemble supposé entièrement consulté après chaque calcul.
 * Réutilise les règles pures d'identité, obsolescence, validation et rapprochement.
 * Ni les transactions ni l'observation DOM ne sont simulées. Aucun planning initial.
 */
export function present(records: StoredSuggestion[], members: PresentedSuggestion[], today: string) {
  const timestamp = `${today}T18:00:00.000Z`;
  for (const member of members) if (!records.some(r=>r.id===suggestionId(member))) {
    records.push({...structuredClone(member), id:suggestionId(member), createdAt:timestamp, updatedAt:timestamp, revision:1, expiresOn:suggestionExpiry(member.date), state:'current'});
  }
  for (const old of replacementCandidates(records, members, today)) {
    old.state='superseded'; old.revision++; old.updatedAt=timestamp;
  }
  records.forEach(validateStoredSuggestion);
}
export function reconcile(records: StoredSuggestion[], sessions: RunningSession[], today: string) {
  const links = suggestionAssociations(records, sessions);
  for (const record of records) if (record.activityId !== links.get(record.id)) {
    const id=links.get(record.id);
    if(id===undefined) delete record.activityId; else record.activityId=id;
    record.revision++; record.updatedAt=`${today}T18:00:00.000Z`;
  }
}
export function simulate(profile: Profile, behaviour: Behaviour): Simulation {
  const input=structuredClone(profile.input), sessions=[...input.sessions], records: StoredSuggestion[]=[], trace: Trace[]=[];
  const weeks: Week[]=Array.from({length:12},(_,i)=>({week:i+1,presentedDurations:[],durations:[],suggestedSeconds:0,actualSeconds:0,actualCount:0,recentMedian:null,reference:null,easy:0,demanding:0,newIdentities:0,noProposalDays:0,associated:0}));
  let ordinal=0;
  // Consultation la veille : les activités du premier jour peuvent être proposées.
  for(let day=-1;day<84;day++) {
    const today=dateAt(day), week=day>=0 ? weeks[Math.floor(day/7)] : undefined;
    const due=records.filter(r=>r.date===today && r.state==='current' && !r.activityId && r.expiresOn>today);
    const performed: RunningSession[]=[];
    for(const suggestion of due) {
      const follow=behaviour==='all'||behaviour==='personal'||(behaviour==='alternate'&&ordinal%2===0); ordinal++;
      if(follow) performed.push(run(`actual-${day}-${performed.length}`,today,suggestion.durationSeconds/60));
    }
    // D = toutes les suggestions + une sortie personnelle hebdomadaire, même
    // lorsqu'une suggestion tombe ce jour-là : ambiguïté conservée par le matcher.
    if(day>=0 && behaviour==='personal' && day%7===6) performed.push(run(`personal-${day}`,today,[35,45,40][Math.floor(day/7)%3]));
    sessions.push(...performed); reconcile(records,sessions,today);
    const result=proposeSuggestions({...input, sessions, referenceDate:today});
    const members=result.suggestions.map(s=>({date:s.date,kind:s.kind,durationSeconds:s.durationSeconds,terrain:{surface:s.recommendedTerrain.surface,relief:s.recommendedTerrain.relief}}));
    const newMembers=members.filter(s=>!records.some(r=>r.id===suggestionId(s)));
    const before=records.length; present(records,members,today); reconcile(records,sessions,today);
    if(week) {
      const durations=due.map(s=>s.durationSeconds);
      week.durations.push(...durations); week.suggestedSeconds+=durations.reduce((a,b)=>a+b,0);
      week.actualSeconds+=performed.reduce((a,b)=>a+b.durationSeconds,0); week.actualCount+=performed.length;
      week.easy+=due.length; // Le moteur actuel propose exclusivement intensity.kind=easy.
      week.presentedDurations.push(...newMembers.map(s=>s.durationSeconds));
      week.newIdentities+=records.length-before; week.noProposalDays+=Number(!members.length);
      const ids=new Set(result.evidence.horizons.find(h=>h.kind==='recent')!.sessionIds);
      week.recentMedian=median(sessions.filter(s=>ids.has(s.id)&&Number.isFinite(s.durationSeconds)&&s.durationSeconds>0&&s.durationSeconds<=86400).map(s=>s.durationSeconds));
      week.reference=result.evidence.medianDurationSeconds;
      week.associated=records.filter(r=>r.date>=dateAt(Math.floor(day/7)*7)&&r.date<=today&&r.activityId).length;
      trace.push({date:today,result,due:structuredClone(due),performed:structuredClone(performed)});
    }
  }
  return {profile:profile.id,behaviour,weeks,trace,records,sessions};
}
export const simulateAll = () => profiles().flatMap(p=>behaviours.map(b=>simulate(p,b)));
