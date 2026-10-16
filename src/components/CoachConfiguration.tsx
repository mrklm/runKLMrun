import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createEvolvingCoachRepository } from '../storage/evolving-coach';
import type { EvolvingCoachRepository } from '../storage/contracts';
import type { EvolvingCoachRecord } from '../types/evolving-coach';
import { ProfileConflictError } from '../storage/coach-profile';
import { configurationDraft, configurationValues, COACH_GOALS, EXPERIENCES, type ConfigurationDraft } from '../core/coach/configuration-draft';
const repositoryDefault = createEvolvingCoachRepository();
export function CoachConfiguration({ repository = repositoryDefault, onChange }: { repository?: EvolvingCoachRepository; onChange?: () => void }) {
  const [record, setRecord] = useState<EvolvingCoachRecord>();
  const [draft, setDraft] = useState(() => configurationDraft());
  const [phase, setPhase] = useState<'loading' | 'ready' | 'editing' | 'saving' | 'error'>('loading');
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false), [attempt, setAttempt] = useState(0);
  const generation = useRef(0), busy = useRef(false), alert = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const token = ++generation.current; setPhase('loading'); setError(''); setMessage(''); setConflict(false);
    repository.get().then(value => {
      if (token !== generation.current) return;
      setRecord(value); setDraft(configurationDraft(value?.configuration)); setPhase('ready');
    }, () => { if (token === generation.current) { setPhase('error'); setError('Votre configuration n’a pas pu être lue. Vos observations restent consultables.'); } });
    return () => { generation.current++; };
  }, [repository, attempt]);
  useEffect(() => { if (error) alert.current?.focus(); }, [error]);
  const change = <K extends keyof ConfigurationDraft>(key: K, value: ConfigurationDraft[K]) => setDraft(old => ({ ...old, [key]: value }));
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current) return;
    setError(''); setMessage('');
    let values;
    try {
      if (event.currentTarget.querySelector<HTMLInputElement>('input[type="date"]')?.validity.badInput) throw new Error('Saisissez une date complète et valide.');
      values = configurationValues(draft);
    } catch (e) { setError(e instanceof Error ? e.message : 'Vérifiez vos choix.'); return; }
    busy.current = true; setPhase('saving'); const token = ++generation.current;
    try {
      const saved = await repository.save(values, record?.revision);
      if (token !== generation.current) return;
      onChange?.(); setRecord(saved); setDraft(configurationDraft(saved.configuration)); setPhase('ready'); setConflict(false); setMessage('Vos choix ont été enregistrés. Les propositions restent facultatives.');
    } catch (e) {
      if (token !== generation.current) return;
      setPhase('editing'); setConflict(e instanceof ProfileConflictError);
      setError(e instanceof ProfileConflictError ? 'Votre configuration a été modifiée dans un autre onglet. Vos saisies sont conservées. Rechargez la configuration avant de réessayer.' : 'Vos choix n’ont pas pu être enregistrés. Vos saisies sont conservées ; vous pouvez réessayer.');
    } finally { busy.current = false; }
  }
  const configuration = record?.configuration;
  const dimensional = draft.goal === 'distance' || draft.goal === 'race';
  return <section className="panel settings-panel coach-profile" aria-labelledby="coach-configuration-title">
    <h2 id="coach-configuration-title">Votre accompagnement</h2>
    <p>L’analyse et les conseils restent disponibles avec ou sans programme. Avec votre accord, vous pouvez consulter une prochaine proposition et choisir de l’inscrire à votre planning.</p>
    {phase === 'loading' && <p role="status">Chargement de vos choix…</p>}
    {error && <div className="notice" role="alert" tabIndex={-1} ref={alert}>{error}
      {conflict && <><p>Le rechargement remplacera les saisies de ce formulaire.</p><button className="button" onClick={() => setAttempt(a => a + 1)}>Recharger la configuration</button></>}
      {phase === 'error' && <button className="button" onClick={() => setAttempt(a => a + 1)}>Réessayer la lecture de la configuration</button>}
    </div>}
    {message && <p role="status">{message}</p>}
    {phase === 'ready' && <>
      {configuration ? <dl className="training-metrics">
        <div><dt>Objectif</dt><dd>{COACH_GOALS[configuration.goal.kind]}</dd></div>
        {'distanceMeters' in configuration.goal && <div><dt>Distance cible</dt><dd>{(configuration.goal.distanceMeters / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 6 })} km</dd></div>}
        {draft.date && <div><dt>Date cible</dt><dd>{draft.date.split('-').reverse().join('/')}</dd></div>}
        {configuration.goal.kind === 'race' && <div><dt>Chrono cible</dt><dd>{draft.chrono || 'Terminer, sans objectif chronométrique'}</dd></div>}
        <div><dt>Expérience déclarée</dt><dd>{configuration.experience ? EXPERIENCES[configuration.experience] : 'Non renseignée'}</dd></div>
        <div><dt>Programme structuré</dt><dd>{configuration.goal.kind === 'wellbeing' ? 'Non proposé pour cet objectif' : configuration.structuredPlanningPreference === 'accepted' ? 'Propositions autorisées — acceptation au cas par cas' : configuration.structuredPlanningPreference === 'declined' ? 'Sans programme structuré' : 'Préférence non exprimée'}</dd></div>
      </dl> : <p>Vous pouvez consulter vos observations sans choisir de nouvel objectif. Aucun choix n’est déduit de votre ancien profil.</p>}
      <button className="button" onClick={() => { setDraft(configurationDraft(configuration)); setPhase('editing'); setError(''); setMessage(''); }}>{configuration ? 'Modifier mes choix' : 'Configurer mon accompagnement'}</button>
    </>}
    {(phase === 'editing' || phase === 'saving') && <form onSubmit={save} noValidate>
      <fieldset className="profile-fields" disabled={phase === 'saving'}><legend>Vos choix d’accompagnement</legend>
        <div className="profile-grid">
          <label>Votre objectif<select value={draft.goal} onChange={e => setDraft(d => ({ ...d, goal: e.target.value, planning: e.target.value === 'wellbeing' || d.goal === 'wellbeing' ? 'unexpressed' : d.planning }))}><option value="">Choisir un objectif</option>{Object.entries(COACH_GOALS).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          {dimensional && <>
            <label>Distance cible (km)<input inputMode="decimal" value={draft.distanceKm} onChange={e => change('distanceKm', e.target.value)} required /></label>
            <label>{draft.goal === 'race' ? 'Date de la course' : 'Date cible (facultative)'}<input type="date" required={draft.goal === 'race'} value={draft.date} onChange={e => change('date', e.target.value)} /></label>
          </>}
          {draft.goal === 'race' && <label>Chrono cible (hh:mm:ss, facultatif)<input placeholder="01:05:00" value={draft.chrono} onChange={e => change('chrono', e.target.value)} /><small>Sans chrono, votre objectif est de terminer. La faisabilité sportive n’est pas évaluée ici.</small></label>}
          <label>Votre expérience déclarée<select value={draft.experience} onChange={e => change('experience', e.target.value)}><option value="">Non renseignée</option>{Object.entries(EXPERIENCES).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select><small>Votre expérience ne détermine pas vos capacités actuelles. Aucun niveau ni séance test n’est imposé.</small></label>
          {draft.goal && draft.goal !== 'wellbeing' && <label>Votre préférence d’accompagnement<select value={draft.planning} onChange={e => change('planning', e.target.value as ConfigurationDraft['planning'])}>
            <option value="unexpressed">Je n’ai pas encore choisi</option><option value="declined">Sans programme structuré</option><option value="accepted">Avec programme structuré</option>
          </select></label>}
        </div>
        {draft.goal === 'wellbeing' && <p>Pour le plaisir et la forme : analyse et suggestions facultatives, sans programme structuré.</p>}
        <div className="profile-actions"><button type="submit" className="button" disabled={conflict}>{phase === 'saving' ? 'Enregistrement…' : 'Enregistrer mes choix'}</button><button type="button" className="button" onClick={() => { setPhase('ready'); setError(''); setConflict(false); setDraft(configurationDraft(configuration)); }}>Annuler</button></div>
      </fieldset>
    </form>}
  </section>;
}
