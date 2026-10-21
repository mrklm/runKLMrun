import { useEffect,useRef,useState } from 'react';
import { documentedActivityTypeLabels,type DocumentedActivityType } from '../types/session';
import { createTrainingTypeRepository } from '../storage/session-training-type';
import { subscribeStorage } from '../storage/changes';

const repository=createTrainingTypeRepository();
export function SessionTrainingType({id}:{id:string}) {
  const [saved,setSaved]=useState<DocumentedActivityType|undefined>(undefined),[value,setValue]=useState(''),[editing,setEditing]=useState(false),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const expected=useRef<DocumentedActivityType|undefined>(undefined),generation=useRef(0);
  async function reload(){const current=++generation.current;try{const session=await repository.get(id);if(current!==generation.current)return;if(!session)throw new Error();setSaved(session.trainingType);setReady(true);setError('');}catch{if(current===generation.current){setReady(false);setError('Le type d’entraînement n’a pas pu être chargé.');}}}
  useEffect(()=>{void reload();const unsubscribe=subscribeStorage(['sessions'],()=>void reload());return()=>{generation.current++;unsubscribe();};},[id]);
  function edit(){expected.current=saved;setValue(saved??'');setEditing(true);setError('');setMessage('');}
  async function save(){setBusy(true);setError('');const current=++generation.current;try{const result=await repository.save(id,value===''?undefined:value as DocumentedActivityType,expected.current);if(current===generation.current){setSaved(result.trainingType);setEditing(false);setMessage('Type d’entraînement enregistré.');}}catch(cause){if(current===generation.current)setError(cause instanceof Error?cause.message:'Enregistrement impossible.');}finally{setBusy(false);}}
  return <section className="panel settings-panel" aria-labelledby="training-type-title"><h2 id="training-type-title">Type d’entraînement</h2>
    <p>Facultatif : déclaration personnelle, sans déduction à partir des mesures ou suggestions.</p>
    {!ready&&!error&&<p role="status">Chargement du type d’entraînement…</p>}
    {ready&&!editing&&<><p>{saved?documentedActivityTypeLabels[saved]:'Non renseigné'}</p><button type="button" className="button" onClick={edit}>{saved?'Modifier le type d’entraînement':'Ajouter un type d’entraînement'}</button></>}
    {editing&&<form aria-label="Type d’entraînement" onSubmit={event=>{event.preventDefault();void save();}}><fieldset className="profile-fields" disabled={busy}><label>Type d’entraînement<select value={value} onChange={event=>setValue(event.target.value)}><option value="">Non renseigné</option>{Object.entries(documentedActivityTypeLabels).map(([type,label])=><option value={type} key={type}>{label}</option>)}</select></label><button className="button" type="submit">Enregistrer le type</button>{' '}<button type="button" onClick={()=>setEditing(false)}>Annuler</button></fieldset></form>}
    {error&&<p role="alert">{error} <button type="button" disabled={busy} onClick={()=>{setEditing(false);void reload();}}>Recharger</button></p>}{message&&<p role="status">{message}</p>}
  </section>;
}
