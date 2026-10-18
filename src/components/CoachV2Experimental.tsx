import { coachV2Perspectives } from '../core/coach/perspectives-v2';
import { useEffect,useRef,useState } from 'react';
import { localToday } from '../core/analysis/statistics-period';
import { localCoachV2Reference } from '../core/coach/local-reference-v2';
import { formatCoachDuration } from './coach-planning-display';
import { reusableActiveOccurrenceV2 } from '../core/coach/presentation-identity-v2';
import { calculateCoachV2Readonly } from '../storage/coach-v2-readonly';
import { createSuggestionV2Repository,presentCoachV2Selection } from '../storage/coach-suggestions-v2';
import { civilDate,ianaTimeZone,instantIso,type PersistableOccurrenceV2 } from '../core/coach/persistence-foundations-v2';
import type { CoachV2ReadonlyResult } from '../core/coach/application-adapter-v2';
import { COACH_V2_INTERNAL_KEY,coachV2Enabled,coachV2ActivationMode } from '../core/coach/activation-v2';
import { watchSuggestionPresentation } from './suggestion-presentation';
import { coachV2Labels, coachV2PerspectiveExplanation, coachV2Explanation, storedCoachV2Explanation, coachExplanationText } from './coach-v2-display';
import { CoachExplanationDetails } from './CoachExplanationDetails';

export { COACH_V2_INTERNAL_KEY };
export const coachV2InternalEnabled=()=>coachV2ActivationMode()==='internal';
export { coachV2Labels };
const dateLabel=(value:string)=>value.split('-').reverse().join('/');
type View={result:CoachV2ReadonlyResult;occurrence?:PersistableOccurrenceV2};

