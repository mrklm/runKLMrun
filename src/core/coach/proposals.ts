import { suggestionId } from './suggestions';
import { bootstrapHabitualReference,type ReferenceBootstrapResult } from './reference-bootstrap-v2';
import type { StoredSuggestion } from '../../types/coach-suggestion';
import type { CoachPlanning } from '../../types/coach-planning';
import { validateCoachPlanning } from './planning';
import { roundProposalDuration, recommendTerrain } from './proposal-presentation';
import type { CoachProfileValues, Weekday } from '../../types/coach-profile';
import type { EvolvingCoachValues, CoachGoal } from '../../types/evolving-coach';
import type { RunningSession } from '../../types/session';
import type { CoachProposal, ProposalEvidence, ProposalPolicy } from '../../types/coach-proposal';
import { canActivateStructuredPlanning, observeHistory, structuredPlanningPolicy } from './foundations';
import { validateEvolvingCoachValues } from './configuration';
import { DAYS, maximumMinutesForDay, validateAvailabilityAndPreferences } from './profile';

const DAY = 86400000;
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY;
const dateAt = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);
const median = (values: readonly number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : sorted[middle-1] / 2 + sorted[middle] / 2;
};
function validatePolicy(p: ProposalPolicy): void {
  if (!p || ![p.horizonDays, p.evidenceAgeLimitDays, p.rhythmIntervals, p.recentCycles, p.staleCycles, p.minimumSuggestionSeconds].every(v => Number.isSafeInteger(v) && v > 0)
    || p.horizonDays > 14 || p.evidenceAgeLimitDays > 365 || p.rhythmIntervals > 365 || p.recentCycles > 365 || p.staleCycles > 365
    || p.minimumSuggestionSeconds > 86400 || (p.discoverySeconds !== undefined && (!Number.isSafeInteger(p.discoverySeconds) || p.discoverySeconds < p.minimumSuggestionSeconds || p.discoverySeconds > 1800))) throw new Error('Politique expérimentale invalide. Renseignez explicitement ses limites ; une découverte ne dépasse pas 30 minutes.');
  const d = p.duration;
  if (!d || !Number.isSafeInteger(d.minimumReferences) || d.minimumReferences < 2 || d.minimumReferences > 365
    || !Number.isFinite(d.freshCycles) || d.freshCycles <= 0 || d.freshCycles > p.staleCycles
    || ![d.maximumDurationSpread, d.maximumGapSpread].every(v => Number.isFinite(v) && v >= 0)
    || ![d.supportedFraction, d.cautiousFraction].every(v => Number.isFinite(v) && v > 0 && v < 1)
    || d.cautiousFraction > d.supportedFraction
    || !Number.isSafeInteger(d.cautiousMaximumSeconds) || d.cautiousMaximumSeconds < p.minimumSuggestionSeconds || d.cautiousMaximumSeconds > 86400) throw new Error('Politique de durée adaptative invalide.');
}
/** Observation indépendante de l'objectif et du consentement, exclusivement sur les résumés. */
export function proposalEvidence(sessions: readonly RunningSession[], referenceDate: string, policy: ProposalPolicy): ProposalEvidence {
  validatePolicy(policy);
  const observed = observeHistory(sessions, referenceDate);
  const historicalDays = observed.rhythm.activeDates;
  const historicalGaps = historicalDays.slice(1).map((d,i) => dayNumber(d)-dayNumber(historicalDays[i])).slice(-policy.rhythmIntervals);
  const candidates = observed.activities.filter(a => a.ageDays <= policy.evidenceAgeLimitDays);
  const days = [...new Set(candidates.map(a => a.date))];
  const gaps = days.slice(1).map((d,i) => dayNumber(d)-dayNumber(days[i])).slice(-policy.rhythmIntervals);
  const gap = median(gaps);
  const window = gap === null ? null : Math.min(policy.evidenceAgeLimitDays, Math.ceil(gap * policy.recentCycles));
  const staleAfter = gap === null ? null : Math.min(policy.evidenceAgeLimitDays, Math.ceil(gap * policy.staleCycles));
  const latest = candidates.at(-1);
  const possibleGap = !!latest && staleAfter !== null && latest.ageDays > staleAfter;
  // En cas de grand intervalle observé, ne pas transférer l'ancienne durée à une découverte.
  const recent = possibleGap ? [] : candidates.filter(a => window !== null ? a.ageDays <= window : a.date === latest?.date);
  const currentGap = !possibleGap && new Set(recent.map(a => a.date)).size >= 2 ? gap : null;
  const recentIds = new Set(recent.map(a => a.id));
  const durations = recent.flatMap(a => a.durationSeconds.status === 'available' && a.durationSeconds.value > 0 && a.durationSeconds.value <= 86400 ? [a.durationSeconds.value] : []);
  const criteria = [
    `Plafond d’ancienneté fourni : ${policy.evidenceAgeLimitDays} jours. Les données plus anciennes ne déterminent pas les durées proposées.`,
    `Rythme : médiane des ${policy.rhythmIntervals} derniers intervalles au maximum entre jours enregistrés sous ce plafond ; plusieurs sorties un même jour comptent comme un jour.`,
    gap === null ? 'Aucun intervalle récent calculable : aucun rythme personnel déduit.' : `Intervalle médian : ${gap} jours. Fenêtre de référence : ${window} jours (${policy.recentCycles} intervalles médians, plafonnés).`,
    staleAfter === null ? 'Actualité du rythme indéterminée : les durées isolées sont décrites mais ne fixent pas une durée de séance.' : `Un écart supérieur à ${staleAfter} jours (${policy.staleCycles} intervalles médians, plafonnés) écarte les durées du calcul. Ce critère n’atteste ni interruption ni fatigue.`,
    'La médiane décrit les durées observées, pas leur aisance. La proposition applique séparément la politique de prudence puis le plafond disponible.',
    `Rythme historique descriptif : ${median(historicalGaps) ?? 'indéterminé'} jours ; rythme actuel utilisable : ${currentGap ?? 'indéterminé'} jours.`,
  ];
  return { observed, historicalMedianGapDays: median(historicalGaps), medianGapDays: currentGap, latestAgeDays: observed.activities.at(-1)?.ageDays ?? null, durationRangeSeconds: durations.length ? { min: Math.min(...durations), max: Math.max(...durations) } : null, gapRangeDays: gaps.length ? { min: Math.min(...gaps), max: Math.max(...gaps) } : null,
    medianDurationSeconds: currentGap === null ? null : median(durations), knownDurations: durations.length, recentWindowDays: window, staleAfterDays: staleAfter, possibleGap, criteria,
    horizons: [
      { kind: 'older', sessionIds: observed.activities.filter(a => !recentIds.has(a.id)).map(a => a.id), rationale: ['Non retenues comme références actuelles avec cette politique.'], limitations: ['Ne démontrent pas les capacités actuelles.'] },
      { kind: 'recent', sessionIds: recent.map(a => a.id), rationale: [...criteria], limitations: ['Les séances importées peuvent être incomplètes ; cette sélection ne mesure pas les capacités.'] },
      { kind: 'latest', sessionIds: observed.activities.filter(a => a.date === observed.activities.at(-1)?.date).map(a => a.id), rationale: ['Dernier jour enregistré, avec son ancienneté explicite.'], limitations: ['Dernier ne signifie pas récent.'] },
    ] };
}
/** Réduction éditoriale explicite, jamais une estimation de capacité ou de charge. */
function selectDuration(e: ProposalEvidence, p: ProposalPolicy, goal: string,reference?:ReferenceBootstrapResult) {
  const observed = e.medianDurationSeconds;
  if (observed === null) return p.discoverySeconds === undefined ? undefined : {
    observedMedianSeconds: null, proposedMaximumSeconds: p.discoverySeconds,
    diagnostic: { freshnessLimitDays: null, coefficient: null, coefficientReasons: ['Aucun coefficient : durée de découverte configurée.'], durationSpread: null, gapSpread: null, afterCoefficientSeconds: null, prudentCapSeconds: null, editorialMinimumApplied: false },
    assessment: 'discovery' as const, reasons: ['Durée de découverte explicitement paramétrée, au plus 30 minutes ; maximum facultatif.'],
  };
  const d = p.duration;
  const recentCount = e.horizons.find(h => h.kind === 'recent')!.sessionIds.length;
  const reasons: string[] = [];
  if(reference?.confidence==='provisional') reasons.push('Référence V2 provisoire : elle décrit des durées réelles sans établir une capacité confirmée.');
  if (e.knownDurations < d.minimumReferences) reasons.push(`Seulement ${e.knownDurations} durées utilisables ; repère éditorial : ${d.minimumReferences}.`);
  if (e.knownDurations < recentCount) reasons.push('Durées partiellement renseignées.');
  // Un historique documenté reste actuel jusqu'au repère d'écart significatif
  // déjà calculé. Un simple dépassement de la médiane n'est pas une interruption.
  const documented = e.knownDurations >= d.minimumReferences && e.knownDurations === recentCount;
  const freshLimit = documented ? e.staleAfterDays : e.medianGapDays === null ? null : e.medianGapDays * d.freshCycles;
  if (e.latestAgeDays === null || freshLimit === null || e.latestAgeDays > freshLimit) reasons.push('Références insuffisamment récentes selon les repères éditoriaux de cet historique.');
  const durationSpread = e.durationRangeSeconds ? (e.durationRangeSeconds.max-e.durationRangeSeconds.min)/observed : 0;
  if (durationSpread > d.maximumDurationSpread) reasons.push(`Étendue relative des durées : ${durationSpread} ; repère fourni : ${d.maximumDurationSpread}.`);
  const gapSpread = e.gapRangeDays && e.medianGapDays ? (e.gapRangeDays.max-e.gapRangeDays.min)/e.medianGapDays : 0;
  // La variabilité du rythme reste descriptive et diagnostiquée, sans réduire la durée à elle seule.
  if (goal === 'begin' || goal === 'return') reasons.push('Objectif débuter ou reprendre : durée transitoire prudente.');
  const cautious = reasons.length > 0;
  const fraction = cautious ? d.cautiousFraction : d.supportedFraction;
  const afterCoefficientSeconds = observed * fraction;
  const calculatedMaximum = Math.floor(Math.min(afterCoefficientSeconds, cautious ? d.cautiousMaximumSeconds : observed));
  // Minimum éditorial seulement avec des références représentatives : il ne
  // permet jamais de dépasser la médiane ni de relever un plafond prudent.
  const editorialMinimumApplied = !cautious && ['endurance','speed','distance','race'].includes(goal)
    && calculatedMaximum < p.minimumSuggestionSeconds && observed >= p.minimumSuggestionSeconds;
  const proposed = editorialMinimumApplied ? p.minimumSuggestionSeconds : calculatedMaximum;
  const diagnostic = { freshnessLimitDays: freshLimit, coefficient: fraction, coefficientReasons: [...reasons], durationSpread, gapSpread,
    afterCoefficientSeconds, prudentCapSeconds: cautious ? d.cautiousMaximumSeconds : null, editorialMinimumApplied };
  if (editorialMinimumApplied) reasons.push(`Minimum éditorial de ${p.minimumSuggestionSeconds} s retenu avec des références représentatives, sans dépasser la médiane observée.`);
  reasons.push(`Médiane observée ${observed} s, fraction éditoriale ${fraction}, maximum proposé ${proposed} s avant disponibilité${cautious ? ` ; plafond prudent ${d.cautiousMaximumSeconds} s` : ''}.`,
    'L’intensité et le ressenti passés sont inconnus : cette réduction ne prouve aucune capacité physiologique.');
  return { observedMedianSeconds: observed, proposedMaximumSeconds: proposed, diagnostic,
    assessment: cautious ? 'cautious' as const : 'supported' as const, reasons };
}
export interface ProposalInput {
  configuration?: EvolvingCoachValues | null;
  historicalProfile?: CoachProfileValues;
  sessions: readonly RunningSession[];
  referenceDate: string;
  policy: ProposalPolicy;
  /** Injection interne uniquement. L'absence conserve strictement V1. */
  referenceMode?:'v1'|'v2-experimental';
  /** Requis avec V2 expérimental ; jamais chargé implicitement par le moteur. */
  storedSuggestions?:readonly StoredSuggestion[];
}
/** Premier moteur : au plus une suggestion, aucune écriture et aucun rattrapage. */
export function proposeNextSession(input: ProposalInput): CoachProposal {
  return calculateProposals(input);
}
/** API préparatoire : même calcul, horizon court, sans raccordement à l’interface. */
export const MAX_SUGGESTIONS = 3;
export type SuggestionSet = Omit<CoachProposal, 'suggestions'> & {
  suggestions: (CoachProposal['suggestions'][number] & { id: string; explanation: string })[];
};
export function proposeSuggestions(input: ProposalInput, planning?: CoachPlanning): SuggestionSet {
  if (planning) validateCoachPlanning(planning);
  const result = calculateProposals({...input, policy:{...input.policy,horizonDays:7}}, planning, true);
  return {...result,suggestions:result.suggestions.map(s => ({...s,
    id:suggestionId({date:s.date,kind:s.kind,durationSeconds:s.durationSeconds,terrain:{surface:s.recommendedTerrain.surface,relief:s.recommendedTerrain.relief}}),
    explanation: s.durationBasis.assessment === 'discovery'
      ? `${s.durationSeconds / 60} minutes faciles sur un jour disponible, sans durée déduite de vos anciennes sorties.`
      : s.kind === 'endurance'
        ? `${s.durationSeconds / 60} minutes en aisance, proches de vos sorties récentes, sans augmenter leur durée habituelle.`
        : s.durationBasis.observedMedianSeconds !== null && s.durationSeconds < s.durationBasis.observedMedianSeconds
          ? `${s.durationSeconds / 60} minutes faciles, plus courtes que la durée habituelle de vos sorties récentes.`
          : `${s.durationSeconds / 60} minutes faciles, selon vos sorties récentes et vos disponibilités.`,
  }))};
}
function calculateProposals(input: ProposalInput, planning?: CoachPlanning, multiple = false): CoachProposal {
  const { configuration, historicalProfile: profile, referenceDate } = input;
  const policy = structuredClone(input.policy);
  const evidence = proposalEvidence(input.sessions, referenceDate, policy);
  const mode=input.referenceMode??'v1';
  if(mode==='v2-experimental'&&!input.storedSuggestions) throw new Error('Les suggestions persistées sont requises pour la référence V2 expérimentale.');
  const v2=mode==='v2-experimental'?bootstrapHabitualReference({sessions:input.sessions,suggestions:input.storedSuggestions!,
    referenceDate,proposalPolicy:policy,bootstrapPolicy:'hybrid'}):undefined;
  const durationEvidence=v2?{...evidence,medianDurationSeconds:v2.referenceSeconds}:evidence;
  const from = dayNumber(referenceDate) + 1;
  const horizon = { from: dateAt(from), to: dateAt(from + policy.horizonDays - 1) };
  if (horizon.to.length !== 10) throw new Error('Horizon hors des dates calendaires prises en charge.');
  const goal: CoachGoal | null = configuration?.goal ?? (profile?.goal.kind ? { model: 'legacy', value: structuredClone(profile.goal) } : null);
  const result: CoachProposal = { status: 'not-enabled', goal: goal ? structuredClone(goal) : null, horizon, suggestions: [], reasons: [], constraints: [], evidence, policy, diagnostic: { availability: profile ? structuredClone(profile.availability) : undefined, attempts: [] },
    limitations: [...evidence.observed.limitations, 'Les résumés ne permettent pas de justifier une intensité soutenue ni une cible de fréquence cardiaque. Aucune météo n’est déduite.', multiple ? 'Suggestions libres sur sept jours, sans programme ni réponse attendue.' : 'Une seule prochaine suggestion : ce résultat n’est pas un programme complet.'] };
  if(v2) result.diagnostic!.reference={mode:'v2-experimental',confidence:v2.confidence,freshness:v2.freshness,
    sourceIds:[...v2.sourceIds],reasons:[...v2.reasons]};
  if (!configuration) { result.reasons.push('Aucune configuration évolutive : aucun objectif historique converti.'); return result; }
  validateEvolvingCoachValues(configuration);
  evidence.declaredExperience = configuration.experience;
  if (!canActivateStructuredPlanning(structuredPlanningPolicy(configuration.goal), configuration.structuredPlanningPreference)) {
    result.reasons.push(configuration.goal.kind === 'wellbeing' ? 'Plaisir et forme : aucune planification structurée.' : 'Aucun accord explicite à la planification structurée.'); return result;
  }
  if (profile && Object.keys(validateAvailabilityAndPreferences(profile.availability, profile.preferences)).length) {
    result.status = 'unavailable'; result.constraints.push('Disponibilités ou préférences incohérentes : aucune correction implicite.'); return result;
  }
  const a = profile?.availability;
  if (!a?.days?.length || a.sessionsPerWeek === 0) {
    result.status = 'unavailable'; result.constraints.push(!a?.days ? 'Jours disponibles non renseignés.' : !a.days.length ? 'Aucun jour disponible déclaré.' : 'Vous avez indiqué zéro séance souhaitée.'); return result;
  }
  const recentIds = evidence.horizons.find(h => h.kind === 'recent')!.sessionIds;
  const referenceIds=v2?[...v2.sourceIds]:[...recentIds];
  const discovery = durationEvidence.medianDurationSeconds === null;
  const durationBasis = selectDuration(durationEvidence, policy, configuration.goal.kind,v2);
  result.diagnostic!.durationBasis = durationBasis;
  result.diagnostic!.freshnessLimitDays = durationBasis?.diagnostic.freshnessLimitDays;
  const seconds = durationBasis?.proposedMaximumSeconds;
  if (seconds === undefined) {
    result.status = 'insufficient-data'; result.constraints.push('Vos références récentes sont insuffisantes pour déterminer une durée de séance.'); return result;
  }
  const roundedBeforeAvailability = roundProposalDuration(seconds);
  result.diagnostic!.roundedBeforeAvailability = roundedBeforeAvailability;
  if (roundedBeforeAvailability < policy.minimumSuggestionSeconds) {
    result.status = 'unavailable';
    if (evidence.knownDurations < policy.duration.minimumReferences || evidence.knownDurations < recentIds.length)
      result.constraints.push('Vos références récentes sont trop peu nombreuses ou incomplètes pour retenir une durée plus longue.');
    result.constraints.push(`La durée calculée à partir de vos sorties est inférieure à ${policy.minimumSuggestionSeconds / 60} min. Aucune séance n’est proposée.`);
    return result;
  }
  const kind = configuration.goal.kind;
  result.reasons.push(kind === 'begin' ? 'Découvrir sans test de performance ni progression imposée.' : kind === 'return' ? 'Reprendre sans chercher à retrouver les anciennes performances.' : kind === 'endurance' ? 'Privilégier la continuité et l’aisance, sans augmentation automatique.' : kind === 'speed' ? 'L’objectif vitesse ne justifie pas à lui seul une séance intense.' : 'Une première sortie aisée, sans chercher immédiatement à atteindre la distance cible.');
  if (kind === 'distance' || kind === 'race') {
    const target = configuration.goal;
    if ('distanceMeters' in target) result.reasons.push(`Distance cible déclarée : ${target.distanceMeters} m ; aucune durée de séance déduite de cette cible.`);
    const deadline = target.kind === 'race' ? target.eventDate : target.kind === 'distance' ? target.targetDate : undefined;
    if (deadline) result.limitations.push(`Échéance déclarée : ${deadline} (${dayNumber(deadline)-dayNumber(referenceDate)} jours). La faisabilité n’est pas établie ; aucune accélération de préparation pour respecter cette date.`);
    if (target.kind === 'race') result.reasons.push(target.targetSeconds === undefined ? 'Objectif de course : terminer, sans chrono imposé.' : `Chrono déclaré : ${target.targetSeconds} s, conservé sous votre contrôle et non utilisé pour imposer une allure.`);
    if (deadline && dayNumber(deadline) <= dayNumber(referenceDate)) {
      result.status = 'unavailable'; result.constraints.push('Échéance atteinte ou passée : aucune séance de préparation proposée après cette échéance.'); return result;
    }
  }
  if (evidence.possibleGap) result.limitations.push('Écart aux intervalles enregistrés : la cause est inconnue ; les anciennes durées ne sont pas reprises.');
  if (discovery) result.limitations.push(`Durée de découverte fournie par la politique : ${seconds} s. Ce choix n’est pas une capacité mesurée ni une recommandation universelle.`);
  if (evidence.knownDurations < recentIds.length) result.limitations.push('Certaines durées récentes sont absentes, nulles ou invalides ; elles ne sont pas remplacées par zéro.');
  if (evidence.gapRangeDays && evidence.gapRangeDays.min !== evidence.gapRangeDays.max) result.limitations.push('Les intervalles enregistrés varient : la médiane est un repère descriptif, pas une obligation ni un défaut de régularité.');
  const lastDay = evidence.observed.rhythm.activeDates.at(-1);
  const desiredGap = a.sessionsPerWeek && a.sessionsPerWeek > 0 ? 7 / a.sessionsPerWeek : null;
  // Une fréquence souhaitée plus élevée ne raccourcit jamais l'intervalle observé.
  const spacing = Math.max(evidence.medianGapDays ?? 0, desiredGap ?? 0);
  const earliest = lastDay && spacing ? Math.max(from, dayNumber(lastDay) + Math.ceil(spacing)) : from;
  if (spacing) result.reasons.push(`Espacement retenu : ${Math.ceil(spacing)} jours, à partir de l’intervalle observé et, si renseignée, d’une fréquence souhaitée moins élevée. Aucun rattrapage.`);
  const weekdays: Weekday[] = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const target = configuration.goal;
  const deadline = target.kind === 'race' ? target.eventDate : target.kind === 'distance' ? target.targetDate : undefined;
  const skipped = new Set<string>();
  const supported = durationBasis!.assessment === 'supported' && durationEvidence.medianGapDays !== null;
  const maximum = multiple && supported ? MAX_SUGGESTIONS : 1;
  const interval = Math.max(1, Math.ceil(spacing));
  const planned = multiple ? (planning?.sessions ?? []).filter(s => s.status === 'planned') : [];
  // Budget descriptif, jamais une charge physiologique : ne pas dépasser le volume
  // de durée correspondant au rythme observé (ou souhaité s’il est moins fréquent).
  const budget = multiple && supported
    ? Math.floor(durationEvidence.medianDurationSeconds! * 7 / Math.max(1, spacing))
      - planned.filter(s => s.date >= horizon.from && s.date <= horizon.to).reduce((sum,s)=>sum+s.durationSeconds,0)
    : Infinity;
  let proposedSeconds = 0, previousDay: number | undefined;

  for (let day = from; day < from + policy.horizonDays; day++) {
    if (day < earliest) continue;
    const date = dateAt(day);
    if (multiple && (previousDay !== undefined && day - previousDay < interval
      || planned.some(s => Math.abs(dayNumber(s.date) - day) < interval))) {
      skipped.add('Créneau écarté pour préserver l’espacement avec les suggestions et séances déjà planifiées.'); continue;
    }
    if (deadline && date >= deadline) { skipped.add('Aucun créneau de préparation compatible avant l’échéance.'); continue; }
    const weekday = weekdays[new Date(day * DAY).getUTCDay()];
    if (!a.days.includes(weekday)) continue;
    const cap = a.durationMode === 'custom' ? maximumMinutesForDay(profile!, weekday) : a.minutesPerSession;
    const alternate = multiple && supported && result.suggestions.length % 2 === 1;
    const habitual = multiple && supported && !alternate && ['endurance','speed','distance','race'].includes(kind);
    const dayBasis = habitual ? {
      ...durationBasis!, proposedMaximumSeconds: durationEvidence.medianDurationSeconds!,
      diagnostic: { ...durationBasis!.diagnostic, coefficient: 1, afterCoefficientSeconds: durationEvidence.medianDurationSeconds!, editorialMinimumApplied: false },
      reasons: ['Durée habituelle plafonnée à la médiane des références récentes représentatives, sans progression automatique.'],
    } : durationBasis!;
    const dayMaximum = dayBasis.proposedMaximumSeconds;
    const afterCapsSeconds = Math.min(dayMaximum, cap === undefined ? dayMaximum : cap * 60);
    const varied = afterCapsSeconds;
    const duration = roundProposalDuration(varied);
    result.diagnostic!.attempts.push({ date, availableMaximumSeconds: cap === undefined ? null : cap * 60, afterCapsSeconds: varied, roundedSeconds: duration });
    if (duration < policy.minimumSuggestionSeconds) { skipped.add(`Vos disponibilités sur les jours compatibles sont trop courtes pour une séance de ${policy.minimumSuggestionSeconds / 60} min.`); continue; }
    if (multiple && proposedSeconds + duration > budget) {
      skipped.add('Le volume correspondant à votre rythme récent est déjà couvert dans cet horizon.'); continue;
    }
    if (multiple && !result.suggestions.length) {
      result.diagnostic!.durationBasis = dayBasis;
      result.diagnostic!.roundedBeforeAvailability = roundProposalDuration(dayMaximum);
    }
    const limits = [...result.limitations];
    if (cap === undefined) limits.push('Plafond de durée non renseigné pour ce jour ; aucun plafond supposé.');
    if (duration < dayMaximum) limits.push(`Durée réduite à ${duration} s après application des plafonds et arrondi inférieur par pas de 5 minutes.`);
    const referenceReason=v2?`Durée fondée sur ${referenceIds.length} résumé(s), référence V2 ${durationEvidence.medianDurationSeconds} s ; maximum proposé avant disponibilité ${dayMaximum} s.`
      :`Durée fondée sur ${evidence.knownDurations} résumé(s) récent(s), médiane observée ${evidence.medianDurationSeconds} s ; maximum proposé avant disponibilité ${dayMaximum} s.`;
    const reasons = [...result.reasons, ...dayBasis.reasons, `Jour disponible : ${DAYS[weekday]}. Les autres disponibilités ne sont pas des obligations.`, discovery ? 'Découverte sans référence de durée actuelle.' : referenceReason];
    const suggestionKind = discovery || kind === 'begin' || kind === 'return' ? 'discovery' : (habitual && duration === roundProposalDuration(durationEvidence.medianDurationSeconds!) || !multiple && kind === 'endurance') ? 'endurance' : 'easy';
    result.suggestions.push({ date, recommendedTerrain: recommendTerrain(configuration.goal, configuration.experience, suggestionKind, profile?.preferences.terrain, input.sessions.filter(s=>referenceIds.includes(s.id))), kind: suggestionKind,
      intention: result.reasons[0], durationSeconds: duration, durationBasis: { ...dayBasis, availableMaximumSeconds: cap === undefined ? null : cap * 60, diagnostic: { ...dayBasis.diagnostic, afterCapsSeconds: varied } }, intensity: { kind: 'easy', description: 'Sortie de course à pied en aisance ressentie. Cette durée est un maximum indicatif, jamais une obligation. Vous pouvez ralentir, raccourcir, marcher ou interrompre la séance. Aucune alternance marche/course imposée, aucune allure ni FC cible.' },
      optional: true, ...(profile?.preferences.terrain ? { terrainPreference: profile.preferences.terrain } : {}), reasons, referenceSessionIds: referenceIds, limitations: limits });
    result.status = durationBasis?.assessment !== 'supported' || discovery || evidence.possibleGap || evidence.knownDurations < recentIds.length || evidence.medianGapDays === null || cap === undefined || !!deadline ? 'cautious' : 'possible';
    if (!multiple) { result.constraints.push(...skipped); return result; }
    proposedSeconds += duration; previousDay = day;
    if (result.suggestions.length >= maximum) break;
  }
  // Même durée et même intensité : un seul libellé descriptif, sans stratégie fictive.
  if (multiple) for (const suggestion of result.suggestions) {
    if (suggestion.kind === 'endurance' && result.suggestions.some(other => other.kind === 'easy' && other.durationSeconds === suggestion.durationSeconds)) suggestion.kind = 'easy';
  }
  if (!result.suggestions.length) result.status = 'unavailable'; result.constraints.push(...skipped);
  if (!result.diagnostic!.attempts.length) result.constraints.push('Aucun jour compatible avec vos disponibilités et votre rythme dans cet horizon court.');
  return result;
}
