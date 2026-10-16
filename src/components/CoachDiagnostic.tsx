import type { CoachProposal } from '../types/coach-proposal';
import { formatCoachDuration } from './coach-planning-display';

/** Lecture du résultat déjà calculé : aucun accès au stockage ni appel du moteur. */
export function CoachDiagnostic({ proposal }: { proposal: CoachProposal }) {
  if (!import.meta.env.DEV) return null;
  const e = proposal.evidence, s = proposal.suggestions[0], b = s?.durationBasis, d = b?.diagnostic;
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
    ['Variabilité des durées (étendue / médiane)', number(d?.durationSpread)],
    ['Variabilité des intervalles (étendue / médiane)', number(d?.gapSpread)],
    ['Coefficient réellement appliqué', d?.coefficient == null ? 'Aucun / non disponible' : number(d.coefficient)],
    ['Durée après coefficient', duration(d?.afterCoefficientSeconds)],
    ['Plafond prudent', duration(d?.prudentCapSeconds)],
    ['Minimum éditorial retenu', d?.editorialMinimumApplied ? duration(proposal.policy.minimumSuggestionSeconds) : 'Non appliqué'],
    ['Maximum avant disponibilité (seconde entière inférieure)', duration(b?.proposedMaximumSeconds)],
    ['Plafond de disponibilité applicable', b?.availableMaximumSeconds == null ? 'Non renseigné — aucun plafond ajouté' : duration(b.availableMaximumSeconds)],
    ['Durée après plafonds, avant arrondi de 5 minutes', duration(d?.afterCapsSeconds)],
    ['Durée finale après arrondi', duration(s?.durationSeconds)],
    ['Date proposée', s?.date ?? 'Aucune proposition'],
  ];
  return <details className="coach-explanations">
    <summary>Diagnostic Coach</summary>
    <p>Développement uniquement. Résultat actuellement calculé, distinct des séances acceptées ou modifiées manuellement.</p>
    {!s && <p>Aucune proposition disponible : aucun coefficient ni plafond de séance à afficher.</p>}
    <dl>{rows.map(([label,value]) => <div className="coach-explanation" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <h4>Raisons exactes du coefficient</h4>
    {d ? d.coefficientReasons.length ? <ul>{d.coefficientReasons.map(reason => <li key={reason}>{reason}</li>)}</ul> : <p>Aucun critère de prudence déclenché.</p> : <p>Diagnostic non disponible.</p>}
  </details>;
}
