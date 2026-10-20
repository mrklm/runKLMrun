import { sessionRepository } from '../storage/database';
import { classifyDetails } from '../core/analysis/detail-retention';
import { validSessionDate } from '../core/analysis/session-summary';
import { localToday } from '../core/analysis/statistics-period';
import { useEffect, useId, useState, useRef } from 'react';
import type { Shoe } from '../types/shoe';
import type { RunningSession } from '../types/session';
import { shoeRepository, type ConversionPreview, type AssignmentPreview } from '../storage/shoes';
import { useShoes } from './use-shoes';
import { shoeTimeline, usageDuration } from '../core/shoes/timeline';
import { shoeMileage, sessionsInPeriod } from '../core/shoes/shoes';
import { SessionList } from './SessionList';

const number = (value: number | undefined) => value === undefined ? '—' : value.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const labels = { normal: 'Normal', warning: 'À surveiller', limit: 'Limite atteinte' };
export function ShoeAlert({ sessions }: { sessions: RunningSession[] }) {
  const data = useShoes(), automatic = data.settings?.mode === 'automatic';
  const timeline = shoeTimeline(data.shoes, sessions, localToday());
  const candidates = automatic ? data.shoes.filter(s => s.id === timeline.current) : data.shoes.filter(s => s.status === 'active');
  const associations = automatic ? timeline.assignments : data.shoeAssignments;
  return <>{candidates.map(shoe => {
    const usage = shoeMileage(shoe, sessions, associations);
    return usage.state === 'normal' ? null : <aside className="notice" key={shoe.id}><a href="#/chaussures">{shoe.name} : {labels[usage.state]}</a><p>{number(usage.km)} km sur votre repère de {number(shoe.limitKm)} km.</p></aside>;
  })}</>;
}
export function SessionShoes({ sessionId, session }: { sessionId: string; session?: RunningSession }) {
  const selectId = useId();
  const data = useShoes();
  const association = data.shoeAssignments.find(a => a.sessionId === sessionId);
  const [selected, setSelected] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { setSelected(association?.shoeId ?? ''); }, [association?.shoeId, sessionId]);
  async function save() {
    setBusy(true); setMessage('');
    try { await shoeRepository.assign(sessionId, selected || undefined, association?.shoeId); setMessage('Association enregistrée.'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Enregistrement impossible.'); }
    finally { setBusy(false); }
  }
  const current = data.shoes.find(s => s.id === association?.shoeId);
  if (data.settings?.mode === 'automatic') {
    const timeline = shoeTimeline(data.shoes, session ? [session] : [], localToday());
    const calculated = data.shoes.find(s => s.id === timeline.assignments[0]?.shoeId);
    return <section className="panel settings-panel"><h2>Chaussures de cette séance</h2><p>Mode automatique : {calculated?.name ?? 'aucune paire déterminée'}. Les associations manuelles restent conservées sans être utilisées.</p>{timeline.issues.map(issue => <p key={issue}>{issue}</p>)}<a href="#/chaussures">Modifier le mode ou les dates</a></section>;
  }

  return <section className="panel settings-panel shoe-panel"><h2>Chaussures de cette séance</h2>
    {data.error && <p role="alert">{data.error}</p>}
    <p>{current ? `${current.name}${current.status === 'archived' ? ' (archivée)' : ''}` : 'Aucune paire associée.'}</p>
    <label htmlFor={selectId}>Paire</label><select id={selectId} value={selected} disabled={busy || data.loading || !!data.error} onChange={e => setSelected(e.target.value)}><option value="">Aucune paire</option>{data.shoes.filter(s => s.status === 'active' || s.id === association?.shoeId).map(s => <option key={s.id} value={s.id}>{s.name}{s.status === 'archived' ? ' (archivée)' : ''}</option>)}</select>
    <button className="button" disabled={busy || data.loading || !!data.error || selected === (association?.shoeId ?? '')} onClick={() => void save()}>Enregistrer l’association</button>
    <p role="status">{message}</p><a href="#/chaussures">Mes chaussures</a>
  </section>;
}
export function ShoeAttribution({ shoes, sessions, ids, defaultId }: { shoes: Shoe[]; sessions?: RunningSession[]; ids?: string[]; defaultId?: string }) {
  const selectId = useId();
  const [shoeId, setShoeId] = useState(defaultId ?? ''), [from, setFrom] = useState(''), [to, setTo] = useState('');
  const [replace, setReplace] = useState(false), [preview, setPreview] = useState<AssignmentPreview>(), [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const reset = () => { setPreview(undefined); setConfirmed(false); setMessage(''); };
  async function prepare() {
    setBusy(true); reset();
    try { setPreview(await shoeRepository.preview(ids ?? sessionsInPeriod(sessions ?? [], from, to).map(s => s.id), shoeId, ids ? false : replace)); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Aperçu impossible.'); }
    finally { setBusy(false); }
  }
  async function apply() {
    if (!preview || !confirmed || busy) return;
    setBusy(true);
    try { const count = await shoeRepository.apply(preview, confirmed); reset(); setMessage(`${count} séance(s) associée(s).`); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Attribution impossible.'); }
    finally { setBusy(false); }
  }
  return <section className="panel settings-panel shoe-panel"><h2>{ids ? 'Chaussures des nouvelles séances' : 'Attribuer une paire par période'}</h2>
    {ids && <p>Vous pouvez associer les {ids.length} nouvelles séances importées à votre paire proposée. Les doublons réimportés ne sont pas concernés. Aucune association n’est automatique.</p>}
    <fieldset disabled={busy} className="profile-fields"><legend>Choisir les séances et la paire</legend>
      {!ids && <><label>Date de début<input type="date" value={from} onChange={e => { setFrom(e.target.value); reset(); }} /></label><label>Date de fin<input type="date" value={to} onChange={e => { setTo(e.target.value); reset(); }} /></label></>}
      <label htmlFor={selectId}>Paire concernée</label><select id={selectId} value={shoeId} onChange={e => { setShoeId(e.target.value); reset(); }}><option value="">Choisissez une paire</option>{shoes.filter(s => s.status === 'active').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      {!ids && <><label><input type="checkbox" checked={replace} onChange={e => { setReplace(e.target.checked); reset(); }} /> Remplacer les associations existantes</label>{replace && <p className="notice">Attention : les séances de cette période pourront changer de paire. Le kilométrage des paires précédentes sera recalculé.</p>}</>}
      <button className="button" disabled={!shoeId} onClick={() => void prepare()}>Prévisualiser l’attribution</button>
      {preview && <div className="notice"><p>{preview.entries.length} séance(s) · {number(preview.km)} km · {preview.missing} distance(s) inconnue(s). {preview.protectedCount} association(s) conservée(s).</p>
        <label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> Je confirme cette attribution{replace ? ' et le remplacement des associations existantes' : ''}.</label>
        <button className="button" disabled={!confirmed || !preview.entries.length} onClick={() => void apply()}>Confirmer l’attribution</button><button className="button" onClick={reset}>Annuler</button>
      </div>}
    </fieldset><p role="status">{message}</p>
  </section>;
}
export function ImportShoeSuggestion({ ids }: { ids: string[] }) {
  const data = useShoes(), shoe = data.shoes.find(s => s.isDefault && s.status === 'active');
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    void sessionRepository.list().then(sessions => {
      if (active) setRecent(sessions.filter(s => ids.includes(s.id) && validSessionDate(s.date) && s.date <= localToday() && classifyDetails(s, new Date()) === 'keep').map(s => s.id));
    }, () => { if (active) setRecent([]); });
    return () => { active = false; };
  }, [ids]);
  return data.settings?.mode !== 'automatic' && shoe && recent.length ? <ShoeAttribution key={recent.join('|')} shoes={data.shoes} ids={recent} defaultId={shoe.id} /> : null;
}
export function Shoes({ sessions, embedded = false }: { sessions: RunningSession[]; embedded?: boolean }) {
  const data = useShoes();
  const automatic = data.settings?.mode === 'automatic', today = localToday();
  const timeline = shoeTimeline(data.shoes, sessions, today);
  const effective = automatic ? timeline.assignments : data.shoeAssignments;
  const [conversion, setConversion] = useState<ConversionPreview>(), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false);
  async function mode(value: 'automatic' | 'manual') {
    setBusy(true); setConversion(undefined); setConfirmed(false);
    try { await shoeRepository.setMode(value, data.settings?.revision); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Changement impossible.'); } finally { setBusy(false); }
  }
  const pendingModeFocus = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (busy || !pendingModeFocus.current) return;
    const input = pendingModeFocus.current;
    pendingModeFocus.current = null;
    if (input.isConnected && (document.activeElement === document.body || document.activeElement?.closest('.shoe-mode-cards'))) input.focus();
  }, [busy]);
  async function selectMode(value: 'automatic' | 'manual', input: HTMLInputElement) {
    pendingModeFocus.current = input;
    await mode(value);
  }
  async function previewConversion() {
    setBusy(true); setConfirmed(false);
    try { setConversion(await shoeRepository.previewConversion(today)); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Aperçu impossible.'); } finally { setBusy(false); }
  }
  async function convert() {
    if (!conversion || !confirmed) return;
    setBusy(true);
    try { await shoeRepository.convert(conversion, confirmed); setConversion(undefined); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Conversion impossible.'); } finally { setBusy(false); }
  }
  function card(shoe: Shoe) {
    const usage = shoeMileage(shoe, sessions, effective);
    const period = timeline.periods.find(p => p.shoe.id === shoe.id);
    const ids = new Set(effective.filter(a => a.shoeId === shoe.id).map(a => a.sessionId));
    return <section className="panel settings-panel shoe-panel" key={shoe.id}><h2>{shoe.name}</h2><p>{shoe.brand} · {automatic ? timeline.issues.length ? 'Dates à corriger' : period?.current ? 'Paire actuelle' : period?.future ? 'Paire à venir' : 'Ancienne paire' : shoe.status === 'active' ? 'Active' : 'Archivée'}{!automatic && shoe.isDefault ? ' · Paire par défaut' : ''} · {labels[usage.state]}</p>
      {automatic && !timeline.issues.length && period && <><p>{period.current ? `Utilisée depuis le ${period.start.split('-').reverse().join('/')}` : period.future ? `Début prévu le ${period.start.split('-').reverse().join('/')}` : `Utilisée du ${period.start.split('-').reverse().join('/')} au ${period.end?.split('-').reverse().join('/') ?? '—'}`}</p>{period.end && <p>Fin déduite : {period.end.split('-').reverse().join('/')} (veille de la paire suivante, et non dernière séance enregistrée).</p>}<p>Durée calendaire : {period.future ? '—' : usageDuration(period.start, period.current ? today : period.end ?? today)}.</p></>}
      <dl className="session-detail-metrics"><div><dt>Kilométrage cumulé</dt><dd>{number(automatic && timeline.issues.length ? undefined : usage.km)} km</dd></div><div><dt>Limite personnelle</dt><dd>{number(shoe.limitKm)} km</dd></div><div><dt>Kilométrage restant</dt><dd>{number(usage.remainingKm)} km</dd></div><div><dt>Utilisation</dt><dd>{number(usage.percent)} %</dd></div><div><dt>Séances associées</dt><dd>{automatic && timeline.issues.length ? '—' : usage.count}</dd></div><div><dt>Date de première utilisation</dt><dd>{shoe.firstUseDate?.split('-').reverse().join('/') ?? '—'}</dd></div><div><dt>Date d’achat</dt><dd>{shoe.purchaseDate?.split('-').reverse().join('/') ?? '—'}</dd></div></dl>
      {!!usage.missing && <p>{usage.missing} séance(s) sans distance exploitable, non comptées dans les kilomètres.</p>}
      <div className="profile-actions"><button className="button" onClick={() => { setCreating(false); setEditing(shoe); }}>Modifier cette paire</button>{!automatic && <button className="button" onClick={() => void toggle(shoe)}>{shoe.status === 'active' ? 'Archiver cette paire' : 'Réactiver cette paire'}</button>}</div>
      <details><summary>Séances de cette paire</summary><SessionList sessions={sessions.filter(s => ids.has(s.id))} /></details>
    </section>;
  }
  const [editing, setEditing] = useState<Shoe>(), [creating, setCreating] = useState(false), [error, setError] = useState('');
  async function toggle(shoe: Shoe) {
    try { await shoeRepository.save({ ...shoe, status: shoe.status === 'active' ? 'archived' : 'active', isDefault: false }, shoe.revision); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement impossible.'); }
  }
  return <>{!embedded && <header className="page-heading"><h1>Mes chaussures</h1><p>Un suivi facultatif, calculé à partir de vos sorties. Votre limite est un repère indicatif, jamais une obligation de remplacement.</p></header>}
    {(data.error || error) && <p role="alert">{data.error || error}</p>}
    {data.loading ? <p role="status">Chargement de vos chaussures…</p> : <>
      {!data.shoes.length && <section className="panel settings-panel shoe-panel"><h2>Votre première paire</h2><p>Ajoutez une paire, puis choisissez les sorties à lui associer. Les dates renseignées ne déclenchent aucune attribution.</p></section>}
      <fieldset className="panel settings-panel shoe-panel" disabled={busy}><legend>Mode de suivi</legend>
        <div className="shoe-mode-cards">
          <label className="shoe-mode-card"><input type="radio" name="shoe-mode" aria-label="Une seule paire — Automatique" aria-describedby="shoe-mode-automatic-description" checked={automatic} onChange={event => void selectMode('automatic', event.currentTarget)} /><span className="shoe-mode-content"><strong>Une seule paire</strong><span>Automatique</span><span id="shoe-mode-automatic-description">Kilométrage calculé selon les dates de première utilisation.</span><span className="shoe-mode-selection" aria-hidden="true">{automatic ? '✓ Sélectionné' : '\u00a0'}</span></span></label>
          <label className="shoe-mode-card"><input type="radio" name="shoe-mode" aria-label="Plusieurs paires — Par séance" aria-describedby="shoe-mode-manual-description" checked={!automatic} onChange={event => void selectMode('manual', event.currentTarget)} /><span className="shoe-mode-content"><strong>Plusieurs paires</strong><span>Par séance</span><span id="shoe-mode-manual-description">Choix des chaussures utilisées pour chaque sortie.</span><span className="shoe-mode-selection" aria-hidden="true">{!automatic ? '✓ Sélectionné' : '\u00a0'}</span></span></label>
        </div>
      </fieldset>
      {automatic && timeline.issues.map(issue => <p role="alert" key={issue}>{issue} Aucun kilomètre automatique n’est attribué tant que les dates sont ambiguës.</p>)}
      {automatic && !!timeline.invalidDates && <p>{timeline.invalidDates} séance(s) sans date valide : non attribuées.</p>}
      {!automatic && !!data.shoes.length && <div className="panel settings-panel shoe-panel"><button className="button" disabled={busy} onClick={() => void previewConversion()}>Reprendre les associations calculées par dates</button>{conversion && <><p>{conversion.assignments.length} séance(s) · {number(conversion.km)} km. Les associations existantes seront conservées.</p><label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> Je confirme la conversion en associations manuelles.</label><button className="button" disabled={busy || !confirmed} onClick={() => void convert()}>Confirmer la conversion</button><button className="button" disabled={busy} onClick={() => setConversion(undefined)}>Annuler</button></>}</div>}
      <button className="button" onClick={() => { setEditing(undefined); setCreating(true); }}>{automatic ? 'Nouvelle paire' : 'Ajouter une paire de chaussures'}</button>
      {(creating || editing) && <ShoeForm automatic={automatic} key={editing?.id ?? 'new'} shoe={editing} onClose={() => { setCreating(false); setEditing(undefined); }} />}
      {data.shoes.filter(s => automatic ? s.id === timeline.current || (s.firstUseDate ?? '') > today : s.status === 'active').map(card)}
      <h2>Historique des chaussures</h2>
      {data.shoes.filter(s => automatic ? s.id !== timeline.current && (!s.firstUseDate || s.firstUseDate <= today) : s.status === 'archived').map(card)}
      {!automatic && !!data.shoes.length && <ShoeAttribution shoes={data.shoes} sessions={sessions} />}
    </>}
  </>;
}
function ShoeForm({ shoe, onClose, automatic }: { automatic: boolean; shoe?: Shoe; onClose: () => void }) {
  const [name, setName] = useState(shoe?.name ?? ''), [brand, setBrand] = useState(shoe?.brand ?? '');
  const [purchase, setPurchase] = useState(shoe?.purchaseDate ?? ''), [firstUse, setFirstUse] = useState(shoe?.firstUseDate ?? '');
  const [limit, setLimit] = useState(shoe?.limitKm?.toString() ?? ''), [warning, setWarning] = useState(shoe?.warningKm?.toString() ?? '');
  const [isDefault, setDefault] = useState(shoe?.isDefault ?? false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function save() {
    setBusy(true); setError('');
    try { await shoeRepository.save({ id: shoe?.id ?? crypto.randomUUID(), name: name.trim(), brand: brand.trim() || undefined, purchaseDate: purchase || undefined, firstUseDate: firstUse || undefined, limitKm: limit === '' ? undefined : Number(limit), warningKm: warning === '' ? undefined : Number(warning), status: shoe?.status ?? 'active', isDefault }, shoe?.revision); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement impossible.'); }
    finally { setBusy(false); }
  }
  return <form className="panel settings-panel shoe-panel" onSubmit={e => { e.preventDefault(); if (!busy) void save(); }}><h2>{shoe ? 'Modifier cette paire' : 'Ajouter une paire de chaussures'}</h2>
    <fieldset disabled={busy} className="profile-fields"><legend>Caractéristiques de la paire</legend>
      <label>Modèle ou nom personnalisé<input required maxLength={200} value={name} onChange={e => setName(e.target.value)} /></label>
      <label>Marque (facultative)<input maxLength={200} value={brand} onChange={e => setBrand(e.target.value)} /></label>
      <label>Date d’achat (facultative)<input type="date" value={purchase} onChange={e => setPurchase(e.target.value)} /></label>
      <label>Date de première utilisation<input type="date" required={automatic} value={firstUse} onChange={e => setFirstUse(e.target.value)} /></label>
      <p>Cette date est indépendante de l’achat et reste modifiable. En mode automatique, elle détermine la période de calcul. En mode manuel, elle n’attribue aucune séance.</p>
      <label>Limite personnelle (km, facultative)<input type="number" min="0.001" step="any" value={limit} onChange={e => setLimit(e.target.value)} /></label>
      <label>Seuil préventif (km avant la limite, facultatif)<input type="number" min="0" step="any" value={warning} onChange={e => setWarning(e.target.value)} /></label>
      {!automatic && <label><input type="checkbox" checked={isDefault} disabled={shoe?.status === 'archived'} onChange={e => setDefault(e.target.checked)} /> Paire active par défaut, proposée lors des imports</label>}
      <div className="profile-actions"><button className="button" type="submit">Enregistrer cette paire</button><button className="button" type="button" onClick={onClose}>Annuler</button></div>
    </fieldset>{error && <p role="alert">{error}</p>}
  </form>;
}
