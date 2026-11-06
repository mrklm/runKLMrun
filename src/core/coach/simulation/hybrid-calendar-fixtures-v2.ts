import type { HybridCalendarInputV2,CalendarFeedbackV2 } from './hybrid-calendar-v2';
import { calendarDateV2 } from './hybrid-calendar-v2';
import { frequencyHistoryRowsV2,FREQUENCY_STUDY_REFERENCE_V2 } from './frequency-history-fixtures-v2';
import type { PrototypeSession,PrototypeSessionType } from './session-strategies-v2';
export const HYBRID_CALENDAR_START_V2='2026-11-05';
const candidate=(type:PrototypeSessionType):PrototypeSession=>({type,durationSeconds:1800,totalDurationSeconds:1800,
  intensity:type==='easy-endurance'?'easy':type==='long-run'?'steady':'controlled-hard',terrain:type==='hills'?'hills':'flat',
  shortSummary:`Synthétique ${type}`,optional:true,changedDimensions:[],
  rationale:{observedFacts:[],runnerDeclarations:[],designChoices:[],uncertainties:[]}});
export function hybridCalendarScenariosV2():{id:string;input:HybridCalendarInputV2}[] {
  const start=HYBRID_CALENDAR_START_V2;
  const feedback=():Record<string,CalendarFeedbackV2>=>Object.fromEntries(Array.from({length:56},(_,i)=>[
    calendarDateV2(start,i),{result:'performed-as-proposed',effort:'moderate'}]));
  const base=(group:'structured'|'longRun'='structured'):HybridCalendarInputV2=>({referenceDate:start,days:56,group,
    activities:frequencyHistoryRowsV2(84,group==='structured'?12:9,group==='structured'?'intervals':'long-run'),
    reference:FREQUENCY_STUDY_REFERENCE_V2,candidates:[candidate('easy-endurance'),candidate('intervals'),candidate('steady-run'),candidate('hills'),candidate('endurance-variations'),candidate('long-run')],
    goal:group==='structured'?'speed':'race',temperament:'rentre-dedans',availabilitySeconds:1800,availableWeekdays:[0,1,2,3,4,5,6],
    mode:'synthetic-follow-up',feedback:feedback()});
  const single=(group:'structured'|'longRun')=>({...base(group),candidates:[candidate('easy-endurance'),candidate(group==='structured'?'intervals':'long-run')]});
  const eventHard=(effort:'hard'|'very-hard')=>({...single('structured'),events:[{on:calendarDateV2(start,13),upsert:{id:'unexpected',date:calendarDateV2(start,13),durationSeconds:1800,documentedType:'easy-endurance' as const,effort}}]});
  const partial=single('structured');partial.feedback={...partial.feedback,[calendarDateV2(start,12)]:{result:'partial',durationSeconds:900,actualType:'intervals',effort:'hard'}};
  const skipped=single('structured');skipped.feedback={...skipped.feedback,[calendarDateV2(start,12)]:{result:'not-performed'}};
  const projection={...base(),mode:'projection' as const,feedback:undefined};
  return [
    {id:'structured-only',input:single('structured')},
    {id:'long-only',input:single('longRun')},
    {id:'long-restricted-weekdays',input:{...single('longRun'),availableWeekdays:[0,2,4]}},
    {id:'mixed-speed',input:base()},
    {id:'mixed-race',input:base('longRun')},
    {id:'alternating-structured',input:{...base(),candidates:base().candidates.filter(value=>value.type!=='long-run')}},
    {id:'projection-without-realization',input:projection},
    {id:'hard-arrives',input:eventHard('hard')},
    {id:'very-hard-arrives',input:eventHard('very-hard')},
    {id:'volume-increase',input:{...single('structured'),events:[0,1].map(i=>({on:calendarDateV2(start,11+i),upsert:{id:`extra-${i}`,date:calendarDateV2(start,11+i),durationSeconds:3600,documentedType:'easy-endurance' as const,effort:'moderate' as const}}))}},
    {id:'high-stable-volume',input:{...single('structured'),activities:single('structured').activities.map(value=>({...value,durationSeconds:5400})),
      candidates:single('structured').candidates.map(value=>({...value,durationSeconds:5400,totalDurationSeconds:5400})),availabilitySeconds:5400}},
    {id:'return',input:{...single('structured'),activities:single('structured').activities.filter(value=>value.date<=calendarDateV2(start,-56)||value.date>=calendarDateV2(start,-8))}},
    {id:'unknown-efforts',input:{...single('structured'),activities:single('structured').activities.map(value=>({...value,effort:undefined}))}},
    {id:'partial-hard',input:partial},
    {id:'not-performed',input:skipped},
    {id:'deleted-activity',input:{...single('structured'),events:[{on:calendarDateV2(start,7),removeId:'run-14'}]}},
    {id:'corrected-effort',input:{...single('structured'),events:[{on:calendarDateV2(start,7),upsert:{id:'run-14',date:calendarDateV2(start,-14),durationSeconds:1800,documentedType:'intervals',effort:'hard'}}]}},
    {id:'restricted-weekdays',input:{...base(),availableWeekdays:[0,2,4]}},
    {id:'missing-duration',input:{...single('structured'),activities:single('structured').activities.map(value=>value.id==='run-2'?{...value,durationSeconds:undefined}:value)}},
  ];
}
