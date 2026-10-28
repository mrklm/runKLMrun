import { useEffect,useMemo,useState } from 'react';
import type { RunningSession } from '../types/session';
import type { AssociationInspectionV2 } from '../storage/coach-suggestions-v2';
import { createSuggestionV2Repository } from '../storage/coach-suggestions-v2';
import { coachV2Labels } from './CoachV2Experimental';
import { coachV2Enabled } from '../core/coach/activation-v2';
import { formatCoachDuration } from './coach-duration-format';
import { instantIso,type PersistableOccurrenceV2 } from '../core/coach/persistence-foundations-v2';
import { subscribeStorage } from '../storage/changes';
import { matchingDate } from '../core/coach/suggestion-matching';
import { useProfileDatabase } from '../storage/profile-context';

type Candidate={occurrence:PersistableOccurrenceV2;inspection:AssociationInspectionV2};

export function CoachV2ActivityAssociation({session}:{session:RunningSession}) {
  const database=useProfileDatabase(),repository=useMemo(()=>createSuggestionV2Repository(database),[database]);
  const enabled=coachV2Enabled(),[candidates,setCandidates]=useState<Candidate[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState('');
  const refresh=async()=>{if(!enabled)return;try {
    const matches=(await repository.listAll()).filter(item=>item.state!=='obsolete'&&item.opportunity.suggestedFor===matchingDate(session));
    setCandidates(await Promise.all(matches.map(async occurrence=>({occurrence,inspection:await repository.inspectAssociation(occurrence.id)}))));setError('');
  }catch{setError('Les associations V2 expérimentales n’ont pas pu être chargées.');}};
  useEffect(()=>{if(!enabled)return;void refresh();return subscribeStorage(['suggestions-v2','sessions'],()=>void refresh(),database);},[database,enabled,repository,session.id,session.date]);
  if(!enabled||(!candidates.length&&!error))return null;
  const associate=async(candidate:Candidate)=>{setBusy(candidate.occurrence.id);setError('');try {await repository.associateActivity({occurrenceId:candidate.occurrence.id,
    expectedRevision:candidate.occurrence.revision,activityId:session.id,updatedAt:instantIso(new Date().toISOString())});await refresh();}
    catch{setError('L’association n’a pas pu être enregistrée. Les données ont peut-être changé.');}finally{setBusy('');}};
  return <section className="panel coach-v2-experimental" aria-labelledby="coach-v2-association-title" data-testid="coach-v2-association">
    <h2 id="coach-v2-association-title">Suggestion du Coach et activité</h2>
    {error&&<p role="alert">{error}</p>}
    {candidates.map(candidate=><div key={candidate.occurrence.id} className="coach-v2-association-candidate">
      <p><strong>{coachV2Labels.type[candidate.occurrence.content.type]}</strong> · {formatCoachDuration(candidate.occurrence.content.totalDurationSeconds)}</p>
      {candidate.inspection.status==='associated'&&candidate.inspection.activityId===session.id?<p role="status">Association confirmée avec cette activité.</p>:<>
        {candidate.inspection.status==='ambiguous'&&<p>Plusieurs activités existent à cette date. Vérifiez votre choix avant de confirmer.</p>}
        {candidate.inspection.status==='associated'?<p>Cette suggestion est déjà associée à une autre activité.</p>
          :<button className="button" disabled={!!busy} onClick={()=>void associate(candidate)}>{busy===candidate.occurrence.id?'Association…':'Associer explicitement à cette activité'}</button>}
      </>}
    </div>)}
  </section>;
}
