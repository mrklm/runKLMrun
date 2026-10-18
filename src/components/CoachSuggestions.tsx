import { useEffect, useRef, useState } from 'react';
import type { SuggestionSet } from '../core/coach/proposals';
import type { PresentationContext } from '../storage/coach-suggestions';
import { createSuggestionRepository, SuggestionPresentationCancelled } from '../storage/coach-suggestions';
import { watchSuggestionPresentation } from './suggestion-presentation';
import { formatCoachDuration, formatCoachDurationText } from './coach-planning-display';
const repository = createSuggestionRepository();
const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'});
const kindLabel = (kind: string) => kind === 'discovery' ? 'Sortie de découverte' : kind === 'endurance' ? 'Sortie d’endurance' : 'Sortie facile';
export function CoachSuggestions({proposal,context,emptyMessage}:{proposal:SuggestionSet;context:PresentationContext;emptyMessage?:string}) {
  const cards = useRef(new Map<string,HTMLElement>());
  const [error,setError] = useState(''),[attempt,setAttempt] = useState(0);
  useEffect(()=>{
    let active = true;
    setError('');
    const members = proposal.suggestions.map(s=>({date:s.date,kind:s.kind,durationSeconds:s.durationSeconds,
      terrain:{surface:s.recommendedTerrain.surface,relief:s.recommendedTerrain.relief}}));
    const stops = proposal.suggestions.flatMap((suggestion,index)=>{
      const card = cards.current.get(suggestion.id);
      if (!card) return [];
      return [watchSuggestionPresentation(card,isVisible=>{
        void repository.recordPresentedSetMember(members[index],members,{context,isVisible:()=>active && isVisible()}).catch(error=>{
          if (active && !(error instanceof SuggestionPresentationCancelled)) setError('Certaines suggestions n’ont pas pu être mémorisées. Vous pouvez réessayer.');
        });
      })];
    });
    return ()=>{active=false;stops.forEach(stop=>stop());};
  },[proposal,context,attempt]);
  return <section className="panel settings-panel coach-suggestions" aria-labelledby="coach-suggestions-title">
    <h2 id="coach-suggestions-title">Suggestions du Coach</h2>
    {proposal.suggestions.length > 0 ? <>
      <p className="training-coverage">Des idées pour les prochains jours, à suivre, adapter ou ignorer librement. Vous n’avez rien à confirmer.</p>
      <div className="coach-suggestion-list">
        {proposal.suggestions.map(s=><article key={s.id} data-suggestion-id={s.id} ref={element=>{if(element)cards.current.set(s.id,element);else cards.current.delete(s.id);}} className="notice coach-proposal-card" aria-label={`${kindLabel(s.kind)} — ${dateLabel(s.date)}`}>
          <h4>{kindLabel(s.kind)} — {dateLabel(s.date)}</h4>
          <p>{formatCoachDuration(s.durationSeconds)} · Allure tranquille{s.recommendedTerrain.surface !== 'none' || s.recommendedTerrain.relief !== 'free' ? ` · ${s.recommendedTerrain.label}` : ''}</p>
          <p>{formatCoachDurationText(s.explanation)}</p>
        </article>)}
      </div>
      {proposal.limitations.filter(text=>text.startsWith('Échéance déclarée')).map(text=><p className="training-coverage" key={text}>{text}</p>)}
    </> : <p>{emptyMessage || formatCoachDurationText(proposal.constraints.join(' ') || proposal.reasons.join(' ')) || 'Aucune suggestion dans les sept prochains jours avec les données et disponibilités actuelles.'}</p>}
    {error && <><p role="alert">{error}</p><button className="button" onClick={()=>setAttempt(value=>value+1)}>Réessayer la mémorisation</button></>}
  </section>;
}
