import { CoachDiagnostic } from './CoachDiagnostic';
import { coachExplanations, formatCoachDuration, formatCoachDurationText, originalPlanningWarnings } from './coach-planning-display';
import { proposalCopy } from '../core/coach/proposal-presentation';
import { subscribeStorage } from '../storage/changes';
import { useEffect, useRef, useState } from 'react';
import { createCoachPlanningRepository, PlanningConflictError } from '../storage/coach-planning';
import { createEvolvingCoachRepository } from '../storage/evolving-coach';
import { coachProfileRepository } from '../storage/coach-profile';
import type { CoachPlanning as Planning, PlannedSession, PlanningAction } from '../types/coach-planning';
import type { CoachProfile } from '../types/coach-profile';
import type { EvolvingCoachRecord } from '../types/evolving-coach';
import type { RunningSession } from '../types/session';
import type { CoachProposal, SessionSuggestion } from '../types/coach-proposal';
import { proposeNextSession } from '../core/coach/proposals';
import { productPolicy, COACH_POLICY_VERSION } from '../core/coach/product-policy';
import { canonicalJson, sha256 } from '../backup/format';
import { localToday } from '../core/analysis/statistics-period';
import { validSessionDate } from '../core/analysis/session-summary';
import { maximumMinutesForDay } from '../core/coach/profile';
import type { Weekday } from '../types/coach-profile';
const repository=createCoachPlanningRepository(), coachRepository=createEvolvingCoachRepository();
const dateLabel=(date:string)=>date.split('-').reverse().join('/');
const proposalDateLabel=(date:string)=>new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'});
const kindLabel=(kind:SessionSuggestion['kind'])=>kind==='discovery'?'Sortie de découverte':kind==='endurance'?'Sortie d’endurance':'Sortie facile';
const weekdays:Weekday[]=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
interface Loaded { planning?: Planning; profile?: CoachProfile; coach?: EvolvingCoachRecord; proposal: CoachProposal; key: string }
interface Draft { id?: string; date:string; minutes:string; note:string }
export function CoachPlanning({sessions,refreshToken=0}:{sessions:RunningSession[];refreshToken?:number}) {
  const [loaded,setLoaded]=useState<Loaded>(),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [attempt,setAttempt]=useState(0),[busy,setBusy]=useState(false),[draft,setDraft]=useState<Draft>();
  const [conflict,setConflict]=useState(false),[loading,setLoading]=useState(true),[today,setToday]=useState(localToday);
  const generation=useRef(0),writing=useRef(false);
  useEffect(()=>{const timer=window.setInterval(()=>setToday(localToday()),60000);return()=>window.clearInterval(timer);},[]);
  useEffect(()=>{
    const token=++generation.current;setLoading(true);setLoaded(undefined);setError('');setConflict(false);setDraft(undefined);
    Promise.all([repository.get(),coachRepository.get(),coachProfileRepository.get()]).then(async([planning,coach,profile])=>{
      const policy=productPolicy(coach?.configuration?.goal.kind ?? 'wellbeing');
      const proposal=proposeNextSession({sessions,referenceDate:today,configuration:coach?.configuration,historicalProfile:profile,policy});
      // Sans date d'aujourd'hui : un refus ne revient pas demain avec une simple date décalée.
      const key=await sha256(canonicalJson({policyVersion:COACH_POLICY_VERSION,configuration:coach?.configuration ?? null,availability:profile?.availability ?? null,preferences:profile?.preferences ?? null,sessions:sessions.map(s=>({id:s.id,date:s.date,durationSeconds:s.durationSeconds})).sort((a,b)=>a.id.localeCompare(b.id))}));
      if(token===generation.current){setLoaded({planning,coach,profile,proposal,key});setLoading(false);}
    }).catch(()=>{if(token===generation.current){setLoading(false);setError('Le planning n’a pas pu être chargé. Vos observations restent disponibles.');}});
    return()=>{generation.current++;};
  },[sessions,refreshToken,attempt,today]);
  useEffect(()=>{
    return subscribeStorage(['profile', 'configuration', 'planning'], ()=>{
      if(draft || writing.current){
        setConflict(true);setError('Vos choix ont changé dans un autre onglet. Vos saisies sont conservées ; rechargez le planning.');
        setLoaded(old=>old?{...old,proposal:{...old.proposal,suggestions:[]}}:old);
      } else setAttempt(a=>a+1);
    });
  },[draft]);
  const suggestion=loaded?.proposal.suggestions[0];
  const copy=proposalCopy(loaded?.proposal.goal??null);
  const handled=!!loaded && (!!loaded.planning?.dismissed.includes(loaded.key) || !!loaded.planning?.sessions.some(s=>s.proposalKey===loaded.key));
  async function act(action:PlanningAction) {
    if(!loaded || writing.current || conflict)return;
    writing.current=true;setBusy(true);setError('');const token=generation.current;
    try {const planning=await repository.apply(action,loaded.planning?.revision);
      if(token===generation.current){setLoaded({...loaded,planning});setDraft(undefined);setMessage(action.type==='dismiss'?'Proposition écartée. Aucune séance de remplacement n’est ajoutée.':action.type==='cancel'?'Séance annulée. Aucun rattrapage n’est prévu.':'Votre planning a été enregistré.');}
    }catch(e){if(token===generation.current){setConflict(e instanceof PlanningConflictError);setError(e instanceof Error?e.message:'Le planning n’a pas pu être enregistré.');}}
    finally{writing.current=false;setBusy(false);}
  }
  function accept(values?:Draft) {
    if(!loaded?.coach || !suggestion)return;
    const timestamp=new Date().toISOString();
    const session:PlannedSession={id:crypto.randomUUID(),proposalKey:loaded.key,date:values?.date??suggestion.date,durationSeconds:values?Math.round(Number(values.minutes)*60):suggestion.durationSeconds,
      note:values?.note??'',kind:suggestion.kind,intention:copy.objective,origin:'coach',status:'planned',createdAt:timestamp,updatedAt:timestamp,
      original:{date:suggestion.date,durationSeconds:suggestion.durationSeconds,explanation:[...suggestion.reasons,...suggestion.limitations,...suggestion.recommendedTerrain.reasons].join('\n'),policyVersion:COACH_POLICY_VERSION}};
    void act({type:'accept',session,coachRevision:loaded.coach.revision,profileRevision:loaded.profile?.revision});
  }
  const day=draft && validSessionDate(draft.date)?weekdays[new Date(`${draft.date}T12:00:00Z`).getUTCDay()]:undefined;
  const outside=day && !loaded?.profile?.availability.days?.includes(day);
  const cap=day && loaded?.profile ? loaded.profile.availability.durationMode==='custom'?maximumMinutesForDay(loaded.profile,day):loaded.profile.availability.minutesPerSession:undefined;
  return <section className="panel settings-panel coach-planning" aria-labelledby="coach-planning-title">
    <h2 id="coach-planning-title">Votre planning personnel</h2>
    {loading && <p role="status">Chargement du planning…</p>}
    {error && <p role="alert">{error}</p>}
    {(error || conflict) && <button className="button" disabled={busy} onClick={()=>setAttempt(a=>a+1)}>Recharger le planning</button>}
    {message && <p role="status">{message}</p>}
    {!loading && loaded && <>
      {!!loaded.planning?.sessions.length && <h3>Séances acceptées</h3>}
      {[...(loaded.planning?.sessions??[])].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).map(s=><article key={s.id} className="notice" aria-label={`Séance du ${dateLabel(s.date)}`}>
        <h4>{dateLabel(s.date)} — {kindLabel(s.kind)}</h4><p>{formatCoachDuration(s.durationSeconds)} maximum · {s.status==='cancelled'?'Annulée':s.date>today?'Planifiée — à venir':s.date===today?'Planifiée — aujourd’hui':'Date passée — réalisation non renseignée'}</p>
        <p>Proposition du Coach · {s.intention}</p>{s.note && <p>{s.note}</p>}
        <details><summary>Proposition initiale</summary><p>{dateLabel(s.original.date)} · {formatCoachDuration(s.original.durationSeconds)} maximum</p>{originalPlanningWarnings(s.original.explanation).map((warning,i)=><p key={i}>{warning}</p>)}</details>
        {s.status==='planned' && <div className="profile-actions"><button className="button" disabled={busy||conflict||!!draft} onClick={()=>setDraft({id:s.id,date:s.date,minutes:String(s.durationSeconds/60),note:s.note})}>Modifier cette séance</button><button className="button" disabled={busy||conflict} onClick={()=>void act({type:'cancel',id:s.id})}>Annuler cette séance</button></div>}
      </article>)}
      <h3>Proposition du Coach :</h3>
      {suggestion && !handled ? <><article className="notice coach-proposal-card">
        <h4>{kindLabel(suggestion.kind)} — {proposalDateLabel(suggestion.date)}</h4>
        <p>{formatCoachDuration(suggestion.durationSeconds)} · Allure tranquille · {suggestion.recommendedTerrain.label}</p>
        <p>{copy.objective}</p><p>{copy.instruction}</p>
        {loaded.proposal.limitations.filter(text=>text.startsWith('Échéance déclarée')).map(text=><p className="notice" key={text}>{text}</p>)}
        <details className="coach-explanations"><summary>Pourquoi cette séance ?</summary>{coachExplanations(loaded.proposal,suggestion,loaded.profile).map(item=><div className="coach-explanation" key={item.title}><h5>{item.title}</h5><p>{item.text}</p></div>)}</details>
        <div className="profile-actions">
          <button className="button" disabled={busy||conflict||!!draft} onClick={()=>accept()}>Accepter</button>
          {['Modifier','Déplacer'].map(label=><button key={label} className="button" disabled={busy||conflict||!!draft} onClick={()=>setDraft({date:suggestion.date,minutes:String(suggestion.durationSeconds/60),note:''})}>{label}</button>)}
          <button className="button" disabled={busy||conflict||!!draft} onClick={()=>void act({type:'dismiss',key:loaded.key,coachRevision:loaded.coach!.revision,profileRevision:loaded.profile?.revision})}>Refuser</button>
        </div>
      </article><p className="training-coverage coach-proposal-note">C’est une proposition : vous pouvez la modifier ou l’annuler. Nous tiendrons compte de vos prochaines sorties pour les propositions suivantes.</p></> : <p>{handled?'Cette proposition a déjà été traitée. Aucun remplacement automatique n’est ajouté.':formatCoachDurationText(loaded.proposal.reasons.concat(loaded.proposal.constraints).join(' ')) || 'Aucune proposition sur cet horizon.'}</p>}
      {import.meta.env.DEV && <CoachDiagnostic proposal={loaded.proposal} />}
      {draft && <form aria-label="Modifier la séance planifiée" onSubmit={e=>{e.preventDefault();if(draft.id)void act({type:'edit',id:draft.id,date:draft.date,durationSeconds:Math.round(Number(draft.minutes)*60),note:draft.note});else accept(draft);}}>
        <fieldset className="profile-fields" disabled={busy||conflict}><legend>{draft.id?'Modifier votre séance':'Adapter la proposition avant acceptation'}</legend>
          <div className="profile-grid">
            <label>Date prévue<input type="date" required value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}/></label>
            <label>Durée maximale (minutes)<input type="number" required min="1" max="1440" step="any" value={draft.minutes} onChange={e=>setDraft({...draft,minutes:e.target.value})}/></label>
            <label>Note personnelle<textarea maxLength={2000} value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})}/></label>
          </div>
          {outside && <p className="notice">Ce jour ne fait pas partie de vos disponibilités habituelles. Vous pouvez confirmer votre choix.</p>}
          {cap!==undefined && Number(draft.minutes)>cap && <p className="notice">Cette durée dépasse votre disponibilité habituelle. Vous pouvez confirmer votre choix personnel.</p>}
          <div className="profile-actions"><button className="button" type="submit">{draft.id?'Enregistrer la séance':'Accepter cette modification'}</button><button type="button" className="button" onClick={()=>setDraft(undefined)}>Annuler la modification</button></div>
        </fieldset>
      </form>}

    </>}
  </section>;
}
