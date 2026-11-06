import { analyzeVolumeObservationsV2 } from '../volume-observations-v2';
import { analyzeTrainingHabitsV2 } from '../training-habits-v2';
import { analyzeRecentLoadV2 } from '../recent-load-v2';
import { evaluateSpacingEligibilityV2 } from '../spacing-eligibility-v2';
import { evaluateRecoveryV2,RECOVERY_TIMING_V2 } from '../recovery-policy-v2';
import { interpretRecentLoadV2 } from '../load-adaptation-policy-v2';

export interface SpacingHypothesisV2 {
  id:string;
  structuredDays:number;
  longRunDays:number;
  /** Dimension expérimentale indépendante, jamais appliquée à une séance réelle. */
  durationIncreaseSeconds:number;
}
type EvidenceInput=Parameters<typeof analyzeTrainingHabitsV2>[0];

/** Laboratoire D4d seulement. Aucun import depuis un chemin applicatif.
 * Les hypothèses sont explicites ; les délais 2 et 7 restent ceux de D4b.
 * Une levée théorique ne représente jamais une recommandation calculée.
 */
export function simulateSpacingHypothesesV2(input:EvidenceInput & {
  hypotheses:readonly SpacingHypothesisV2[];
  /** Facultatif, explicite, sans valeur par défaut ni effet sur D4c. */
  relativeVolumeTolerance?:number;
}) {
  const tolerance=input.relativeVolumeTolerance;
  if(tolerance!==undefined&&(!Number.isFinite(tolerance)||tolerance<0))throw new Error('Tolérance expérimentale invalide.');
  if(new Set(input.hypotheses.map(value=>value.id)).size!==input.hypotheses.length)throw new Error('Identifiants d’hypothèses dupliqués.');
  for(const value of input.hypotheses)if(!value.id.trim()
    ||!Number.isSafeInteger(value.structuredDays)||value.structuredDays<RECOVERY_TIMING_V2.minimumDaysAfterActivity||value.structuredDays>RECOVERY_TIMING_V2.structuredActivityGapDays
    ||!Number.isSafeInteger(value.longRunDays)||value.longRunDays<RECOVERY_TIMING_V2.minimumDaysAfterActivity||value.longRunDays>RECOVERY_TIMING_V2.longActivityGapDays
    ||!Number.isSafeInteger(value.durationIncreaseSeconds)||value.durationIncreaseSeconds<0)
    throw new Error('Hypothèse d’espacement invalide.');
  const load=analyzeRecentLoadV2(input),eligibility=evaluateSpacingEligibilityV2(input);
  // Les activités futures au jour de l'étude restent exclues de toutes les variantes.
  const current=evaluateRecoveryV2({referenceDate:input.referenceDate,activities:load.activities});
  const d2=interpretRecentLoadV2(load);
  const volume=analyzeVolumeObservationsV2(input);
  const scope=(decision:typeof current,family:'structured'|'longRun')=>({
    ...decision.gates[family],firstUnblockedDate:decision.gates[family].notBefore??input.referenceDate,
  });
  const variants=input.hypotheses.map(hypothesis=>{
    const theoretical=evaluateRecoveryV2({referenceDate:input.referenceDate,activities:load.activities,
      parameters:{...RECOVERY_TIMING_V2,structuredActivityGapDays:hypothesis.structuredDays,longActivityGapDays:hypothesis.longRunDays}});
    const family=(key:'structured'|'longRun')=>({
      d4c:eligibility[key].conclusion,
      current:scope(current,key),theoretical:scope(theoretical,key),
      // Contrefactuel mécanique : ni sélection, ni validation finale. D2 reste exposé séparément.
      withD4cFilter:scope(eligibility[key].conclusion==='candidate'?theoretical:current,key),
      preventingReasons:[...eligibility[key].unfavorable,...eligibility[key].missing].map(value=>value.code),
    });
    return {hypothesis:{...hypothesis},structured:family('structured'),longRun:family('longRun'),
      interactions:{bothGapsReduced:hypothesis.structuredDays<RECOVERY_TIMING_V2.structuredActivityGapDays&&hypothesis.longRunDays<RECOVERY_TIMING_V2.longActivityGapDays,
        gapAndDurationIncrease:hypothesis.durationIncreaseSeconds>0&&(hypothesis.structuredDays<RECOVERY_TIMING_V2.structuredActivityGapDays||hypothesis.longRunDays<RECOVERY_TIMING_V2.longActivityGapDays),
        observedCrossFamily:eligibility.structured.interactions},
      preference:theoretical.preference};
  });
  return {studyVersion:'d4d-1' as const,referenceDate:input.referenceDate,eligibility,current,d2,variants,
    volume:{...volume,relativeToPriorMedian:{...volume.relativeToPriorMedian,explicitTolerance:tolerance??null,
      withinExplicitTolerance:tolerance===undefined||volume.relativeToPriorMedian.relativeChange===null
        ?null:Math.abs(volume.relativeToPriorMedian.relativeChange)<=tolerance}},
    limitations:[
      'Étude des seules protections temporelles ; les variantes ne rejouent pas le classement, le catalogue ou D3c.',
      'Le filtre D4c est figé au jour examiné ; les dates de levée ne prédisent pas une candidature future.',
      'Les intentions et perspectives ne font pas partie des preuves acceptées.',
      'Les volumes partiels restent des sommes connues, sans extrapolation ni déclaration de stabilité.',
      'Les alertes de cumul identifient des dimensions simultanées, sans quantifier leur risque physiologique.',
      'Aucune option n’est choisie et aucune valeur n’est appliquée au Coach.',
    ]};
}
