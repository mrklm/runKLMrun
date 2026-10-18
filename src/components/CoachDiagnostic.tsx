import type { CoachProposal } from '../types/coach-proposal';
import { DAYS } from '../core/coach/profile';
import { formatCoachDuration, formatCoachDurationText } from './coach-planning-display';

/** Lecture du résultat déjà calculé : aucun accès au stockage ni appel du moteur. */
export function CoachDiagnostic({ proposal }: { proposal: CoachProposal }) {
  if (!import.meta.env.DEV) return null;
  const e = proposal.evidence, s = proposal.suggestions[0], b = proposal.diagnostic?.durationBasis ?? s?.durationBasis, d = b?.diagnostic;
  const trace = proposal.diagnostic, a = trace?.availability;
  const duration = (value: number | null | undefined) => value == null ? 'Non applicable / non disponible' : formatCoachDuration(value);
  const number = (value: number | null | undefined) => value == null ? 'Non disponible' : String(value).replace('.', ',');
  const goal = proposal.goal;
  const labels = { begin:'Débuter', return:'Reprendre', endurance:'Endurance', speed:'Vitesse', distance:'Distance', race:'Course', wellbeing:'Plaisir et forme', regular:'Régularité' };
  const kind = goal?.model === 'evolving' ? goal.kind : goal?.value.kind;
  const rows = [
    ['Objectif sélectionné', kind ? labels[kind] : 'Non renseigné'],
    ['Nombre de séances de référence', String(e.horizons.find(h => h.kind === 'recent')?.sessionIds.length ?? 0)],
    ['Durées utilisables', String(e.knownDurations)],
    ['Date de la dernière séance', e.observed.rhythm.activeDates.at(-1) ?? 'Non disponible'],
    ['Ancienneté de la dernière séance (jours)', number(e.latestAgeDays)],
    ['Durée médiane observée', duration(e.medianDurationSeconds)],
    ['Espacement médian (jours)', number(e.medianGapDays)],
    ['Tolérance de fraîcheur appliquée (jours)', number(trace?.freshnessLimitDays)],
    ['Minimum exigé', duration(proposal.policy.minimumSuggestionSeconds)],
    ['Jours disponibles déclarés', a?.days?.map(day => DAYS[day]).join(', ') || 'Non renseignés'],
    ['Fréquence souhaitée', number(a?.sessionsPerWeek)],
    ['Durée disponible déclarée', a?.durationMode === 'custom' ? 'Selon le jour (voir ci-dessous)' : a?.minutesPerSession === undefined ? 'Non renseignée — aucun plafond ajouté' : duration(a.minutesPerSession * 60)],
    ['Variabilité des durées (étendue / médiane)', number(d?.durationSpread)],
    ['Variabilité des intervalles (étendue / médiane)', number(d?.gapSpread)],
    ['Coefficient réellement appliqué', d?.coefficient == null ? 'Aucun / non disponible' : number(d.coefficient)],
    ['Durée après coefficient', duration(d?.afterCoefficientSeconds)],
    ['Plafond prudent', duration(d?.prudentCapSeconds)],
    ['Minimum éditorial retenu', d?.editorialMinimumApplied ? duration(proposal.policy.minimumSuggestionSeconds) : 'Non appliqué'],
    ['Maximum avant disponibilité (seconde entière inférieure)', duration(b?.proposedMaximumSeconds)],
    ['Durée arrondie avant disponibilité', duration(trace?.roundedBeforeAvailability)],
    ['Durée finale proposée', duration(s?.durationSeconds)],
    ['Date proposée', s?.date ?? 'Aucune proposition'],
  ];
  return <details className="coach-explanations">
    <summary>Diagnostic Coach</summary>
    <p>Développement uniquement. Résultat actuellement calculé, distinct des séances acceptées ou modifiées manuellement.</p>
    {!s && <p>Aucune proposition disponible : les calculs effectués et les motifs sont présentés ci-dessous.</p>}
    <dl>{rows.map(([label,value]) => <div className="coach-explanation" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {a?.durationMode === 'custom' && <ul>{Object.entries(a.maxMinutesByDay ?? {}).map(([day,minutes]) => <li key={day}>{DAYS[day as keyof typeof DAYS]} : {duration(minutes === undefined ? undefined : minutes * 60)}</li>)}</ul>}
    {!!trace?.attempts.length && <><h4>Plafonds et arrondis par jour examiné</h4><ul>{trace.attempts.map(attempt => <li key={attempt.date}>{attempt.date} : plafond disponible {attempt.availableMaximumSeconds === null ? 'non renseigné' : duration(attempt.availableMaximumSeconds)} ; après plafonds {duration(attempt.afterCapsSeconds)} ; après arrondi {duration(attempt.roundedSeconds)}.</li>)}</ul></>}
    {!s && <><h4>Motifs du refus</h4><ul>{[...proposal.constraints, ...proposal.reasons].map((reason,i) => <li key={i}>{formatCoachDurationText(reason)}</li>)}</ul></>}
    <h4>Raisons exactes du coefficient</h4>
    {d ? d.coefficientReasons.length ? <ul>{d.coefficientReasons.map(reason => <li key={reason}>{formatCoachDurationText(reason)}</li>)}</ul> : <p>Aucun critère de prudence déclenché.</p> : <p>Diagnostic non disponible.</p>}
  </details>;
}
