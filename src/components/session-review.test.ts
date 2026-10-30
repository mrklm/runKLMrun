import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SessionReviewForm, type SessionReviewFormProps } from './SessionReviewForm';
import { availableReviewCandidate, relevantReviewOccurrence, reviewDraft, reviewPatch } from './session-review-model';
import type { PersistableOccurrenceV2 } from '../core/coach/persistence-foundations-v2';
import type { RunningSession } from '../types/session';

const session: RunningSession = { id: 'run', title: 'Séance', date: '2026-10-20', durationSeconds: 1800 };
// Seuls les champs d’affichage interviennent ici ; le contrat de stockage est testé séparément.
const occurrence = (patch: Partial<PersistableOccurrenceV2> = {}): PersistableOccurrenceV2 => ({
  id: 'suggestion', state: 'active', content: { type: 'easy-endurance', totalDurationSeconds: 1800, shortSummary: 'Séance conseillée' },
  opportunity: { suggestedFor: session.date, generation: 1 }, presentation: { presentedOn: '2026-10-18' }, ...patch,
} as PersistableOccurrenceV2);
const response = { result: 'partial' as const, proposalOrigin: 'automatic' as const, confirmedBy: 'user' as const };
const render = (patch: Partial<SessionReviewFormProps> = {}) => renderToStaticMarkup(createElement(SessionReviewForm, {
  sessionId: session.id, draft: reviewDraft(session), candidates: [], selected: '', disabled: false, responseChanged: false,
  onChange() {}, onSelect() {}, onSave() {}, onReset() {}, ...patch,
}));
describe('formulaire de bilan et patch', () => {
  it('affiche les quatre ressentis, le commentaire et les types officiels sans question artificielle', () => {
    const html = render();
    for (const value of ['easy', 'moderate', 'hard', 'very-hard']) expect(html).toContain(`value="${value}"`);
    for (const text of ['Commentaire personnel', 'Récupération', 'Endurance à variations modérées', 'Sortie soutenue', 'Autre entraînement…']) expect(html).toContain(text);
    expect(html).not.toContain('type="radio"');
  });
  it('ne préconfirme pas une association historique', () => {
    const value = occurrence({ state: 'associated', activityId: session.id });
    const html = render({ selected: value.id, candidates: [{ occurrence: value, inspection: { status: 'associated', activityId: session.id } }] });
    expect(html).toContain('sans confirmation de réalisation'); expect(html).not.toContain('checked=""');
    expect(reviewDraft(session, value).result).toBe('');
  });
  it('affiche la sélection explicite quand plusieurs recommandations correspondent', () => {
    const html = render({ candidates: [occurrence(), occurrence({ id: 'other' as PersistableOccurrenceV2['id'] })].map(value => ({ occurrence: value, inspection: { status: 'confirmation-required', activityId: session.id } })) });
    expect(html).toContain('Choisir une recommandation'); expect(html).not.toContain('type="radio"');
  });
  it('sépare autres entraînements et absences de précision', () => {
    const value = occurrence(), snapshot = { database: 'test', session, occurrence: value };
    const draft = { ...reviewDraft(session), result: 'not-completed' as const, trainingType: 'other' as const };
    expect(reviewPatch(snapshot, draft)).toEqual({ realization: { result: 'not-completed', proposalOrigin: 'manual', confirmedBy: 'user' } });
    const html = render({ draft }); expect(html).toContain('Précisez votre entraînement'); expect(html).toContain('Quel entraînement avez-vous réalisé');
  });
  it('conserve les champs non modifiés, y compris la provenance automatique', () => {
    const saved = { ...session, trainingType: 'recovery' as const, trainingDescription: 'Libre', feeling: { effort: 'easy' as const, comment: 'Bien' } };
    const value = occurrence({ realization: response });
    expect(reviewPatch({ database: 'test', session: saved, occurrence: value }, reviewDraft(saved, value))).toEqual({});
  });
  it('efface explicitement sans envoyer de valeur artificielle', () => {
    const saved = { ...session, trainingType: 'hills' as const, trainingDescription: 'Escaliers', feeling: { effort: 'hard' as const } };
    const patch = reviewPatch({ database: 'test', session: saved, occurrence: occurrence({ realization: response }) }, reviewDraft(session));
    expect(patch).toEqual({ feeling: null, trainingType: null, trainingDescription: null, realization: null });
  });
  it('conserve simultanément type connu et description libre', () => {
    expect(reviewPatch({ database: 'test', session }, { ...reviewDraft(session), trainingType: 'recovery', description: 'Très lentement' }))
      .toEqual({ trainingType: 'recovery', trainingDescription: 'Très lentement' });
  });
  it('exclut les associations occupées, conserve les invalidations et les refus obsolètes', () => {
    const value = occurrence();
    expect(availableReviewCandidate({ occurrence: value, inspection: { status: 'associated', activityId: 'other' } }, session.id)).toBe(false);
    expect(availableReviewCandidate({ occurrence: value, inspection: { status: 'invalid-association', activityId: 'other' } }, session.id)).toBe(false);
    expect(relevantReviewOccurrence(occurrence({ state: 'obsolete' }), session)).toBe(false);
    expect(relevantReviewOccurrence(occurrence({ state: 'obsolete', realization: { ...response, result: 'not-completed' } }), session)).toBe(true);
    const invalid = occurrence({ state: 'obsolete', associationInvalidation: { activityId: session.id, reason: 'activity-modified', invalidatedAt: '' as never } });
    expect(relevantReviewOccurrence(invalid, { ...session, date: '2026-10-21' })).toBe(true);
    const html = render({ selected: invalid.id, candidates: [{ occurrence: invalid, inspection: { status: 'no-candidate' } }] });
    expect(html).toContain('Aucune réalisation n’est confirmée'); expect(html).not.toContain('type="radio"');
  });
  it('ne confirme pas une proposition automatique', () => {
    const value = occurrence({ realizationProposal: { origin: 'automatic', result: 'partial' } });
    expect(reviewDraft(session, value).result).toBe('');
    expect(reviewPatch({ database: 'test', session, occurrence: value }, reviewDraft(session, value))).toEqual({});
  });
});
