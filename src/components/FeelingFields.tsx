import { effortLabels, FEELING_COMMENT_LIMIT } from '../core/analysis/session-feeling';
export function FeelingFields({ effort, comment, onEffort, onComment }: { effort: string; comment: string; onEffort: (value: string) => void; onComment: (value: string) => void }) {
  return <div className="profile-grid">
    <label>Effort perçu (facultatif)<select value={effort} onChange={e => onEffort(e.target.value)}>
      <option value="">Non renseigné</option>
      {Object.entries(effortLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
    </select></label>
    <label>Commentaire personnel (facultatif)<textarea value={comment} maxLength={FEELING_COMMENT_LIMIT} rows={3} onChange={e => onComment(e.target.value)} />
      <small>{comment.length}/{FEELING_COMMENT_LIMIT} caractères</small>
    </label>
  </div>;
}
