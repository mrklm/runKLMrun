import { EXPERIMENTAL_REFERENCE_PARAMETERS, habitualReferenceV2, type HabitualReferenceParameters,
  type HabitualReferenceSnapshot, type ReferenceObservation } from './habitual-reference-v2';

export type ReferenceValidityState = 'valid-revisable' | 'valid-retained' | 'insufficient' | 'expired-inactivity';
export interface ReferenceValiditySnapshot extends HabitualReferenceSnapshot {
  validity: ReferenceValidityState;
  lastObservedPracticeDate: string | null;
  /** Une validité conservée décrit la continuité des courses, jamais la capacité actuelle. */
  currentCapacityProven: false;
}

const DAY=86400000;
const day=(value:string)=>Date.parse(`${value}T00:00:00Z`)/DAY;
const revisable=(value:ReferenceObservation)=>value.role==='habitual'||value.role==='independent-unknown';
const observedPractice=(value:ReferenceObservation)=>revisable(value)||value.role==='suggestion-linked';

/** Politique 2G expérimentale : les associations fiables entretiennent la
 * fraîcheur d'un repère existant, sans entrer dans son calcul ni sa révision. */
export function habitualReferenceValidityV2(
  observations:readonly ReferenceObservation[],
  referenceDate:string,
  parameters:HabitualReferenceParameters=EXPERIMENTAL_REFERENCE_PARAMETERS,
):ReferenceValiditySnapshot {
  const snapshot=habitualReferenceV2(observations,referenceDate,parameters);
  const practice=observations.filter(value=>value.date<=referenceDate&&observedPractice(value))
    .sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const lastObservedPracticeDate=practice.at(-1)?.date??null;
  const common={lastObservedPracticeDate,currentCapacityProven:false as const};
  if(snapshot.status==='stable'||snapshot.status==='revised') return {...snapshot,...common,validity:'valid-revisable'};
  if(snapshot.status==='insufficient') return {...snapshot,...common,validity:'insufficient'};

  const eligible=practice.filter(revisable),lastEvidence=eligible.at(-1);
  if(!lastEvidence||!lastObservedPracticeDate||day(referenceDate)-day(lastObservedPracticeDate)>parameters.expiryDays)
    return {...snapshot,...common,validity:'expired-inactivity'};
  const continuation=practice.filter(value=>value.date>lastEvidence.date);
  let previous=lastEvidence.date,continuous=true;
  for(const value of continuation) {
    if(day(value.date)-day(previous)>parameters.expiryDays) { continuous=false;break; }
    previous=value.date;
  }
  if(!continuous||day(referenceDate)-day(previous)>parameters.expiryDays)
    return {...snapshot,...common,validity:'insufficient'};

  const historical=habitualReferenceV2(observations,lastEvidence.date,parameters);
  if(historical.referenceSeconds===null) return {...snapshot,...common,validity:'insufficient'};
  return {...historical,...common,status:'stable',validity:'valid-retained',lastHabitualDate:lastEvidence.date};
}
