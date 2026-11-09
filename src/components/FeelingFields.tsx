import { FEELING_COMMENT_LIMIT, RPE_INPUT_MIN, RPE_MAX, rpeText } from '../core/analysis/session-feeling';
const inputValues = Array.from({ length: RPE_MAX - RPE_INPUT_MIN + 1 }, (_, index) => RPE_INPUT_MIN + index);
export function FeelingFields({ effort, comment, onEffort, onComment }: { effort: string; comment: string; onEffort: (value: string) => void; onComment: (value: string) => void }) {
  return <div className="profile-grid">
    <label>Effort perçu (facultatif)<select value={effort} onChange={e => onEffort(e.target.value)}>
      <option value="">Non renseigné</option>
      {/* Une valeur déjà enregistrée hors saisie (0) reste affichée tant qu'elle n'est pas modifiée. */}
      {(effort !== '' && !inputValues.includes(Number(effort)) ? [Number(effort), ...inputValues] : inputValues).map(value => <option value={String(value)} key={value}>{rpeText(value)}</option>)}
    </select></label>
    <label>Commentaire personnel (facultatif)<textarea value={comment} maxLength={FEELING_COMMENT_LIMIT} rows={3} onChange={e => onComment(e.target.value)} />
      <small>{comment.length}/{FEELING_COMMENT_LIMIT} caractères</small>
    </label>
  </div>;
}
