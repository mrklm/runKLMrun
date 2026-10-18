import { PastSuggestions } from './PastSuggestions';
import { CoachObservations } from './CoachObservations';
import { compareTraining } from '../core/coach/comparison';
import type { ReactNode } from 'react';
import { CoachSuggestions } from './CoachSuggestions';
import { CoachDiagnostic } from './CoachDiagnostic';
import { formatCoachDuration, originalPlanningWarnings } from './coach-planning-display';
import { subscribeStorage } from '../storage/changes';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createCoachPlanningRepository, PlanningConflictError } from '../storage/coach-planning';
import { createEvolvingCoachRepository } from '../storage/evolving-coach';
import { coachProfileRepository } from '../storage/coach-profile';
import type { CoachPlanning as Planning, PlanningAction } from '../types/coach-planning';
import type { CoachProfile } from '../types/coach-profile';
import type { EvolvingCoachRecord } from '../types/evolving-coach';
import type { RunningSession } from '../types/session';
import type { SessionSuggestion } from '../types/coach-proposal';
import { proposeSuggestions, type SuggestionSet } from '../core/coach/proposals';
import { productPolicy } from '../core/coach/product-policy';
import { localToday } from '../core/analysis/statistics-period';
import { validSessionDate } from '../core/analysis/session-summary';
import { maximumMinutesForDay } from '../core/coach/profile';
import type { Weekday } from '../types/coach-profile';
const repository=createCoachPlanningRepository(), coachRepository=createEvolvingCoachRepository();
const dateLabel=(date:string)=>date.split('-').reverse().join('/');
const kindLabel=(kind:SessionSuggestion['kind'])=>kind==='discovery'?'Sortie de découverte':kind==='endurance'?'Sortie d’endurance':'Sortie facile';
const weekdays:Weekday[]=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
interface Loaded { planning?: Planning; profile?: CoachProfile; coach?: EvolvingCoachRecord; proposal: SuggestionSet }
interface Draft { id: string; date:string; minutes:string; note:string }
export function CoachPlanning({sessions,refreshToken=0,dashboard=false,children}:{sessions:RunningSession[];refreshToken?:number;dashboard?:boolean;children?:ReactNode}) {
  const [loaded,setLoaded]=useState<Loaded>(),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [attempt,setAttempt]=useState(0),[busy,setBusy]=useState(false),[draft,setDraft]=useState<Draft>();
  const [conflict,setConflict]=useState(false),[loading,setLoading]=useState(true),[today,setToday]=useState(localToday);
  const generation=useRef(0),writing=useRef(false);
  useEffect(()=>{const timer=window.setInterval(()=>setToday(localToday()),60000);return()=>window.clearInterval(timer);},[]);
  useEffect(()=>{
    const token=++generation.current;setLoading(true);setLoaded(undefined);setError('');setConflict(false);setDraft(undefined);
    Promise.all([repository.get(),coachRepository.get(),coachProfileRepository.get()]).then(async([planning,coach,profile])=>{
      const policy=productPolicy(coach?.configuration?.goal.kind ?? 'wellbeing');
      const proposal=proposeSuggestions({sessions,referenceDate:today,configuration:coach?.configuration,historicalProfile:profile,policy},planning);
      if(token===generation.current){setLoaded({planning,coach,profile,proposal});setLoading(false);}
    }).catch(()=>{if(token===generation.current){setLoading(false);setError(dashboard ? 'Le Coach n’a pas pu être chargé. Vos activités restent disponibles.' : 'Le planning n’a pas pu être chargé. Vos observations restent disponibles.');}});
    return()=>{generation.current++;};
  },[sessions,refreshToken,attempt,today,dashboard]);
  useEffect(()=>{
    return subscribeStorage(['profile', 'configuration', 'planning'], ()=>{
      if(draft || writing.current){
        setConflict(true);setError('Vos choix ont changé dans un autre onglet. Vos saisies sont conservées ; rechargez le planning.');
        setLoaded(old=>old?{...old,proposal:{...old.proposal,suggestions:[]}}:old);
      } else setAttempt(a=>a+1);
    });
  },[draft]);
  const presentationContext=useMemo(()=>({sessions,profile:loaded?.profile,coach:loaded?.coach,planning:loaded?.planning}),[sessions,loaded]);
  async function act(action:PlanningAction) {
    if(!loaded || writing.current || conflict)return;
    writing.current=true;setBusy(true);setError('');const token=generation.current;
    try {const planning=await repository.apply(action,loaded.planning?.revision);
      if(token===generation.current){setLoaded({...loaded,planning});setDraft(undefined);setAttempt(value=>value+1);setMessage(action.type==='cancel'?'Séance annulée. Aucun rattrapage n’est prévu.':'Votre planning a été enregistré.');}
    }catch(e){if(token===generation.current){setConflict(e instanceof PlanningConflictError);setError(e instanceof Error?e.message:'Le planning n’a pas pu être enregistré.');}}
    finally{writing.current=false;setBusy(false);}
  }
  const day=draft && validSessionDate(draft.date)?weekdays[new Date(`${draft.date}T12:00:00Z`).getUTCDay()]:undefined;
  const outside=day && !loaded?.profile?.availability.days?.includes(day);
  const cap=day && loaded?.profile ? loaded.profile.availability.durationMode==='custom'?maximumMinutesForDay(loaded.profile,day):loaded.profile.availability.minutesPerSession:undefined;
  return <div className="coach-planning">
    {loading && <p role="status">{dashboard ? 'Chargement du Coach…' : 'Chargement du planning…'}</p>}
    {error && <p role="alert">{error}</p>}
    {(error || conflict) && <button className="button" disabled={busy} onClick={()=>setAttempt(a=>a+1)}>Recharger le planning</button>}
    {message && <p role="status">{message}</p>}
    {!loading && loaded && <>
      <CoachSuggestions proposal={loaded.proposal} context={presentationContext} emptyMessage={dashboard && !loaded.coach?.configuration ? "Vous pouvez configurer le Coach pour recevoir des suggestions adaptées à vos disponibilités." : undefined}/>
      {!dashboard && !!loaded.planning?.sessions.length && <section className="panel settings-panel" aria-labelledby="coach-planning-title">
      <h2 id="coach-planning-title">Ancien planning personnel</h2>
      <p className="training-coverage">Séances acceptées auparavant, distinctes des suggestions libres.</p>
      {[...(loaded.planning?.sessions??[])].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).map(s=><article key={s.id} className="notice" aria-label={`Séance du ${dateLabel(s.date)}`}>
        <h4>{dateLabel(s.date)} — {kindLabel(s.kind)}</h4><p>{formatCoachDuration(s.durationSeconds)} maximum · {s.status==='cancelled'?'Annulée':s.date>today?'Planifiée — à venir':s.date===today?'Planifiée — aujourd’hui':'Date passée — réalisation non renseignée'}</p>
        <p>Proposition du Coach · {s.intention}</p>{s.note && <p>{s.note}</p>}
        <details><summary>Proposition initiale</summary><p>{dateLabel(s.original.date)} · {formatCoachDuration(s.original.durationSeconds)} maximum</p>{originalPlanningWarnings(s.original.explanation).map((warning,i)=><p key={i}>{warning}</p>)}</details>
        {s.status==='planned' && <div className="profile-actions"><button className="button" disabled={busy||conflict||!!draft} onClick={()=>setDraft({id:s.id,date:s.date,minutes:String(s.durationSeconds/60),note:s.note})}>Modifier cette séance</button><button className="button" disabled={busy||conflict} onClick={()=>void act({type:'cancel',id:s.id})}>Annuler cette séance</button></div>}
      </article>)}
      {draft && <form aria-label="Modifier la séance planifiée" onSubmit={e=>{e.preventDefault();void act({type:'edit',id:draft.id,date:draft.date,durationSeconds:Math.round(Number(draft.minutes)*60),note:draft.note});}}>
        <fieldset className="profile-fields" disabled={busy||conflict}><legend>Modifier votre séance</legend>
          <div className="profile-grid">
            <label>Date prévue<input type="date" required value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}/></label>
            <label>Durée maximale (minutes)<input type="number" required min="1" max="1440" step="any" value={draft.minutes} onChange={e=>setDraft({...draft,minutes:e.target.value})}/></label>
            <label>Note personnelle<textarea maxLength={2000} value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})}/></label>
          </div>
          {outside && <p className="notice">Ce jour ne fait pas partie de vos disponibilités habituelles. Vous pouvez confirmer votre choix.</p>}
          {cap!==undefined && Number(draft.minutes)>cap && <p className="notice">Cette durée dépasse votre disponibilité habituelle. Vous pouvez confirmer votre choix personnel.</p>}
          <div className="profile-actions"><button className="button" type="submit">Enregistrer la séance</button><button type="button" className="button" onClick={()=>setDraft(undefined)}>Annuler la modification</button></div>
        </fieldset>
      </form>}
      </section>}
      {!dashboard && import.meta.env.DEV && <CoachDiagnostic proposal={loaded.proposal} />}
    </>}
    {dashboard && <>
      <PastSuggestions />
      {children}
      {!loading && loaded && <CoachObservations comparison={compareTraining(sessions,8,today)} profile={loaded.profile} collapsible />}
      <p><a href="#/entrainement">Coach</a> — configuration et ancien planning personnel</p>
    </>}
  </div>;
}
