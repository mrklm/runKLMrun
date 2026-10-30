import { useEffect, useRef, useState } from 'react';
import { createSessionReviewRepository, type SessionReviewSnapshot } from '../storage/session-review';
import { createSuggestionV2Repository } from '../storage/coach-suggestions-v2';
import { subscribeStorage } from '../storage/changes';
import { coachV2Enabled } from '../core/coach/activation-v2';
import { availableReviewCandidate, relevantReviewOccurrence, reviewDraft, reviewPatch, type ReviewCandidate, type ReviewDraft } from './session-review-model';

interface LoadedReview { snapshot: SessionReviewSnapshot; candidates: ReviewCandidate[] }
export function useSessionReview(database: string, sessionId: string) {
  const [loaded, setLoaded] = useState<LoadedReview>();
  const [draft, setDraft] = useState<ReviewDraft>();
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [changed, setChanged] = useState(false);
  const generation = useRef(0), context = useRef(0), dirty = useRef(false), running = useRef(false), selection = useRef('');
  async function reload(keepMessage = false) {
    const token = ++generation.current;
    setLoading(true); setError(''); if (!keepMessage) setMessage('');
    try {
      const repository = createSessionReviewRepository(database);
      const snapshot = await repository.get(sessionId);
      const suggestions = createSuggestionV2Repository(database);
      const occurrences = coachV2Enabled() ? (await suggestions.listAll()).filter(item => relevantReviewOccurrence(item, snapshot.session)) : [];
      const candidates = await Promise.all(occurrences.map(async occurrence => ({ occurrence, inspection: await suggestions.inspectAssociation(occurrence.id) })));
      if (token !== generation.current) return;
      const available = candidates.filter(item => availableReviewCandidate(item, sessionId));
      const id = available.some(item => item.occurrence.id === selection.current) ? selection.current : available.length === 1 ? available[0].occurrence.id : '';
      selection.current = id; setSelected(id);
      setLoaded({ snapshot, candidates }); setDraft(reviewDraft(snapshot.session, candidates.find(item => item.occurrence.id === id)?.occurrence));
      dirty.current = false; setChanged(false);
    } catch (cause) {
      if (token === generation.current) { setLoaded(undefined); setError(cause instanceof Error ? cause.message : 'Le bilan n’a pas pu être chargé.'); }
    } finally { if (token === generation.current) setLoading(false); }
  }
  useEffect(() => {
    context.current++;
    selection.current = ''; dirty.current = false; running.current = false; setLoaded(undefined); setDraft(undefined); setSaving(false);
    void reload();
    const unsubscribe = subscribeStorage(['sessions', 'feelings', 'suggestions-v2'], () => {
      if (running.current) return;
      if (dirty.current) { setChanged(true); return; }
      void reload(true);
    }, database);
    return () => { context.current++; generation.current++; unsubscribe(); };
  }, [database, sessionId]);
  function update(patch: Partial<ReviewDraft>) {
    dirty.current = true; setDraft(value => value ? { ...value, ...patch } : value); setMessage('');
  }
  function select(id: string) {
    if (!loaded || running.current) return;
    const candidate = loaded.candidates.find(item => item.occurrence.id === id);
    if (id && (!candidate || !availableReviewCandidate(candidate, sessionId))) return;
    selection.current = id; setSelected(id);
    setDraft(value => value ? { ...value, result: candidate?.occurrence.realization?.result ?? '', associateOnly: false } : value);
    setMessage('');
  }
  async function save() {
    if (!loaded || !draft || running.current) return;
    const token = context.current;
    running.current = true; setSaving(true); setError(''); setMessage('');
    try {
      const occurrence = loaded.candidates.find(item => item.occurrence.id === selected)?.occurrence;
      const expected = { ...loaded.snapshot, ...(occurrence ? { occurrence } : {}) };
      await createSessionReviewRepository(database).save(expected, reviewPatch(expected, draft));
      if (token !== context.current) return;
      dirty.current = false; setMessage('Votre bilan a été enregistré.');
      await reload(true);
    } catch (cause) {
      if (token === context.current) setError(cause instanceof Error ? cause.message : 'L’enregistrement a échoué. Vos saisies sont conservées.');
    } finally { if (token === context.current) { running.current = false; setSaving(false); } }
  }
  const candidate = loaded?.candidates.find(item => item.occurrence.id === selected);
  const responseChanged = !!draft && (draft.result !== (candidate?.occurrence.realization?.result ?? '') || draft.associateOnly);
  return { loaded, draft, selected, candidate, loading, saving, error, message, changed, responseChanged,
    update, select, save, reload: () => { void reload(); } };
}
