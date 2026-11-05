import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import type { RunningSession } from '../../types/session';
import type { CoachV2ApplicationSnapshot } from './application-adapter-v2';
import { adaptCoachV2Readonly } from './application-adapter-v2';
import * as evidence from './activity-evidence-v2';
import * as loadPolicy from './load-adaptation-policy-v2';
import { activitySportSignatureV2,civilDate,ianaTimeZone,instantIso,observePresentationV2,selectCandidateV2,
  type PersistableOccurrenceV2 } from './persistence-foundations-v2';
import { reusableActiveOccurrenceV2 } from './presentation-identity-v2';
import { coachV2Perspectives } from './perspectives-v2';
import { matchingDate } from './suggestion-matching';
import type { RecordedActivityEvidence } from './simulation/session-orchestrator-v2';

const today='2026-10-18';
const run=(patch:Partial<RunningSession>={}):RunningSession=>({id:'actual',date:'2026-10-16',title:'Course synthétique',
  sport:'RUNNING',durationSeconds:1830.5,distanceMeters:4200.5,...patch});
const snapshot=(sessions:RunningSession[],occurrences:PersistableOccurrenceV2[]=[]):CoachV2ApplicationSnapshot=>({sessions,occurrences});
async function recommendation(session=run()):Promise<PersistableOccurrenceV2>{
  return (await observePresentationV2({selection:selectCandidateV2({phase:'candidate',
    content:{type:'easy-endurance',totalDurationSeconds:2400,intensity:'easy',terrain:'flat',shortSummary:'Facile'},
    opportunity:{contractVersion:1,goal:'endurance',suggestedFor:civilDate(session.date),
      anchor:{kind:'bootstrap',referenceDate:civilDate('2026-10-01')},availability:{weekday:'friday',maximumSeconds:3600},generation:1}}),
    moment:{presentedAt:instantIso('2026-10-14T08:00:00.000Z'),presentedOn:civilDate('2026-10-14'),
      timeZone:ianaTimeZone('Europe/Paris'),utcOffsetMinutes:120,civilDateRule:'device-local-at-presentation'},
    provenance:{engine:'coach-v2',contractVersion:1,referenceConfidence:'confirmed',referenceSourceIds:[],limitationCodes:[]},
    existing:[],createId:()=> 'recommendation'})).occurrence;
}
type MutableOccurrence = { -readonly [K in keyof PersistableOccurrenceV2]: PersistableOccurrenceV2[K] };
async function linked(session=run(),result:'completed'|'partial'='partial'):Promise<MutableOccurrence>{
  return {...await recommendation(session),state:'associated',activityId:session.id,
    associationEvidence:{sportSignature:activitySportSignatureV2(session)},
    realization:{result,proposalOrigin:'manual',confirmedBy:'user'}};
}
const project=(source:CoachV2ApplicationSnapshot)=>evidence.recordedActivityEvidenceV2(source,today);
afterEach(()=>vi.restoreAllMocks());

