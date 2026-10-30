import { useId, useState } from 'react';
import { FeelingFields } from './FeelingFields';
import { coachV2Labels } from './coach-v2-display';
import { formatCoachDuration } from './coach-duration-format';
import { TRAINING_DESCRIPTION_LIMIT, type RealizationResult } from '../core/analysis/session-review';
import { availableReviewCandidate, type ReviewCandidate, type ReviewDraft } from './session-review-model';

export interface SessionReviewFormProps {
  saveLabel?: string;
  sessionId: string; draft: ReviewDraft; candidates: ReviewCandidate[]; selected: string;
  disabled: boolean; responseChanged: boolean;
  onChange: (patch: Partial<ReviewDraft>) => void;
  onSelect: (id: string) => void; onSave: () => void; onReset: () => void;
}
const answers: readonly [RealizationResult, string][] = [['completed', 'Oui'], ['partial', 'Partiellement'], ['not-completed', 'Non, autre entraînement']];
export function SessionReviewForm({ saveLabel = 'Enregistrer', sessionId, draft, candidates, selected, disabled, responseChanged, onChange, onSelect, onSave, onReset }: SessionReviewFormProps) {
  const id = useId(), [descriptionOpen, setDescriptionOpen] = useState(false);
  const candidate = candidates.find(item => item.occurrence.id === selected), occurrence = candidate?.occurrence;
  const obsolete = occurrence?.state === 'obsolete';
  const available = candidates.filter(item => availableReviewCandidate(item, sessionId));
  return <form aria-label="Bilan de votre séance" className="session-review-form" onSubmit={event => { event.preventDefault(); onSave(); }}>
    <fieldset className="profile-fields" disabled={disabled}>
      <legend>Votre ressenti</legend>
      <p>Facultatif : votre effort perçu et votre commentaire personnel.</p>
      <FeelingFields effort={draft.effort} comment={draft.comment} onEffort={effort => onChange({ effort })} onComment={comment => onChange({ comment })} />
      <p>Choisissez « Non renseigné » ou videz un champ pour effacer sa valeur.</p>
    </fieldset>
    {!!available.length && <fieldset className="profile-fields" disabled={disabled}>
      <legend>Recommandation du Coach</legend>
      {available.length > 1 && <>
        <p>Plusieurs recommandations correspondent à cette activité. Sélectionnez celle dont vous souhaitez renseigner le bilan.</p>
        <label className="review-select">Recommandation à renseigner
          <select value={selected} disabled={responseChanged} onChange={event => onSelect(event.target.value)}>
            <option value="">Choisir une recommandation</option>
            {available.map(({ occurrence: item }) => <option key={item.id} value={item.id}>{coachV2Labels.type[item.content.type]} · {formatCoachDuration(item.content.totalDurationSeconds)} · {item.presentation.presentedOn.split('-').reverse().join('/')} · n°{item.opportunity.generation}{item.state === 'obsolete' ? ' (obsolète)' : ''}{item.realization ? ' (réponse enregistrée)' : ''}</option>)}
          </select>
        </label>
        {responseChanged && <p>Enregistrez ou annulez votre réponse avant de changer de recommandation.</p>}
      </>}
      {occurrence && <>
        <p><strong>{coachV2Labels.type[occurrence.content.type]}</strong> · {formatCoachDuration(occurrence.content.totalDurationSeconds)}</p>
        <p>{occurrence.content.shortSummary}</p>
        {candidate.inspection.status === 'ambiguous' && !obsolete && <p>Plusieurs activités existent à cette date. Vérifiez que cette recommandation concerne bien votre séance.</p>}
        {occurrence.state === 'associated' && !occurrence.realization && <p>Cette activité est associée à la recommandation, sans confirmation de réalisation.</p>}
        {obsolete ? <>
          <p>Cette recommandation est obsolète. Vous ne pouvez pas enregistrer de nouvelle confirmation.</p>
          {occurrence.associationInvalidation && <p>L’association a été invalidée après une modification ou une suppression de l’activité. Aucune réalisation n’est confirmée.</p>}
          {occurrence.realization && <p>Réponse enregistrée : Non, autre entraînement.</p>}
        </> : <fieldset className="profile-fields review-answers">
          <legend>Avez-vous réalisé l'entraînement proposé par le Coach ?</legend>
          {answers.map(([value, label]) => <label key={value}><input type="radio" name={`${id}-realization`} value={value} checked={draft.result === value}
            onChange={() => onChange({ result: value, associateOnly: false })} />{label}</label>)}
        </fieldset>}
        {draft.result && <button type="button" onClick={() => onChange({ result: '', associateOnly: false })}>Effacer la réponse au Coach</button>}
        {!obsolete && !draft.result && !occurrence.realization && occurrence.state !== 'associated' && <details>
          <summary>Association sans confirmation</summary>
          <p>Vous pouvez conserver un lien avec cette recommandation sans déclarer sa réalisation.</p>
          <label className="review-check"><input type="checkbox" checked={draft.associateOnly} onChange={event => onChange({ associateOnly: event.target.checked })} />Associer sans confirmer la réalisation</label>
        </details>}
      </>}
    </fieldset>}
    {candidates.some(item => !availableReviewCandidate(item, sessionId)) && <p>Une recommandation de cette date est déjà associée à une autre activité et ne peut pas être sélectionnée.</p>}
    <fieldset className="profile-fields" disabled={disabled}>
      <legend>{draft.result === 'not-completed' ? 'Quel entraînement avez-vous réalisé ?' : 'Entraînement réellement effectué'}</legend>
      <p>Facultatif, sans déduction à partir de la recommandation.</p>
      <div className="profile-grid">
        <label>Type d’entraînement<select value={draft.trainingType} onChange={event => onChange({ trainingType: event.target.value as ReviewDraft['trainingType'] })}>
          <option value="">Non renseigné</option>
          {Object.entries(coachV2Labels.type).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          <option value="other">Autre entraînement…</option>
        </select></label>
        {(draft.trainingType === 'other' || !!draft.description || descriptionOpen) && <label>Précisez votre entraînement
          <textarea rows={3} maxLength={TRAINING_DESCRIPTION_LIMIT} value={draft.description} onChange={event => { setDescriptionOpen(true); onChange({ description: event.target.value }); }} />
          <small>Facultatif · {draft.description.length}/{TRAINING_DESCRIPTION_LIMIT} caractères</small>
        </label>}
      </div>
      {draft.trainingType !== 'other' && !draft.description && !descriptionOpen && <button type="button" onClick={() => setDescriptionOpen(true)}>Ajouter une précision (facultatif)</button>}
    </fieldset>
    <p>Vos modifications prennent effet après l’enregistrement.</p>
    <div className="review-actions">
      <button type="submit" className="button" disabled={disabled}>{disabled ? 'Veuillez patienter…' : saveLabel}</button>
      <button type="button" disabled={disabled} onClick={onReset}>Annuler les modifications</button>
    </div>
  </form>;
}
