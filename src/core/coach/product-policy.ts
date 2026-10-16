import type { ProposalPolicy } from '../../types/coach-proposal';
import type { EvolvingCoachValues } from '../../types/evolving-coach';
/** Version de politique, indépendante du numéro de version de l'application. */
export const COACH_POLICY_VERSION = 1 as const;
/** Repères techniques/éditoriaux hérités de 4A bis, provisoires : voir PROPOSALS.md. */
export const EDITORIAL_TUNING = Object.freeze({
  horizonDays:14, rhythmIntervals:8, recentCycles:4, staleCycles:2,
  minimumSuggestionSeconds:300, freshCycles:1, maximumDurationSpread:0.5, maximumGapSpread:1,
});
/** Valeurs validées produit : première sortie de 30 minutes maximum, reprise de 20 minutes. */
export function productPolicy(goal: EvolvingCoachValues['goal']['kind']): ProposalPolicy {
  const t=EDITORIAL_TUNING;
  const simple = ['endurance','speed','distance','race'].includes(goal);
  return {
    horizonDays:t.horizonDays,evidenceAgeLimitDays:180,rhythmIntervals:t.rhythmIntervals,recentCycles:t.recentCycles,staleCycles:t.staleCycles,minimumSuggestionSeconds:simple?1800:t.minimumSuggestionSeconds,
    ...(simple ? {} : {discoverySeconds:goal==='return'?1200:1800}),
    duration:{minimumReferences:simple?3:4,freshCycles:t.freshCycles,maximumDurationSpread:t.maximumDurationSpread,maximumGapSpread:t.maximumGapSpread,supportedFraction:0.8,cautiousFraction:0.5,cautiousMaximumSeconds:2700},
  };
}