describe('preuves réelles D1, sans stockage',()=>{
  it.each(['completed','partial'] as const)('transmet %s sans pondérer les mesures ni reprendre le type conseillé',async result=>{
    const session=run({trainingType:'intervals',feeling:{effort:'hard'}}),occurrence=await linked(session,result);
    const source={...snapshot([session],[occurrence]),documentedActivityTypes:{actual:'long-run' as const}},before=structuredClone(source);
    expect(project(source)).toEqual([{id:'actual',date:session.date,durationSeconds:1830.5,distanceMeters:4200.5,
      documentedType:'intervals',effort:'hard',confirmedRealization:{occurrenceId:occurrence.id,result}}]);
    expect(source).toEqual(before);
  });
  it('garde les absences inconnues, même avec une association historique ou une proposition automatique',async()=>{
    const session=run({distanceMeters:undefined}),occurrence=await linked(session);
    delete occurrence.realization;
    occurrence.realizationProposal={origin:'automatic',result:'completed'};
    expect(project(snapshot([session],[occurrence]))).toEqual([{id:'actual',date:session.date,durationSeconds:1830.5}]);
    expect(project(snapshot([session]))).toEqual(project(snapshot([session],[occurrence])));
  });
  it('ne rattache pas une réponse négative par date et conserve l’activité',async()=>{
    const occurrence={...await recommendation(),realization:{result:'not-completed' as const,proposalOrigin:'manual' as const,confirmedBy:'user' as const}};
    expect(project(snapshot([run()],[occurrence]))).toEqual(project(snapshot([run()])));
  });
  it.each(['wrong-date','wrong-signature','missing-signature','obsolete','unconfirmed','ambiguous'] as const)(
    'ignore une confirmation non fiable : %s',async kind=>{
      const occurrence=await linked();
      if(kind==='wrong-date')occurrence.opportunity={...occurrence.opportunity,suggestedFor:civilDate('2026-10-15')};
      if(kind==='wrong-signature')occurrence.associationEvidence={sportSignature:'stale'};
      if(kind==='missing-signature')delete occurrence.associationEvidence;
      if(kind==='obsolete')Object.assign(occurrence,{state:'obsolete'});
      if(kind==='unconfirmed')Object.assign(occurrence,{realization:{result:'partial',proposalOrigin:'automatic'}});
      const occurrences=kind==='ambiguous'?[occurrence,{...occurrence,id:'other' as typeof occurrence.id}]:[occurrence];
      expect(project(snapshot([run()],occurrences))[0].confirmedRealization).toBeUndefined();
    });
  it.each([undefined,NaN,Infinity,-1,0])('omet une durée invalide ou absente : %s',durationSeconds=>{
    expect(project(snapshot([run({durationSeconds:durationSeconds as number})]))[0]).not.toHaveProperty('durationSeconds');
  });
  it.each([undefined,NaN,Infinity,-1])('omet une distance invalide ou absente : %s',distanceMeters=>{
    expect(project(snapshot([run({distanceMeters})]))[0]).not.toHaveProperty('distanceMeters');
  });
  it('préserve une distance nulle explicitement mesurée',()=>{
    expect(project(snapshot([run({distanceMeters:0})]))[0].distanceMeters).toBe(0);
  });
  it('omet les déclarations invalides, sans reprendre le type conseillé',()=>{
    const session=run();Object.assign(session,{trainingType:'invalid',feeling:{effort:'invalid'}});
    expect(project(snapshot([session]))[0]).not.toHaveProperty('documentedType');
    expect(project(snapshot([session]))[0]).not.toHaveProperty('effort');
  });
  it('conserve le type documenté historique et les règles temporelles existantes',async()=>{
    expect(project({...snapshot([run()]),documentedActivityTypes:{actual:'hills'}})[0].documentedType).toBe('hills');
    const future=run({date:'2026-10-19',trainingType:'intervals',feeling:{effort:'hard'}});
    expect(project(snapshot([future],[await linked(future)]))).toEqual([
      {id:'actual',date:future.date,durationSeconds:1830.5,distanceMeters:4200.5}]);
  });
  it('déduplique les identifiants sans fusion et garde les activités distinctes du même jour',()=>{
    const first=run(),second=run({id:'second',durationSeconds:600});
    expect(project(snapshot([first,{...first,durationSeconds:900},second]))).toEqual(project(snapshot([first,second])));
    expect(project(snapshot([run({date:'invalid'}),first]))).toHaveLength(1);
    expect(project(snapshot([run({id:''}),run({sport:'CYCLING'})]))).toEqual([]);
  });
});

