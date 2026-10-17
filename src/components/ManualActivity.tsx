import { FeelingFields } from './FeelingFields';
import { feelingFromFields } from '../core/analysis/session-feeling';
import { useRef, useState, type FormEvent } from 'react';
import { sessionRepository } from '../storage/database';
import { validSessionDate } from '../core/analysis/session-summary';
import { localToday } from '../core/analysis/statistics-period';
import { sessionHref } from '../core/analysis/session-detail';

export function ManualActivity() {
  const [date,setDate]=useState(localToday), [minutes,setMinutes]=useState(''), [distance,setDistance]=useState('');
  const [error,setError]=useState(''), [saved,setSaved]=useState<string>(), [busy,setBusy]=useState(false);
  const [effort,setEffort]=useState(''), [comment,setComment]=useState('');
  const running=useRef(false);
  async function submit(event:FormEvent) {
    event.preventDefault(); if(running.current)return;
    const seconds=Math.round(Number(minutes)*60), meters=distance.trim()?Number(distance.replace(',','.'))*1000:undefined;
    if(!validSessionDate(date)||date>localToday()||!Number.isFinite(seconds)||seconds<=0||seconds>86400
      ||(meters!==undefined&&(!Number.isFinite(meters)||meters<0))) {setError('Renseignez une date passée ou actuelle, une durée positive de 24 heures maximum et une distance positive ou nulle.');return;}
    running.current=true;setBusy(true);setError('');setSaved(undefined);
    try {
      const feeling=feelingFromFields(effort,comment);
      const id=`manual:${crypto.randomUUID()}`;
      await sessionRepository.addImported({id,title:'Course à pied',sport:'RUNNING',date,durationSeconds:seconds,...(feeling?{feeling}:{}),...(meters===undefined?{}:{distanceMeters:meters})});
      setSaved(id);setMinutes('');setDistance('');setEffort('');setComment('');
    }catch{setError('La sortie n’a pas pu être enregistrée. Vos saisies sont conservées ; vous pouvez réessayer.');}
    finally{running.current=false;setBusy(false);}
  }
  return <details className="panel settings-panel"><summary>Ajouter une sortie manuellement</summary>
    <form aria-label="Ajouter une sortie manuellement" onSubmit={event=>void submit(event)}>
      <fieldset className="profile-fields" disabled={busy}><legend>Votre sortie de course à pied</legend>
        <div className="profile-grid">
          <label>Date de la sortie<input type="date" required max={localToday()} value={date} onChange={e=>setDate(e.target.value)} /></label>
          <label>Durée (minutes)<input type="number" required min="0.0167" max="1440" step="any" value={minutes} onChange={e=>setMinutes(e.target.value)} /></label>
          <label>Distance (km, facultative)<input type="text" inputMode="decimal" value={distance} onChange={e=>setDistance(e.target.value)} /></label>
        </div>
        <FeelingFields effort={effort} comment={comment} onEffort={setEffort} onComment={setComment} />
        <button className="button" type="submit">Enregistrer la sortie</button>
      </fieldset>
      {busy&&<p role="status">Enregistrement de votre sortie…</p>}
      {error&&<p role="alert">{error}</p>}
      {saved&&<p role="status">Sortie enregistrée. <a href={sessionHref(saved)}>Consulter la sortie</a></p>}
    </form>
  </details>;
}
