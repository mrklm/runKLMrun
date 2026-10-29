import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { RunnerProfile } from '../types/runner-profile';
import { createRunnerProfile, deleteRunnerProfileDatabase, isProfileActive, markRunnerProfileDeleting, profileRevision, readProfileRegistry, RunnerProfileConflictError, subscribeProfileRegistry, updateRunnerProfile } from '../storage/profile-registry';
import { useActiveProfileController } from '../storage/profile-context';
import { acquireOperation, useOperationBusy } from './operation-guard';
import { ProfileDeletionDialog } from './ProfileDeletionDialog';

type Draft={name:string;birthDate:string;height:string;weight:string};
const draft=(profile?:RunnerProfile):Draft=>({name:profile?.displayName??'',birthDate:profile?.birthDate??'',height:profile?.heightCm?.toString()??'',weight:profile?.weightKg?.toString()??''});
function validate(value:Draft){const errors:string[]=[];if(!value.name.trim())errors.push('Le pseudonyme est obligatoire.');if(value.birthDate&&value.birthDate>new Date().toISOString().slice(0,10))errors.push('La date de naissance ne peut pas être dans le futur.');for(const [label,input,max] of [['La taille',value.height,300],['Le poids',value.weight,500]] as const)if(input&&(!Number.isFinite(Number(input))||Number(input)<=0||Number(input)>max))errors.push(`${label} doit être une valeur positive plausible.`);return errors;}
const values=(value:Draft)=>({displayName:value.name.trim(),...(value.birthDate?{birthDate:value.birthDate}:{}),...(value.height?{heightCm:Number(value.height)}:{}),...(value.weight?{weightKg:Number(value.weight)}:{})});
const sameDraft=(left:Draft,right:Draft)=>left.name===right.name&&left.birthDate===right.birthDate&&left.height===right.height&&left.weight===right.weight;

