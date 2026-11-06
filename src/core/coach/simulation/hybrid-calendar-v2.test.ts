import { afterAll,describe,it,expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { compareHybridCalendarsV2,simulateHybridCalendarV2,summarizeHybridCalendarV2,calendarLoadPolicyV2,calendarDateV2 } from './hybrid-calendar-v2';
import { hybridCalendarScenariosV2,HYBRID_CALENDAR_START_V2 as today } from './hybrid-calendar-fixtures-v2';
import { inspectHybridDossierV2 } from './hybrid-dossier-v2';
import { analyzeRecentLoadV2 } from '../recent-load-v2';
import { interpretRecentLoadV2 } from '../load-adaptation-policy-v2';
import { RECOVERY_TIMING_V2,isStructuredRecoveryTypeV2 } from '../recovery-policy-v2';
import { orchestratePrototypeSession } from './session-orchestrator-v2';
import { adaptCoachV2WithContinuity,type CoachV2ApplicationSnapshot } from '../application-adapter-v2';
import { reusableActiveOccurrenceV2,selectedApplicationSuggestionV2 } from '../presentation-identity-v2';
import { coachV2Perspectives } from '../perspectives-v2';
import { observePresentationV2,civilDate,instantIso,ianaTimeZone } from '../persistence-foundations-v2';
const scenarios=hybridCalendarScenariosV2();
const fixture=(id:string)=>scenarios.find(value=>value.id===id)!.input;
const captures:Record<string,ReturnType<typeof compareHybridCalendarsV2>>={};
const calendarResult=(id:string)=>captures[id]??(captures[id]=compareHybridCalendarsV2(fixture(id)));
afterAll(()=>{if(process.env.HYBRID_CALENDAR_CAPTURE==='1')writeFileSync('/tmp/d4e1-calendars.json',JSON.stringify(captures,null,2));});
describe('D4e-1 : calendriers complets sans activation',()=>{
  for(const scenario of scenarios)it(scenario.id,()=>{
    const original=structuredClone(scenario.input),result=compareHybridCalendarsV2(scenario.input);captures[scenario.id]=result;
    expect(scenario.input).toEqual(original);expect(result.effectivePolicy).toBe('A');
    expect(result.humanBlockers).toContain('resolve-D4c-not-calibrated-contract');
    if(scenario.input.events?.length&&!result.draft.violations.length)expect(result.draft.cumulativeStatus).toBe('inconclusive');
    for(const calendar of [result.A.calendar,result.mechanical.calendar,result.draft.calendar]){
      expect(calendar.days).toHaveLength(56);expect(calendar.activationAllowed).toBe(false);
      for(const day of calendar.days){
        expect(day.parameters.minimumDaysAfterActivity).toBe(2);
        expect(day.parameters[scenario.input.group==='structured'?'longActivityGapDays':'structuredActivityGapDays']).toBe(scenario.input.group==='structured'?10:14);
        expect(day.dossier.activationAllowed).toBe(false);
        if(day.selected){
          expect(day.admissibleTypes).toContain(day.selected.type);
          expect(scenario.input.candidates.some(value=>value.type===day.selected!.type&&value.totalDurationSeconds===day.selected!.seconds&&value.intensity===day.selected!.intensity)).toBe(true);
        }
      }
    }
    // Le régime conditionnel retourne A dès que le dossier cesse de remplir la proposition.
    for(const day of result.draft.calendar.days)if(!day.dossier.draftCriteriaMet)expect(day.parameters).toEqual(RECOVERY_TIMING_V2);
  },20000);
  it('adaptateur D2 local identique à A, raisons et inconnues comprises',()=>{
    for(const {input} of scenarios){
      const load=analyzeRecentLoadV2({activities:input.activities,reference:input.reference,referenceDate:today});
      expect(calendarLoadPolicyV2(input.activities,input.reference,today,RECOVERY_TIMING_V2)).toEqual(interpretRecentLoadV2(load));
    }
  });
  it('la sélection quotidienne A utilise le classement existant sans modification',()=>{
    const input={...fixture('mixed-speed'),days:28 as const},calendar=simulateHybridCalendarV2(input,'A');
    const activities=[...input.activities],previous:typeof input.candidates[number][]=[];
    for(const day of calendar.days){
      const selected=orchestratePrototypeSession({referenceDate:day.date,goal:input.goal,habitualReferenceSeconds:day.reference.referenceSeconds,
        availabilitySeconds:input.availabilitySeconds,candidates:input.candidates,activities,presented:[],
        coachTemperament:input.temperament,complementaryTo:previous,
        loadPolicy:interpretRecentLoadV2(analyzeRecentLoadV2({activities,reference:day.reference,referenceDate:day.date}))}).selected;
      expect(day.selected).toEqual(selected?{type:selected.type,seconds:selected.totalDurationSeconds,intensity:selected.intensity}:null);
      if(selected)previous.push(selected);if(day.actual)activities.push(day.actual);
    }
  });
  it('les calendriers mécaniques B déplacent réellement des sélections',()=>{
    for(const id of ['structured-only','long-restricted-weekdays']){
      const result=calendarResult(id);
      expect(result.mechanical.changedDates.length).toBeGreaterThan(0);
    }
  });
  it('neuf jours ne changent rien si les faciles et le repos général repoussent aussi B au dixième jour',()=>{
    const result=calendarResult('long-only');
    expect(result.mechanical.changedDates).toEqual([]);
  });
  it('les successions mixtes et plusieurs faciles sont présentes dans le calendrier complet',()=>{
    const result=calendarResult('mixed-speed');
    const transitions=result.A.summary.transitions;
    expect(transitions.some(value=>isStructuredRecoveryTypeV2(value.from)&&value.to==='long-run')).toBe(true);
    expect(transitions.some(value=>value.from==='long-run'&&isStructuredRecoveryTypeV2(value.to))).toBe(true);
    expect(result.A.calendar.days.filter(value=>value.selected?.type==='easy-endurance').length).toBeGreaterThan(3);
    const alternating=calendarResult('alternating-structured');
    expect(new Set(alternating.mechanical.summary.proposals.map(value=>value.type)).size).toBe(4);
  },20000);
  it('hard/very-hard récents : pas de séance exigeante pendant la fenêtre',()=>{
    for(const id of ['hard-arrives','very-hard-arrives']){
      const calendar=calendarResult(id).draft.calendar;
      for(const day of calendar.days.slice(13,20)){
        expect(day.parameters).toEqual(RECOVERY_TIMING_V2);
        expect(day.selected===null||day.selected.type==='easy-endurance').toBe(true);
      }
    }
  });
  it('projection non réalisée : aucune intention n’entre dans les preuves',()=>{
    const input=fixture('projection-without-realization'),calendar=simulateHybridCalendarV2(input,'B-mechanical');
    expect(calendar.observedActivities).toEqual([...input.activities].sort((a,b)=>a.date.localeCompare(b.date)||(a.id??'').localeCompare(b.id??'')));
    expect(calendar.days.every(value=>value.actual===null)).toBe(true);
    expect(calendar.days.at(-1)!.knownActivityIds.every(value=>!value.startsWith('synthetic-'))).toBe(true);
  });
  it('partiel difficile : durée et type réels, sans pénalité fondée sur partial seul',()=>{
    const input={...fixture('partial-hard'),days:28 as const};
    const partial=simulateHybridCalendarV2(input,'A');
    expect(partial.days[12].actual).toMatchObject({durationSeconds:900,documentedType:'intervals',effort:'hard',confirmedRealization:{result:'partial'}});
    expect(partial.days[13].dossier.failed).toContain('no-documentary-adverse-signals');
    const changed=structuredClone(input);changed.feedback={...changed.feedback,[calendarDateV2(today,12)]:{result:'performed-as-proposed',durationSeconds:900,actualType:'intervals',effort:'hard'}};
    const completed=simulateHybridCalendarV2(changed,'A');
    expect(completed.days.map(value=>value.selected)).toEqual(partial.days.map(value=>value.selected));
  });
  it('non-réalisation : proposition sans activité ajoutée',()=>{
    const calendar=calendarResult('not-performed').A.calendar;
    expect(calendar.days[12].selected).not.toBeNull();expect(calendar.days[12].actual).toBeNull();
    expect(calendar.days[13].knownActivityIds).not.toContain(`synthetic-${calendarDateV2(today,12)}`);
  });
  it('suppression/correction après consultation : les sources et le dossier sont réévalués',()=>{
    const deleted=calendarResult('deleted-activity').draft.calendar;
    expect(deleted.days[6].knownActivityIds).toContain('run-14');expect(deleted.days[7].knownActivityIds).not.toContain('run-14');
    const corrected=calendarResult('corrected-effort').draft.calendar;
    expect(corrected.days[7].dossier.failed).toContain('no-documentary-adverse-signals');
    expect(corrected.days[7].parameters).toEqual(RECOVERY_TIMING_V2);
  });
  it.each(['structured','longRun'] as const)('une réalisation à B ne crée ni échec automatique ni droit acquis : %s',group=>{
    const input=fixture(group==='structured'?'structured-only':'long-only'),gap=group==='structured'?12:9;
    const activities=[...input.activities,{id:'new-real',date:calendarDateV2(today,gap-2),durationSeconds:1800,
      documentedType:group==='structured'?'hills' as const:'long-run' as const,effort:'moderate' as const}];
    const result=inspectHybridDossierV2({activities,reference:input.reference,referenceDate:calendarDateV2(today,gap-2)},group);
    expect(result.adverse.map(value=>value.code)).not.toContain('close-family-sessions');
    expect(result.activationAllowed).toBe(false);expect(result.humanBlockers).toHaveLength(4);
  });
  it('ordre différent : décisions et calendriers complets identiques',()=>{
    const input={...fixture('structured-only'),days:28 as const};
    expect(compareHybridCalendarsV2({...input,activities:[...input.activities].reverse()})).toEqual(compareHybridCalendarsV2(input));
  },20000);
  it('activités futures initiales exclues, sans acquisition de preuve au fil de la projection',()=>{
    const input={...fixture('structured-only'),days:28 as const,mode:'projection' as const};
    const a=simulateHybridCalendarV2(input,'A'),b=simulateHybridCalendarV2({...input,activities:[...input.activities,{id:'future',date:calendarDateV2(today,3),effort:'very-hard'}]},'A');
    expect(b).toEqual(a);
  });
  it('maxima 7/14 jours : passé traversant J et fin du calendrier inclus',()=>{
    const input={...fixture('structured-only'),days:28 as const};
    const calendar=simulateHybridCalendarV2(input,'A'),summary=summarizeHybridCalendarV2(input,calendar);
    expect(summary.windows[0].windows[0].from).toBe(calendarDateV2(today,-6));
    expect(summary.windows[1].windows.at(-1)!.through).toBe(calendarDateV2(today,40));
    expect(summary.windows[1].maximumCount).toBeGreaterThanOrEqual(1);
    const first=summary.windows[0].windows[0];expect(first.count).toBe(1);
  });
});

const snapshot=():CoachV2ApplicationSnapshot=>({coachTemperament:'rentre-dedans',sessions:fixture('structured-only').activities.map(value=>({id:value.id!,date:value.date,
  title:'Synthétique',sport:'RUNNING',durationSeconds:1800,distanceMeters:5000,trainingType:'easy-endurance',feeling:{effort:'moderate'}})),
  configuration:{goal:{model:'evolving',kind:'speed'},experience:'experienced'},profile:{goal:{kind:'endurance'},availability:{sessionsPerWeek:3,
    days:['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],minutesPerSession:60},preferences:{terrain:'road'},accompanimentMode:'advisor'},occurrences:[]});
const moment={presentedAt:instantIso(`${today}T08:00:00.000Z`),presentedOn:civilDate(today),timeZone:ianaTimeZone('Europe/Paris'),utcOffsetMinutes:60,civilDateRule:'device-local-at-presentation' as const};
async function withActive(source:CoachV2ApplicationSnapshot){
  const result=await adaptCoachV2WithContinuity(source,today);
  const old=(await observePresentationV2({selection:selectedApplicationSuggestionV2(result,1),moment,existing:[],createId:()=>'old-active',
    provenance:{engine:'coach-v2',contractVersion:1,referenceConfidence:'confirmed',referenceSourceIds:result.reference.sourceIds,limitationCodes:[]}})).occurrence;
  source.occurrences=[old];return old;
}
describe('D4e-1 : chemins applicatifs réels préservés',()=>{
  it('active devenue périmée : recalcul, rejet de réutilisation, historique intact',async()=>{
    const source=snapshot(),old=await withActive(source),before=await adaptCoachV2WithContinuity(source,today);
    expect(reusableActiveOccurrenceV2(source.occurrences,before,today)?.id).toBe(old.id);
    source.sessions=[...source.sessions,{id:'new-real',date:today,title:'Réelle synthétique',sport:'RUNNING',durationSeconds:1800,trainingType:'intervals',feeling:{effort:'very-hard'}}];
    const after=await adaptCoachV2WithContinuity(source,today);
    expect(reusableActiveOccurrenceV2(source.occurrences,after,today)).toBeUndefined();
    expect(source.occurrences).toEqual([old]);
    expect(coachV2Perspectives(after,old).every(value=>value.date!==today)).toBe(true);
  });
  it.each(['pas-a-pas','evolution-active','rentre-dedans'] as const)('simulation sans effet sur recommandations, actives et perspectives : %s',async coachTemperament=>{
    const source=snapshot();source.coachTemperament=coachTemperament;await withActive(source);
    const initial=structuredClone(source),before=await adaptCoachV2WithContinuity(source,today);
    const active=reusableActiveOccurrenceV2(source.occurrences,before,today),perspectives=coachV2Perspectives(before,active);
    const input={...fixture('structured-only'),days:28 as const,temperament:coachTemperament};
    const result=compareHybridCalendarsV2(input);expect(result.effectivePolicy).toBe('A');
    const after=await adaptCoachV2WithContinuity(source,today);
    expect(after).toEqual(before);expect(reusableActiveOccurrenceV2(source.occurrences,after,today)).toEqual(active);
    expect(coachV2Perspectives(after,active)).toEqual(perspectives);expect(source).toEqual(initial);
  },20000);
  it('le partiel sans durée/type renseigné reste inconnu, pas une copie de prescription',()=>{
    const base=fixture('structured-only');
    const calendar=simulateHybridCalendarV2({...base,days:28,feedback:{...base.feedback,[today]:{result:'partial',effort:'moderate'}}},'A');
    expect(calendar.days[0].actual).toMatchObject({durationSeconds:undefined,documentedType:undefined});
  });
});

describe('D4e-1 : garde-fous de comparaison',()=>{
  it('activité réelle à J incluse dans les maxima et pic de durée inconnu conservé',()=>{
    const base={...fixture('structured-only'),days:28 as const};
    const input={...base,activities:[...base.activities,{id:'today',date:today,documentedType:'long-run' as const}]};
    const calendar=simulateHybridCalendarV2(input,'A'),summary=summarizeHybridCalendarV2(input,calendar);
    expect(calendar.days[0].selected).toBeNull();
    expect(summary.windows[0].windows[0]).toMatchObject({count:2,seconds:null});
    expect(summary.windows[0].maximumSeconds).toBeNull();
  });
  it('dates et paramètres de calendrier non définis refusés',()=>{
    expect(()=>simulateHybridCalendarV2({...fixture('structured-only'),referenceDate:'invalid'},'A')).toThrow();
    expect(()=>simulateHybridCalendarV2({...fixture('structured-only'),availableWeekdays:[7]},'A')).toThrow();
  });
});
