import { useEffect, useMemo, useRef, useState } from 'react';
import type { OptionalSessionFeeling } from '../types/evolving-coach';
import { effortLabels, feelingFromFields } from '../core/analysis/session-feeling';
import { createFeelingRepository } from '../storage/session-feeling';
import { subscribeStorage } from '../storage/changes';
import { FeelingFields } from './FeelingFields';
import { useProfileDatabase } from '../storage/profile-context';
export function SessionFeeling({ id }: { id: string }) {
  const database = useProfileDatabase();
  const repository = useMemo(() => createFeelingRepository(database), [database]);
  const [saved, setSaved] = useState<OptionalSessionFeeling>();
  const [effort, setEffort] = useState(''), [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false), [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const expected = useRef<OptionalSessionFeeling>(undefined);
  const running = useRef(false);
  const generation = useRef(0);
  async function reload() {
    const current = ++generation.current;
    try {
      const session = await repository.get(id);
      if (current !== generation.current) return;
      if (!session) throw new Error('Cette sortie n’est plus disponible.');
      setSaved(session.feeling); setReady(true); setError('');
    } catch { if (current === generation.current) { setReady(false); setError('Le ressenti n’a pas pu être chargé.'); } }
  }
  useEffect(() => {
    void reload();
    const unsubscribe = subscribeStorage(['sessions', 'feelings'], () => { void reload(); }, database);
    return () => { generation.current++; unsubscribe(); };
  }, [id, database]);
  function edit() {
    expected.current = saved; setEffort(saved?.effort ?? ''); setComment(saved?.comment ?? '');
    setEditing(true); setError(''); setMessage('');
  }
  async function save() {
    if (running.current) return;
    running.current = true; setBusy(true); setError('');
    const current = ++generation.current;
    try {
      const result = await repository.save(id, feelingFromFields(effort, comment), expected.current);
      if (current === generation.current) { setSaved(result.feeling); setEditing(false); setMessage('Votre ressenti a été enregistré.'); }
    } catch (cause) { if (current === generation.current) setError(cause instanceof Error ? cause.message : 'L’enregistrement a échoué. Vos saisies sont conservées.'); }
    finally { running.current = false; setBusy(false); }
  }
  return <section className="panel settings-panel" aria-labelledby="feeling-title" data-testid="session-feeling">
    <h2 id="feeling-title">Votre ressenti</h2>
    <p>Facultatif : votre effort perçu, indépendant de l’intensité proposée par le Coach.</p>
    {!ready && !error && <p role="status">Chargement du ressenti…</p>}
    {ready && !editing && <>
      {saved?.effort && <p>{effortLabels[saved.effort]}</p>}
      {saved?.comment && <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{saved.comment}</p>}
      <button type="button" className="button" onClick={edit}>{saved ? 'Modifier le ressenti ou le commentaire' : 'Ajouter un ressenti ou un commentaire'}</button>
    </>}
    {editing && <form aria-label="Votre ressenti" onSubmit={e => { e.preventDefault(); void save(); }}>
      <fieldset disabled={busy} className="profile-fields"><legend>Votre annotation personnelle</legend>
        <FeelingFields effort={effort} comment={comment} onEffort={setEffort} onComment={setComment} />
        <p>Choisissez « Non renseigné » pour retirer l’effort perçu, ou videz le commentaire pour le supprimer.</p>
        <button className="button" type="submit">Enregistrer le ressenti</button>{' '}
        <button type="button" onClick={() => setEditing(false)}>Annuler</button>
      </fieldset>
    </form>}
    {error && <p role="alert">{error} <button type="button" disabled={busy} onClick={() => { setEditing(false); void reload(); }}>Recharger le ressenti</button></p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