export function RunnerProfiles(){
 const {profile:active,selectActiveProfile}=useActiveProfileController(),operationBusy=useOperationBusy();
 const [profiles,setProfiles]=useState<RunnerProfile[]>([]),[editing,setEditing]=useState<RunnerProfile>(),[creating,setCreating]=useState(false),[created,setCreated]=useState<RunnerProfile>(),[form,setForm]=useState<Draft>(draft()),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[externalChange,setExternalChange]=useState(false),[profileToEdit,setProfileToEdit]=useState(active.id),[profileToDelete,setProfileToDelete]=useState(active.id),[deletionTarget,setDeletionTarget]=useState<RunnerProfile>(),[deleting,setDeleting]=useState<RunnerProfile>(),[blocked,setBlocked]=useState(false),deleteButton=useRef<HTMLButtonElement>(null);
 const reload=()=>void readProfileRegistry().then(state=>setProfiles(state?.profiles??[]),()=>setError('Les profils n’ont pas pu être chargés.'));
 useEffect(()=>{reload();return subscribeProfileRegistry(reload);},[]);
 const availableProfiles=profiles.filter(isProfileActive);
 useEffect(()=>{setProfileToEdit(current=>availableProfiles.some(profile=>profile.id===current)?current:active.id);setProfileToDelete(current=>availableProfiles.some(profile=>profile.id===current)?current:active.id);},[active.id,availableProfiles]);
 useEffect(()=>{if(!editing)return;const latest=profiles.find(profile=>profile.id===editing.id);if(!latest||profileRevision(latest)!==profileRevision(editing))setExternalChange(true);},[profiles,editing]);
 const change=(key:keyof Draft,value:string)=>setForm(current=>({...current,[key]:value}));
 async function reloadEditedProfile(){if(!editing||busy||operationBusy)return;const state=await readProfileRegistry();const latest=state?.profiles.find(profile=>profile.id===editing.id);if(!latest){setError('Ce profil n’existe plus.');return;}if(!sameDraft(form,draft(editing))&&!window.confirm('Recharger le profil remplacera vos modifications en cours. Continuer ?'))return;setEditing(latest);setForm(draft(latest));setExternalChange(false);setError('');}
 async function save(event:FormEvent){event.preventDefault();if(busy||operationBusy)return;const issues=validate(form);if(issues.length){setError(issues.join(' '));return;}setBusy(true);setError('');try{const saved=editing?await updateRunnerProfile(editing.id,values(form),profileRevision(editing)):await createRunnerProfile(values(form));setMessage(editing?'Profil modifié.':'Profil créé.');setCreated(editing?undefined:saved);setEditing(undefined);setCreating(false);setExternalChange(false);setForm(draft());if(!editing)setProfiles(current=>[...current,saved]);}catch(cause){if(cause instanceof RunnerProfileConflictError)setExternalChange(true);setError(cause instanceof RunnerProfileConflictError?cause.message:'Le profil n’a pas pu être enregistré. Vos saisies sont conservées.');}finally{setBusy(false);}}
 const deletingProfile=profiles.find(profile=>!isProfileActive(profile))??deleting,controlsDisabled=busy||operationBusy||creating||!!editing||!!deletingProfile,selectedProfile=availableProfiles.find(profile=>profile.id===profileToEdit),selectedDeletionProfile=availableProfiles.find(profile=>profile.id===profileToDelete);
 const edit=()=>{if(!selectedProfile||controlsDisabled)return;setEditing(selectedProfile);setCreating(false);setExternalChange(false);setForm(draft(selectedProfile));setError('');};
 const closeDeletionDialog=useCallback(()=>{setDeletionTarget(undefined);deleteButton.current?.focus();},[]);
 const confirmDeletion=async(destinationProfileId:string)=>{
  const target=deletionTarget;if(!target)return;const release=acquireOperation();if(!release)return;
  setDeletionTarget(undefined);setDeleting(target);setBlocked(false);setError('');
  try {
   const state=await readProfileRegistry();if(!state)throw new Error('Les profils n’ont pas pu être chargés.');
   const current=state.profiles.find(profile=>profile.id===target.id),destination=state.profiles.find(profile=>profile.id===destinationProfileId);
   if(!current||!destination||!isProfileActive(current)||!isProfileActive(destination)||state.profiles.filter(isProfileActive).length<2)throw new Error('La suppression du profil n’est plus possible.');
   const marked=await markRunnerProfileDeleting(current.id,destination.id,profileRevision(current));
   await deleteRunnerProfileDatabase(marked.id,marked.deletion!.operationId,()=>setBlocked(true));
   setMessage(`Profil ${target.displayName} supprimé.`);setProfileToDelete(destination.id);
  } catch(cause) { setError(cause instanceof Error?cause.message:'Le profil n’a pas pu être supprimé.'); }
  finally { setDeleting(undefined);setBlocked(false);release(); }
 };
 const canDelete=!controlsDisabled&&availableProfiles.length>1&&!!selectedDeletionProfile;
 return <section aria-labelledby="runner-profiles-title"><details className="panel settings-panel runner-profiles"><summary id="runner-profiles-title">Profils</summary>
  <div className="runner-profile-actions">
   <button className="button" type="button" disabled={controlsDisabled} onClick={()=>{setCreating(true);setEditing(undefined);setExternalChange(false);setForm(draft());setMessage('');}}>Créer</button>
   <div className="runner-profile-action"><button className="button" type="button" disabled={controlsDisabled||!selectedProfile} onClick={edit}>Modifier</button><select aria-label="Profil à modifier" value={profileToEdit} disabled={controlsDisabled} onChange={event=>setProfileToEdit(event.currentTarget.value)}>{availableProfiles.map(profile=><option key={profile.id} value={profile.id}>{profile.displayName}</option>)}</select></div>
   <div className="runner-profile-action"><button ref={deleteButton} className="button" type="button" disabled={!canDelete} onClick={()=>selectedDeletionProfile&&setDeletionTarget(selectedDeletionProfile)}>Supprimer</button><select aria-label="Profil à supprimer" value={profileToDelete} disabled={controlsDisabled} onChange={event=>setProfileToDelete(event.currentTarget.value)}>{availableProfiles.map(profile=><option key={profile.id} value={profile.id}>{profile.displayName}</option>)}</select></div>
  </div>
  {deletingProfile&&<p role={blocked?'alert':'status'}>{blocked?`La suppression de ${deletingProfile.displayName} attend la fermeture d’un autre onglet.`:`Suppression de ${deletingProfile.displayName} en cours. Fermez les autres onglets qui pourraient encore utiliser ce profil.`}</p>}
  {(creating||editing)&&<form onSubmit={save}><fieldset className="profile-fields" disabled={busy||operationBusy}><legend>{editing?'Modifier le profil':'Nouveau profil'}</legend><div className="profile-grid"><label>Pseudonyme<input required value={form.name} onChange={e=>change('name',e.target.value)}/></label><label>Date de naissance<input type="date" value={form.birthDate} onChange={e=>change('birthDate',e.target.value)}/></label><label>Taille (cm)<input type="number" min="1" max="300" value={form.height} onChange={e=>change('height',e.target.value)}/></label><label>Poids (kg)<input type="number" min="1" max="500" step="any" value={form.weight} onChange={e=>change('weight',e.target.value)}/></label></div><button className="button" type="submit">{busy?'Enregistrement…':'Enregistrer'}</button><button type="button" onClick={()=>{setCreating(false);setEditing(undefined);setExternalChange(false);setError('');}}>Annuler</button></fieldset></form>}
  {externalChange&&editing&&<p role="alert">Ce profil a été modifié dans un autre onglet. Tes modifications en cours sont conservées. Recharge les informations pour travailler sur la dernière version. <button type="button" disabled={busy||operationBusy} onClick={()=>void reloadEditedProfile()}>Recharger le profil</button></p>}
  {created&&<p role="status">Profil créé. <button className="button" disabled={operationBusy} onClick={()=>void selectActiveProfile(created.id).then(()=>{setCreated(undefined);setMessage('Profil actif modifié.');},()=>setError('Le nouveau profil n’a pas pu être sélectionné.'))}>Utiliser ce profil</button></p>}
  {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
  <ProfileDeletionDialog profiles={profiles} target={deletionTarget} busy={!!deleting} onCancel={closeDeletionDialog} onConfirm={destination=>void confirmDeletion(destination)}/>
 </details></section>;
}
