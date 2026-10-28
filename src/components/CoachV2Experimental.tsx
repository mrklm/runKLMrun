import { useEffect,useRef,useState,type ReactNode } from 'react';
import { localToday } from '../core/analysis/statistics-period';
import { formatCoachDuration } from './coach-duration-format';
import { readCoachV2Projection } from './coach-v2-projection';
import { coachV2Perspectives, type CoachV2Perspective } from '../core/coach/perspectives-v2';
import { CoachV2TemperamentChanged,presentCoachV2Selection } from '../storage/coach-suggestions-v2';
import { civilDate,ianaTimeZone,instantIso,type PersistableOccurrenceV2 } from '../core/coach/persistence-foundations-v2';
import type { CoachV2ReadonlyResult } from '../core/coach/application-adapter-v2';
import { coachV2Enabled } from '../core/coach/activation-v2';
import { watchSuggestionPresentation } from './suggestion-presentation';
import { coachV2Labels, coachV2PerspectiveExplanation, coachV2Explanation, storedCoachV2Explanation, coachExplanationText } from './coach-v2-display';
import { CoachExplanationDetails } from './CoachExplanationDetails';
import { useProfileDatabase } from '../storage/profile-context';

export { coachV2Labels };
const dateLabel=(value:string)=>value.split('-').reverse().join('/');
type View={result:CoachV2ReadonlyResult;occurrence?:PersistableOccurrenceV2;perspectives?:CoachV2Perspective[];freshExplanation?:ReturnType<typeof coachV2Explanation>};
type CoachSession=Pick<NonNullable<CoachV2ReadonlyResult['candidate']>,'type'|'totalDurationSeconds'|'intensity'|'terrain'>;
export function CoachSuggestionCard({session,date,label,reasons,limitations,primary=false,instructions}:{session:CoachSession;date:string;label:string;reasons:readonly string[];limitations:readonly string[];primary?:boolean;instructions?:ReactNode}) {
  return <article className={`panel coach-v2-card${primary?' coach-v2-card-primary':''}`}>
    <p className="training-coverage">{label}</p>
    <h3 {...(primary?{'data-presentation-title':true}:{})}>{dateLabel(date)} — {coachV2Labels.type[session.type]}</h3>
    <p {...(primary?{'data-presentation-summary':true}:{})}>{formatCoachDuration(session.totalDurationSeconds)} · {coachV2Labels.intensity[session.intensity]} · {coachV2Labels.terrain[session.terrain]}</p>
    {instructions}
    <CoachExplanationDetails reasons={reasons} limitations={limitations}/>
  </article>;
}

export function CoachV2Experimental() {
  const database=useProfileDatabase();
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
  useEffect(()=>{if(!enabled)return;let active=true;setView(undefined);setLoadError('');
    readCoachV2Projection(database).then(({result,occurrence,perspectives})=>{if(active)setView({result,occurrence,perspectives});})
      .catch(()=>{if(active)setLoadError('Le Coach ne peut pas préparer de suggestion pour le moment.');});return()=>{active=false;};},[database,enabled,refresh]);
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
          referenceSourceIds:[...result.reference.sourceIds],limitationCodes:[]}},database).then(stored=>{
            if(stillVisible())setView({result,occurrence:stored.occurrence,perspectives:coachV2Perspectives(result,stored.occurrence),
              ...(stored.status==='created'?{freshExplanation:coachV2Explanation(result)}:{})});
          }).catch(error=>{
            if(error instanceof CoachV2TemperamentChanged){attemptedRef.current='';setRefresh(value=>value+1);}
            else setPresentationError('La suggestion est affichée, mais elle n’a pas pu être mémorisée.');
          }).finally(()=>setBusy(false));
    },{title:'[data-presentation-title]',summary:'[data-presentation-summary]'});
  },[database,enabled,result,session,date,occurrence,presentationKey,retry]);
  if(!enabled)return null;
  if(loadError)return <section className="panel coach-v2-experimental" aria-label="Coach" data-testid="coach-v2-experimental"><h2>Suggestions du Coach</h2><p role="alert">{loadError}</p></section>;
  if(!view)return <section className="panel coach-v2-experimental" aria-label="Coach" data-testid="coach-v2-experimental"><h2>Suggestions du Coach</h2><p role="status">Calcul en cours…</p></section>;
  if(!session||!date)return <section className="panel coach-v2-experimental" aria-label="Coach" data-testid="coach-v2-experimental"><h2>Suggestions du Coach</h2>
    <p>{result!.reason==='missing-temporal-anchor'?'Le Coach ne dispose pas encore d’un repère stable pour proposer une séance.':'Aucune suggestion adaptée n’est disponible actuellement.'}</p>
    <CoachExplanationDetails {...coachV2Explanation(result!)}/></section>;
  const perspectives=(view.perspectives??[]).slice(1);
  return <section ref={cardRef} className="panel coach-v2-experimental" aria-label="Coach" data-testid="coach-v2-experimental">
    <h2>Suggestions du Coach</h2>
    <p className="training-coverage">Des idées pour les prochains jours :</p>
    <div className="coach-v2-card-list">
      <CoachSuggestionCard session={session} date={date} label="Prochaine séance conseillée" primary reasons={(view.freshExplanation??(occurrence?storedCoachV2Explanation(occurrence):coachV2Explanation(result!))).reasons} limitations={(view.freshExplanation??(occurrence?storedCoachV2Explanation(occurrence):coachV2Explanation(result!))).limitations} instructions={(!!session.optionalInstructions?.length||session.structure)&&<details><summary>Voir les consignes</summary>
        {!!session.optionalInstructions?.length&&<ul>{session.optionalInstructions.map(value=><li key={value}>{coachExplanationText(value)}</li>)}</ul>}
        {session.structure&&<ul>
          {session.structure.warmUp&&<li>Échauffement : {formatCoachDuration(session.structure.warmUp.durationSeconds)} — {session.structure.warmUp.instruction}</li>}
          {session.structure.efforts.map((block,index)=><li key={`effort-${index}`}>Effort : {block.repetitions&&`${block.repetitions} × `}{formatCoachDuration(block.durationSeconds)} — {block.instruction}</li>)}
          {session.structure.recoveries?.map((block,index)=><li key={`recovery-${index}`}>Récupération : {block.repetitions&&`${block.repetitions} × `}{formatCoachDuration(block.durationSeconds)} — {block.instruction}</li>)}
          {session.structure.coolDown&&<li>Retour au calme : {formatCoachDuration(session.structure.coolDown.durationSeconds)} — {session.structure.coolDown.instruction}</li>}
        </ul>}</details>}/>
      {perspectives.map(value=><CoachSuggestionCard key={value.date} session={value.session} date={value.date} label="Perspective susceptible d’évoluer" {...coachV2PerspectiveExplanation(value)}/>) }
    </div>
    {busy?<p role="status">Mémorisation de la suggestion…</p>:null}
    {presentationError&&<p role="alert">{presentationError} <button className="button button-secondary" onClick={()=>{setPresentationError('');setRetry(value=>value+1);}}>Réessayer</button></p>}
  </section>;
}