export function CoachV2Experimental({surface='training'}:{surface?:'training'|'home'}) {
  const enabled=coachV2Enabled(),cardRef=useRef<HTMLElement>(null),attemptedRef=useRef('');
  const [view,setView]=useState<View>(),[loadError,setLoadError]=useState(''),[presentationError,setPresentationError]=useState('');
  const [busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0),[retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!enabled)return;
    let wasHidden=document.visibilityState==='hidden';
    const consult=()=>{
      if(document.visibilityState==='hidden'){wasHidden=true;return;}
      if(!wasHidden)return;
      wasHidden=false;setRefresh(value=>value+1);
    };
    // Les changements de stockage sont relus à la consultation, sans renouvellement en arrière-plan.
    document.addEventListener('visibilitychange',consult);
    return()=>document.removeEventListener('visibilitychange',consult);
  },[enabled]);
  useEffect(()=>{if(!enabled)return;let active=true;setView(undefined);setLoadError('');const reference=localCoachV2Reference();
    calculateCoachV2Readonly(reference).then(async result=>{const occurrences=await createSuggestionV2Repository().listAll();
      if(active)setView({result,occurrence:reusableActiveOccurrenceV2(occurrences,result,reference.date)});})
      .catch(()=>{if(active)setLoadError('Le Coach ne peut pas préparer de suggestion pour le moment.');});return()=>{active=false;};},[enabled,refresh]);
  const result=view?.result,occurrence=view?.occurrence,session=occurrence?.content??result?.candidate,
    date=occurrence?.opportunity.suggestedFor??result?.selectedDate;
  const presentationKey=!occurrence&&result&&session&&date
    ?`${result.temporalAnchor ?? 'missing'}:${date}:${JSON.stringify(result.declarations.goal)}`:'';
  useEffect(()=>{const card=cardRef.current;if(!enabled||!card||!result||!session||!date||occurrence||!presentationKey)return;
    if(attemptedRef.current===`${presentationKey}:${retry}`)return;
    return watchSuggestionPresentation(card,stillVisible=>{if(!stillVisible())return;attemptedRef.current=`${presentationKey}:${retry}`;setBusy(true);setPresentationError('');
      const now=new Date();void presentCoachV2Selection({result,referenceDate:civilDate(localToday()),moment:{presentedAt:instantIso(now.toISOString()),
        presentedOn:civilDate(localToday()),timeZone:ianaTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone),utcOffsetMinutes:-now.getTimezoneOffset(),civilDateRule:'device-local-at-presentation'},
        provenance:{engine:'coach-v2',contractVersion:1,referenceConfidence:result.reference.confidence==='confirmed'?'confirmed':'provisional',
          referenceSourceIds:[...result.reference.sourceIds],limitationCodes:[]}}).then(stored=>{
            if(stillVisible())setView({result,occurrence:stored.occurrence});
          }).catch(()=>setPresentationError('La suggestion est affichée, mais elle n’a pas pu être mémorisée.')).finally(()=>setBusy(false));
    },{title:'[data-presentation-title]',summary:'[data-presentation-summary]'});
  },[enabled,result,session,date,occurrence,presentationKey,retry]);
  if(!enabled)return null;
  if(loadError)return <section className="panel coach-v2-experimental" aria-label="Coach V2 expérimental" data-testid="coach-v2-experimental"><h2>Coach V2 expérimental</h2><p role="alert">{loadError}</p></section>;
  if(!view)return <section className="panel coach-v2-experimental" aria-label="Coach V2 expérimental" data-testid="coach-v2-experimental"><h2>Coach V2 expérimental</h2><p role="status">Calcul expérimental en cours…</p></section>;
  if(!session||!date)return <section className="panel coach-v2-experimental" aria-label="Coach V2 expérimental" data-testid="coach-v2-experimental"><h2>Coach V2 expérimental</h2>
    <p>{result!.reason==='missing-temporal-anchor'?'Le Coach ne dispose pas encore d’un repère stable pour proposer une séance.':'Aucune suggestion adaptée n’est disponible actuellement.'}</p>
    <CoachExplanationDetails {...coachV2Explanation(result!)}/></section>;
  const perspectives=coachV2Perspectives(result!,occurrence).slice(1);
  const summary=`${coachV2Labels.type[session.type]} · ${formatCoachDuration(session.totalDurationSeconds)} · ${coachV2Labels.intensity[session.intensity]} · ${coachV2Labels.terrain[session.terrain]}`;
  return <section ref={cardRef} className="panel coach-v2-experimental" aria-label="Coach V2 expérimental" data-testid="coach-v2-experimental">
    <p className="training-coverage">Développement uniquement · proposition expérimentale et facultative</p>
    {surface==='home'?<><h2>Suggestion du Coach</h2><h3 data-presentation-title>{summary}</h3></>:<h2 data-presentation-title>{summary}</h2>}
    <p>Prochaine séance conseillée</p>
    <p data-presentation-summary><strong>{dateLabel(date)}</strong> · {coachV2Labels.type[session.type]} · {formatCoachDuration(session.totalDurationSeconds)} · {coachV2Labels.intensity[session.intensity]} · {coachV2Labels.terrain[session.terrain]}</p>
    {(!!session.optionalInstructions?.length||session.structure)&&<details><summary>Voir les consignes</summary>
    {!!session.optionalInstructions?.length&&<ul>{session.optionalInstructions.map(value=><li key={value}>{coachExplanationText(value)}</li>)}</ul>}
    {session.structure&&<ul>
      {session.structure.warmUp&&<li>Échauffement : {formatCoachDuration(session.structure.warmUp.durationSeconds)} — {session.structure.warmUp.instruction}</li>}
      {session.structure.efforts.map((block,index)=><li key={`effort-${index}`}>Effort : {block.repetitions&&`${block.repetitions} × `}{formatCoachDuration(block.durationSeconds)} — {block.instruction}</li>)}
      {session.structure.recoveries?.map((block,index)=><li key={`recovery-${index}`}>Récupération : {block.repetitions&&`${block.repetitions} × `}{formatCoachDuration(block.durationSeconds)} — {block.instruction}</li>)}
      {session.structure.coolDown&&<li>Retour au calme : {formatCoachDuration(session.structure.coolDown.durationSeconds)} — {session.structure.coolDown.instruction}</li>}
    </ul>}</details>}
    <CoachExplanationDetails {...(occurrence?storedCoachV2Explanation(occurrence):coachV2Explanation(result!))}/>
    {perspectives.length>0&&<section aria-label="Perspectives sur 7 jours">
      <h3>Perspectives des jours suivants</h3>
      <p>Facultatives et susceptibles d’évoluer selon vos activités réelles.</p>
      {perspectives.map(value=><article className="notice" key={value.date}>
        <h4>{dateLabel(value.date)} — {coachV2Labels.type[value.session.type]}</h4>
        <p>{formatCoachDuration(value.session.totalDurationSeconds)} · {coachV2Labels.intensity[value.session.intensity]} · {coachV2Labels.terrain[value.session.terrain]}</p>
        <CoachExplanationDetails {...coachV2PerspectiveExplanation(value)}/>
      </article>)}
    </section>}
    {occurrence?<p role="status">Cette suggestion vous est proposée.</p>:busy?<p role="status">Mémorisation de la suggestion…</p>:null}
    {presentationError&&<p role="alert">{presentationError} <button className="button button-secondary" onClick={()=>{setPresentationError('');setRetry(value=>value+1);}}>Réessayer</button></p>}
  </section>;
}
