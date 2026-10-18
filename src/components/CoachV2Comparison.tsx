import { useEffect,useState } from 'react';
import { localCoachV2Reference } from '../core/coach/local-reference-v2';
import type { CoachVersionsComparison,ComparableCoachSuggestion } from '../core/coach/comparison-v1-v2';
import { coachV2InternalEnabled } from './CoachV2Experimental';
import { formatCoachDuration } from './coach-planning-display';
import { readCoachV2Snapshot } from '../storage/coach-v2-readonly';
import { coachComparisonDisplay, coachValueLabel } from './coach-v2-display';
import { CoachExplanationDetails } from './CoachExplanationDetails';

const dateLabel=(value:string)=>value.split('-').reverse().join('/');
export function ComparisonSuggestions({title,values,status,reasons=[],limitations=[]}:{title:string;values:ComparableCoachSuggestion[];status:string;reasons?:readonly string[];limitations?:readonly string[]}) {
  return <section><h3>{title}</h3><p className="training-coverage">État : {coachValueLabel(status)}</p>
    {values.length?values.map((value,index)=><article className="notice" key={`${value.engine}-${value.date}-${index}`}>
      {value.engine==='V2'&&<p>{value.indicative?'Perspective facultative et révisable':'Prochaine séance conseillée'}</p>}
      <h4>{dateLabel(value.date)} — {coachValueLabel(value.type)}</h4>
      <p>{formatCoachDuration(value.durationSeconds)} · {coachValueLabel(value.intensity)} · {coachValueLabel(value.terrain)}</p>
      <CoachExplanationDetails reasons={value.reasons} limitations={value.limitations}/>
    </article>):<><p>Aucune suggestion calculée.</p><CoachExplanationDetails reasons={reasons} limitations={limitations}/></>}
  </section>;
}

export function CoachV2Comparison() {
  const enabled=coachV2InternalEnabled(),[result,setResult]=useState<CoachVersionsComparison>(),[error,setError]=useState('');
  useEffect(()=>{if(!enabled)return;let active=true;setError('');const date=localCoachV2Reference();void readCoachV2Snapshot()
    .then(snapshot=>{if(active)setResult(coachComparisonDisplay(snapshot,date));}).catch(()=>{if(active)setError('La comparaison locale n’a pas pu être calculée.');});
    return()=>{active=false;};},[enabled]);
  if(!enabled)return null;
  return <section className="panel coach-v2-comparison" aria-labelledby="coach-comparison-title" data-testid="coach-v2-comparison">
    <p className="training-coverage">Développement uniquement · lecture seule</p>
    <h2 id="coach-comparison-title">Comparaison Coach V1 / V2</h2>
    <p>Même historique local, même objectif et mêmes disponibilités. {result?`${result.sessionCount} activités analysées.`:'Calcul en cours…'}</p>
    {error&&<p role="alert">{error}</p>}
    {result&&<div className="settings-grid"><ComparisonSuggestions title="Coach V1" values={result.v1.suggestions} {...result.v1}/>
      <ComparisonSuggestions title="Coach V2" values={result.v2.suggestions} {...result.v2}/></div>}
  </section>;
}