/** Projection antérieure à D1, conservée uniquement comme oracle de non-régression. */
function legacyEvidence(source:CoachV2ApplicationSnapshot,referenceDate:string):RecordedActivityEvidence[]{
  const types=Object.fromEntries(source.sessions.flatMap(session=>{
    const date=matchingDate(session),type=session.trainingType??source.documentedActivityTypes?.[session.id];
    return date!==undefined&&date<=referenceDate&&type?[[session.id,type]]:[];
  }));
  return source.sessions.flatMap(session=>{
    const date=matchingDate(session);if(!date)return [];
    const documentedType=types[session.id],effort=date<=referenceDate?session.feeling?.effort:undefined;
    return [{date,...(documentedType?{documentedType}:{}),...(effort?{effort}:{})}];
  });
}
describe('non-régression D1 isolée de la politique activée en D2b-2',()=>{
  beforeEach(()=>{
    // D1 reste un test de transport. L'effet de la politique est testé séparément.
    const interpret=loadPolicy.interpretRecentLoadV2;
    vi.spyOn(loadPolicy,'interpretRecentLoadV2').mockImplementation(load=>({...interpret(load),decisions:{
      allSessions:{status:'baseline-only',notBefore:null},structured:{status:'baseline-only',notBefore:null},
      longRun:{status:'baseline-only',notBefore:null},preference:'unchanged',progression:'baseline-only'}}));
  });
  for(const temperament of ['pas-a-pas','evolution-active','rentre-dedans'] as const){
    it.each(['partial-hard','partial-easy','different-type','completed-very-hard','no-review','close-activities','not-completed','historical'])(
      `${temperament} : %s`,async scenario=>{
        const session=run({durationSeconds:2400,trainingType:scenario==='no-review'?undefined:scenario==='different-type'?'long-run':'intervals',
          feeling:scenario==='no-review'?undefined:{effort:scenario==='completed-very-hard'?'very-hard':scenario==='partial-easy'?'easy':'hard'}});
        let occurrence=await linked(session,scenario==='completed-very-hard'?'completed':'partial');
        if(scenario==='historical')delete occurrence.realization;
        if(scenario==='not-completed')occurrence={...await recommendation(session),realization:{result:'not-completed',proposalOrigin:'manual',confirmedBy:'user'}};
        const history=['2026-09-23','2026-09-28','2026-10-02','2026-10-06','2026-10-10'].map((date,index)=>run({id:`history-${index}`,date,durationSeconds:2400}));
        const source:CoachV2ApplicationSnapshot={sessions:[...history,session,...(scenario==='close-activities'?[run({id:'second',date:'2026-10-17',durationSeconds:600})]:[])],
          occurrences:scenario==='no-review'?[]:[occurrence],coachTemperament:temperament,
          configuration:{goal:{model:'evolving',kind:'endurance'},experience:'experienced'},
          profile:{goal:{kind:'endurance'},availability:{sessionsPerWeek:3,days:['monday','tuesday','wednesday','thursday','friday','saturday','sunday'],minutesPerSession:60},
            preferences:{terrain:'road'},accompanimentMode:'advisor'}};
        // Inclure une présentation active, afin de comparer aussi la réutilisation.
        const active=await recommendation(run({date:'2026-10-23'}));
        source.occurrences=[...source.occurrences,{...active,id:'active' as typeof active.id}];
        const enriched=adaptCoachV2Readonly(source,today);
        vi.spyOn(evidence,'recordedActivityEvidenceV2').mockImplementation((input,date)=>
          legacyEvidence(input,date) as evidence.ApplicationActivityEvidenceV2[]);
        const legacy=adaptCoachV2Readonly(source,today);
        const {activityEvidence:actual,loadPoliciesByDate:_actualPolicies,...decisions}=enriched;
        const {activityEvidence:previous,loadPoliciesByDate:_previousPolicies,...before}=legacy;
        expect(actual.map(({date,documentedType,effort})=>({date,...(documentedType?{documentedType}:{}),...(effort?{effort}:{})}))).toEqual(previous);
        expect(decisions).toEqual(before);
        const retained=reusableActiveOccurrenceV2(source.occurrences,enriched,today);
        expect(retained).toEqual(reusableActiveOccurrenceV2(source.occurrences,legacy,today));
        expect(coachV2Perspectives(enriched,retained)).toEqual(coachV2Perspectives(legacy,retained));
      });
  }
});
