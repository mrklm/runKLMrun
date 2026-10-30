import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { RunningSession } from '../types/session';
import { createSessionReviewRepository } from '../storage/session-review';
import type { CreatedActivityBatch } from './created-activity-batch';
import { SessionReviewEditor, type ReviewEditorState } from './SessionReviewEditor';

/** Les éditeurs restent montés pendant la navigation : brouillons et instantanés de concurrence restent ensemble. */
export function SessionReviewDialog({ batch, onDismiss }: { batch: CreatedActivityBatch; onDismiss: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), heading = useRef<HTMLHeadingElement>(null), keepEditing = useRef<HTMLButtonElement>(null);
  const titleId = useId(), descriptionId = useId();
  const [index, setIndex] = useState(0), [confirmClose, setConfirmClose] = useState(false);
  const [activities, setActivities] = useState<Record<string, RunningSession | null>>({});
  const [states, setStates] = useState<Record<string, ReviewEditorState>>({});
  const busy = Object.values(states).some(state => state.saving), unsaved = Object.values(states).some(state => state.unsaved);
  useEffect(() => {
    let active = true;
    const repository = createSessionReviewRepository(batch.database);
    void Promise.all(batch.activityIds.map(async id => {
      try { return [id, (await repository.get(id)).session] as const; }
      catch { return [id, null] as const; }
    })).then(entries => { if (active) setActivities(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [batch]);
  useEffect(() => {
    const element = dialog.current!, previous = batch.returnFocus ?? document.activeElement;
    element.showModal(); heading.current?.focus();
    return () => {
      element.close();
      if (previous instanceof HTMLElement && previous.isConnected && !previous.closest('[hidden], [inert]')) previous.focus();
      else document.querySelector<HTMLElement>('#main-content')?.focus();
    };
  }, []);
  useEffect(() => { if (confirmClose) keepEditing.current?.focus(); }, [confirmClose]);
  const stateChanged = useCallback((id: string, state: ReviewEditorState) => {
    setStates(previous => previous[id]?.saving === state.saving && previous[id]?.unsaved === state.unsaved ? previous : { ...previous, [id]: state });
  }, []);
  function trapTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return;
    const fields = [...event.currentTarget.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')]
      .filter(element => !element.matches(':disabled') && element.tabIndex >= 0 && element.getClientRects().length > 0);
    const first = fields[0], last = fields.at(-1), active = document.activeElement;
    if (!first) { event.preventDefault(); heading.current?.focus(); }
    else if (event.shiftKey && (active === first || !fields.includes(active as HTMLElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
  }
  function resume() { setConfirmClose(false); heading.current?.focus(); }
  function close() { if (busy) return; if (unsaved) setConfirmClose(true); else onDismiss(); }
  function move(next: number) { setIndex(next); heading.current?.focus(); dialog.current?.scrollTo({ top: 0 }); }
  function saved(savedIndex: number) {
    if (savedIndex !== index) return;
    if (index < batch.activityIds.length - 1) move(index + 1);
    else {
      // Le callback suit le commit ; ne pas dépendre d'un effet React encore en attente pour cet éditeur.
      const otherDrafts = Object.entries(states).some(([id, state]) => id !== batch.activityIds[index] && state.unsaved);
      if (otherDrafts) setConfirmClose(true); else onDismiss();
    }
  }
  return createPortal(<dialog ref={dialog} className="panel session-review-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onKeyDown={trapTab}
    onCancel={event => { event.preventDefault(); if (confirmClose) resume(); else close(); }}>
    <header className="review-dialog-header">
      <h2 ref={heading} id={titleId} tabIndex={-1}>Bilan de votre séance</h2>
      <button type="button" disabled={busy} onClick={close}>Quitter le bilan</button>
    </header>
    <p id={descriptionId}>Ce bilan est facultatif. Vous pourrez le compléter depuis la fiche de chaque activité.</p>
    {batch.activityIds.length > 1 && <p role="status" aria-live="polite">Activité {index + 1} sur {batch.activityIds.length}</p>}
    {confirmClose && <section className="review-close-confirmation" role="alert" aria-label="Modifications non enregistrées">
      <p>Vos modifications non enregistrées seront abandonnées. Les réponses déjà enregistrées seront conservées.</p>
      <div className="review-actions">
        <button ref={keepEditing} type="button" onClick={resume}>Continuer le bilan</button>
        <button type="button" onClick={onDismiss}>Fermer sans enregistrer</button>
      </div>
    </section>}
    <div hidden={confirmClose}>
      {batch.activityIds.map((id, position) => <div key={id} hidden={index !== position}>
        {activities[id] === undefined ? <p role="status">Chargement de l’activité…</p> : activities[id] === null
          ? <p role="alert">Cette activité n’est plus disponible ou n’a pas pu être chargée. Vous pouvez passer à la suivante ou quitter le bilan.</p>
          : <SessionReviewEditor database={batch.database} session={activities[id]} showTitle={false}
            saveLabel={position < batch.activityIds.length - 1 ? 'Enregistrer et suivant' : 'Enregistrer'}
            onStateChange={stateChanged} onSaved={() => saved(position)} />}
      </div>)}
      <div className="review-actions">
        {batch.activityIds.length > 1 && <button type="button" disabled={busy || index === 0} onClick={() => move(index - 1)}>Précédent</button>}
        <button type="button" disabled={busy} onClick={() => index < batch.activityIds.length - 1 ? move(index + 1) : close()}>Plus tard</button>
      </div>
      {batch.activityIds.length > 1 && <p>« Plus tard » passe à l’activité suivante sans enregistrer. Vos brouillons restent disponibles tant que cette fenêtre est ouverte.</p>}
    </div>
  </dialog>, document.body);
}
