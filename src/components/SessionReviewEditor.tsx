import { useEffect, useId } from 'react';
import type { RunningSession } from '../types/session';
import { duration, measure } from '../core/analysis/session-format';
import { SessionReviewForm } from './SessionReviewForm';
import { useSessionReview } from './use-session-review';

export interface ReviewEditorState { unsaved: boolean; saving: boolean }
interface ReviewEditorProps {
  database: string; session: RunningSession; showActivitySummary?: boolean; showTitle?: boolean; saveLabel?: string;
  onSaved?: () => void;
  onStateChange?: (id: string, state: ReviewEditorState) => void;
}

/** Aucun couplage à la navigation ; base et activité fournies par le contexte appelant. */
export function SessionReviewEditor(props: ReviewEditorProps) {
  return <ReviewEditor key={`${props.database}:${props.session.id}`} {...props} />;
}
function ReviewEditor({ database, session, showActivitySummary = true, showTitle = true, saveLabel, onSaved, onStateChange }: ReviewEditorProps) {
  const titleId = useId(), review = useSessionReview(database, session.id);
  useEffect(() => { onStateChange?.(session.id, { unsaved: review.unsaved, saving: review.saving }); }, [session.id, review.unsaved, review.saving, onStateChange]);
  const current = review.loaded?.snapshot.session ?? session;
  return <section className="panel settings-panel session-review" aria-labelledby={titleId} data-testid="session-review" aria-busy={review.loading || review.saving}>
    <h2 id={titleId} className={showTitle ? undefined : 'sr-only'}>Bilan de votre séance</h2>
    {showActivitySummary && <p>{current.date.split('-').reverse().join('/')} · {duration(current.durationSeconds)}{current.distanceMeters !== undefined && ` · ${measure(current.distanceMeters, 'km', 1000)}`}{current.sport && ` · ${current.sport}`}</p>}
    <p role="status">{review.saving ? 'Enregistrement du bilan…' : review.loading ? 'Chargement du bilan…' : review.changed ? 'Les informations ont changé, peut-être dans un autre onglet. Vos saisies sont conservées. Rechargez le bilan pour consulter les données actuelles.' : review.message}</p>
    {review.loaded && review.draft && <SessionReviewForm saveLabel={saveLabel} sessionId={session.id} draft={review.draft} candidates={review.loaded.candidates}
      selected={review.selected} disabled={review.loading || review.saving} responseChanged={review.responseChanged}
      onChange={review.update} onSelect={review.select} onSave={() => { void review.save().then(saved => { if (saved) onSaved?.(); }); }} onReset={review.reload} />}
    {review.error && <p role="alert">{review.error}</p>}
    {(review.error || review.changed) && <><p>Le rechargement remplacera vos saisies non enregistrées.</p><button type="button" disabled={review.saving || review.loading} onClick={review.reload}>Recharger le bilan</button></>}
  </section>;
}
