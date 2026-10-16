import { subscribeStorage } from '../storage/changes';
import { CoachObservations } from './CoachObservations';
import type { TrainingComparison } from '../core/coach/comparison';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { emptyProfileValues, type CoachProfile as Profile, type Weekday } from '../types/coach-profile';
import { DAYS, GOALS, TERRAINS, validateProfile, maximumMinutesForDay, formatAvailableMinutes, type ProfileErrors } from '../core/coach/profile';
import { coachProfileRepository, ProfileConflictError } from '../storage/coach-profile';
import { StorageBlockedError } from '../storage/database-connection';
import type { CoachProfileRepository } from '../storage/contracts';
import { draftFrom, valuesFrom, type Draft } from '../core/coach/profile-draft';
import { localToday } from '../core/analysis/statistics-period';

const dateLabel = (date: string) => date.split('-').reverse().join('/');
export function CoachProfile({ repository = coachProfileRepository, comparison, onChange, children }: { repository?: CoachProfileRepository; comparison?: TrainingComparison; onChange?: () => void; children?: ReactNode }) {
  const [profile, setProfile] = useState<Profile>();
  const [observationProfile, setObservationProfile] = useState<Profile>();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(emptyProfileValues()));
  const [phase, setPhase] = useState<'loading' | 'editing' | 'summary' | 'saving' | 'read-error'>('loading');
  const [message, setMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const token = ++generation.current;
    setPhase('loading'); setMessage('');
    repository.get().then(value => {
      if (generation.current !== token) return;
      setObservationProfile(value); setProfile(value); setDraft(draftFrom(value ?? emptyProfileValues()));
      setPhase(value ? 'summary' : 'editing'); setErrors({}); setSaveError(''); setConflict(false);
    }, error => { if (generation.current === token) { setPhase('read-error'); setMessage(error instanceof StorageBlockedError ? error.message : 'Votre profil n’a pas pu être lu. Vos séances restent conservées. Vous pouvez réessayer.'); } });
    return () => { generation.current++; };
  }, [repository, attempt]);
  const current = useRef({ phase, profile }); current.current = { phase, profile };
  useEffect(() => subscribeStorage(['profile'], () => {
    if (current.current.phase === 'saving') return;
    const token = ++generation.current;
    repository.get().then(value => {
      if (token !== generation.current) return;
      setObservationProfile(value);
      if (current.current.phase !== 'loading' && value?.revision === current.current.profile?.revision) return;
      if (current.current.phase === 'editing') {
        setConflict(true); setSaveError(new ProfileConflictError().message);
      } else {
        setProfile(value); setDraft(draftFrom(value ?? emptyProfileValues()));
        setPhase(value ? 'summary' : 'editing'); setConflict(false);
      }
    }, () => { if (token === generation.current) { setPhase('read-error'); setMessage('Votre profil n’a pas pu être lu. Vos séances restent conservées. Vous pouvez réessayer.'); } });
  }), [repository]);
  useEffect(() => { if (Object.keys(errors).length || saveError) errorRef.current?.focus(); }, [errors, saveError]);
  const change = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(d => ({ ...d, [key]: value }));
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phase === 'saving') return;
    const { availability, preferences } = valuesFrom(draft);
    // Seuls les champs éditables changent : objectif et mode historiques restent exacts.
    const values = { ...(profile ?? emptyProfileValues()), availability, preferences };
    const issues = validateProfile(values, localToday(), profile);
    if (event.currentTarget.querySelector<HTMLInputElement>('input[type="date"]')?.validity.badInput) issues.targetDate = 'Renseignez une date calendaire complète et valide.';
    setErrors(issues); setMessage(''); setSaveError(''); setConflict(false);
    if (Object.keys(issues).length) return;
    const token = ++generation.current; setPhase('saving');
    try {
      const saved = await repository.save(values, profile?.revision);
      if (token !== generation.current) return;
      onChange?.(); setObservationProfile(saved); setProfile(saved); setDraft(draftFrom(saved)); setPhase('summary'); setMessage('Votre profil a été enregistré.');
    } catch (error) {
      if (token !== generation.current) return;
      setPhase('editing'); setConflict(error instanceof ProfileConflictError);
      setSaveError(error instanceof StorageBlockedError || error instanceof ProfileConflictError ? error.message : 'Votre profil n’a pas pu être enregistré. Vos saisies sont conservées. Vérifiez le stockage de votre navigateur, puis réessayez.');
    }
  }
  const fieldError = (key: keyof ProfileErrors) => errors[key] ? <span className="profile-field-error" id={`profile-${key}-error`}>{errors[key]}</span> : null;
  const attributes = (key: keyof ProfileErrors) => ({ 'aria-invalid': !!errors[key], 'aria-describedby': errors[key] ? `profile-${key}-error` : undefined });
  return <>
    {comparison && phase !== 'loading' && <CoachObservations comparison={comparison} profile={observationProfile} />}
    {children}
    <section className="panel settings-panel coach-profile" aria-labelledby="coach-profile-title">
    <h2 id="coach-profile-title">Votre profil de coureur</h2>
    <p>Vos disponibilités et préférences restent communes à votre accompagnement.</p>
    {profile && (profile.goal.kind || profile.goal.distance || profile.goal.targetDate) && <details>
      <summary>Ancien objectif utilisé par les observations actuelles</summary>
      <p>{profile.goal.kind ? GOALS[profile.goal.kind] : 'Objectif non renseigné'}{profile.goal.distance ? ` · ${profile.goal.distance.meters / 1000} km` : ''}{profile.goal.targetDate ? ` · ${dateLabel(profile.goal.targetDate)}` : ''}.</p>
      <p>Ces repères historiques sont conservés sans conversion. Votre nouvel objectif ne les remplace pas dans les calculs actuels.</p>
    </details>}
    {phase === 'loading' && <p role="status">Chargement de votre profil…</p>}
    {phase === 'read-error' && <><p role="alert">{message}</p><button className="button" onClick={() => setAttempt(a => a + 1)}>Réessayer la lecture du profil</button></>}
    {phase === 'summary' && profile && <>
      {message && <p role="status">{message}</p>}
      <dl className="training-metrics">
        <div><dt>Séances souhaitées par semaine</dt><dd>{profile.availability.sessionsPerWeek ?? 'Non renseigné'}</dd></div>
        <div><dt>Jours disponibles</dt><dd>{profile.availability.days === undefined ? 'Non renseignés' : profile.availability.days.length ? profile.availability.days.map(day => DAYS[day]).join(', ') : 'Aucun jour sélectionné'}</dd></div>
        {profile.availability.durationMode === 'custom' ? <div><dt>Disponibilités maximales par jour</dt><dd>
          {Object.entries(DAYS).filter(([day]) => profile.availability.days?.includes(day as Weekday)).map(([day, label]) => <div key={day}>{label} : {formatAvailableMinutes(maximumMinutesForDay(profile, day as Weekday))}</div>)}
          {!profile.availability.days?.length && 'Aucun jour disponible renseigné'}
        </dd></div> : <div><dt>Durée disponible par séance</dt><dd>{profile.availability.minutesPerSession === undefined ? 'Non renseignée' : formatAvailableMinutes(profile.availability.minutesPerSession)}</dd></div>}
        <div><dt>Terrain préféré</dt><dd>{profile.preferences.terrain ? TERRAINS[profile.preferences.terrain] : 'Non renseigné'}</dd></div>
      </dl>

      <button className="button" onClick={() => { setPhase('editing'); setMessage(''); }}>Modifier mon profil</button>
    </>}
    {(phase === 'editing' || phase === 'saving') && <form onSubmit={save} noValidate>
      {!profile && <p>Votre profil n’est pas encore renseigné. Tous les champs sont facultatifs ; vous pouvez continuer à consulter votre bilan.</p>}
      {(Object.keys(errors).length > 0 || saveError) && <div role="alert" ref={errorRef} tabIndex={-1} className="notice">
        {saveError || 'Votre profil n’a pas été enregistré. Corrigez les champs indiqués ci-dessous.'}
        {errors.form && <p>{errors.form}</p>}
        {conflict && <><p>Recharger le profil remplacera les saisies de ce formulaire.</p><button type="button" className="button" onClick={() => setAttempt(a => a + 1)}>Recharger le profil enregistré</button></>}
      </div>}
      <fieldset disabled={phase === 'saving'} className="profile-fields">
        <legend>Vos disponibilités et préférences</legend>
        <div className="profile-grid">
          <label>Séances souhaitées par semaine<input inputMode="numeric" value={draft.sessions} onChange={e => change('sessions', e.target.value)} {...attributes('sessionsPerWeek')} /><small>De 0 à 7 ; au plus une séance par jour disponible dans cette étape.</small>{fieldError('sessionsPerWeek')}</label>
          <label>Durée disponible par séance (minutes)<input inputMode="numeric" value={draft.minutes} onChange={e => change('minutes', e.target.value)} {...attributes('minutesPerSession')} /><small>De 1 à 1 440 minutes ; aucune durée n’est recommandée automatiquement.</small>{fieldError('minutesPerSession')}</label>
          <label>Terrain préféré<select value={draft.terrain} onChange={e => change('terrain', e.target.value)} {...attributes('terrain')}><option value="">Non renseigné</option>{Object.entries(TERRAINS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>{fieldError('terrain')}</label>
        </div>
        <fieldset className="profile-days" {...attributes('days')}><legend>Jours disponibles</legend>
          <div>{Object.entries(DAYS).map(([key, label]) => <label key={key}><input type="checkbox" checked={draft.days?.includes(key as Weekday) ?? false} onChange={e => change('days', e.target.checked ? [...(draft.days ?? []), key as Weekday] : draft.days?.filter(day => day !== key))} />{label}</label>)}</div>
          <p>{draft.days === undefined ? 'Jours non renseignés.' : !draft.days.length ? 'Aucun jour sélectionné.' : `${draft.days.length} jours sélectionnés.`}</p>
          {fieldError('days')}
          <button type="button" onClick={() => change('days', undefined)}>Laisser les jours non renseignés</button>
        </fieldset>
        <label className="profile-duration-toggle"><input type="checkbox" checked={draft.durationMode === 'custom'} onChange={e => change('durationMode', e.target.checked ? 'custom' : 'simple')} {...attributes('durationMode')} />Personnaliser la durée selon les jours</label>
        {fieldError('durationMode')}
        {draft.durationMode === 'custom' && <>
          <p>Indiquez votre durée maximale disponible, sans obligation de courir aussi longtemps. Chaque durée est facultative, entre 1 et 1 440 minutes.</p>
          {!draft.days?.length && <p>Sélectionnez vos jours disponibles pour renseigner leurs durées.</p>}
          <div className="profile-grid">
            {Object.entries(DAYS).filter(([day]) => draft.days?.includes(day as Weekday)).map(([day, label]) => <label key={day}>{label} — durée maximale (minutes)<input inputMode="numeric" value={draft.dailyMinutes[day as Weekday] ?? ''} onChange={e => change('dailyMinutes', { ...draft.dailyMinutes, [day]: e.target.value })} {...attributes('maxMinutesByDay')} /></label>)}
          </div>
        </>}
        {fieldError('maxMinutesByDay')}
        <div className="profile-actions"><button type="submit" className="button">{phase === 'saving' ? 'Enregistrement…' : 'Enregistrer mon profil'}</button>{profile && <button type="button" className="button" onClick={() => { if (conflict) setAttempt(a => a + 1); setDraft(draftFrom(profile)); setErrors({}); setSaveError(''); setPhase('summary'); }}>Annuler les modifications</button>}</div>
      </fieldset>
      {phase === 'saving' && <p role="status">Enregistrement de votre profil…</p>}
    </form>}
    <p className="training-coverage">Vos choix sont modifiables et ne constituent pas une évaluation de vos capacités. Les disponibilités ne sont pas des obligations de courir.</p>
  </section></>;
}
