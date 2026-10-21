import type { CoachV2ReadonlyResult } from './application-adapter-v2';
import type { PersistableOccurrenceV2 } from './persistence-foundations-v2';
import type { PrototypeSession } from './simulation/session-strategies-v2';
import { orchestratePrototypeSession,type PresentedSessionEvidence } from './simulation/session-orchestrator-v2';

export interface CoachV2Perspective {
  date:string;
  session:PrototypeSession|PersistableOccurrenceV2['content'];
  indicative:boolean;
}
const progressionCandidate=(session:PrototypeSession|PersistableOccurrenceV2['content'],referenceSeconds:number|null)=>
  session.type==='easy-endurance'&&referenceSeconds!==null&&session.totalDurationSeconds>referenceSeconds
    &&(!('changedDimensions' in session)||session.changedDimensions.includes('duration'));
const variantKey=(session:PrototypeSession|PersistableOccurrenceV2['content'])=>
  `${session.type}:${session.totalDurationSeconds}:${session.intensity}:${session.terrain}`;

/** Projection sans écriture, ancrée sur la proposition effectivement retenue.
 * Les catalogues utilisent uniquement les activités réelles et la même référence.
 * Les intentions servent à espacer et compléter les séances suivantes. */
export function coachV2Perspectives(result:CoachV2ReadonlyResult,retained?:PersistableOccurrenceV2):CoachV2Perspective[] {
  const date=retained?.opportunity.suggestedFor??result.selectedDate;
  const session=retained?.content??result.candidate;
  if(!date||!session)return [];
  const values:CoachV2Perspective[]=[{date,session,indicative:false}];
  const envisaged:PresentedSessionEvidence[]=[{date,type:session.type}];
  const envisagedVariants=new Set([variantKey(session)]);
  let progressionPlanned=progressionCandidate(session,result.reference.referenceSeconds);
  for(const nextDate of Object.keys(result.admissibleSessionsByDate).sort()){
    if(nextDate<=date)continue;
    const candidates=result.admissibleSessionsByDate[nextDate].filter(candidate=>!progressionPlanned
      ||!progressionCandidate(candidate,result.reference.referenceSeconds));
    if(!candidates.length)continue;
    const selectionInput={referenceDate:nextDate,
      goal:retained?.opportunity.goal??result.catalog.adaptedInput!.goal,habitualReferenceSeconds:result.reference.referenceSeconds,
      availabilitySeconds:Math.max(...candidates.map(value=>value.totalDurationSeconds)),
      coachTemperament:result.coachTemperament,candidates,activities:result.activityEvidence,presented:[],envisaged,
      complementaryTo:values.map(value=>value.session)};
    let selected=orchestratePrototypeSession(selectionInput).selected;
    // Évolution Active préfère d’abord un type encore absent de la projection,
    // mais uniquement parmi les candidats déjà admissibles à cette date.
    const envisagedTypes=new Set(envisaged.flatMap(value=>value.type===undefined?[]:[value.type]));
    if(selected&&result.coachTemperament==='evolution-active'&&envisagedTypes.has(selected.type)) {
      const complementary=candidates.filter(value=>!envisagedTypes.has(value.type));
      if(complementary.length) selected=orchestratePrototypeSession({...selectionInput,candidates:complementary}).selected??selected;
    }
    // Les tempéraments prudents peuvent alterner uniquement des variantes
    // faciles déjà admises ; Rentre dedans conserve son classement ambitieux.
    if(selected&&result.coachTemperament!=='rentre-dedans'&&envisagedVariants.has(variantKey(selected))) {
      const gentleAlternative=candidates.filter(value=>value.type==='easy-endurance'&&value.intensity==='easy'&&!envisagedVariants.has(variantKey(value)));
      if(gentleAlternative.length) selected=orchestratePrototypeSession({...selectionInput,candidates:gentleAlternative}).selected??selected;
    }
    if(!selected)continue;
    values.push({date:nextDate,session:selected,indicative:true});
    envisaged.push({date:nextDate,type:selected.type});
    envisagedVariants.add(variantKey(selected));
    progressionPlanned ||= progressionCandidate(selected,result.reference.referenceSeconds);
  }
  return values;
}
