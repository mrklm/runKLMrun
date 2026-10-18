import type { CoachProposal, SessionSuggestion } from '../types/coach-proposal';
import type { CoachProfile } from '../types/coach-profile';

/** Présentation seulement : unités nulles omises, secondes et fractions conservées. */
export function formatCoachDuration(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '—';
  const hours=Math.floor(value/3600), minutes=Math.floor(value/60)%60, seconds=Math.floor(value%60);
  const decimal=value.toLocaleString('en-US',{useGrouping:false,maximumFractionDigits:20}).split('.')[1];
  const remainder=`${seconds}${decimal?`,${decimal}`:''}`;
  return [hours?`${hours} h`:'',minutes?`${minutes} min`:'',seconds || decimal?`${remainder} s`:''].filter(Boolean).join(' ') || '0 s';
}
/** Pour les messages textuels existants, sans modifier le diagnostic source. */
export function formatCoachDurationText(text: string): string {
  const readable = text.replace(/Après arrondi inférieur par pas de 5 minutes, durée inférieure au minimum éditorial fourni \((\d+) s\), sans dépassement du plafond\./g, 'Vos sorties récentes ou vos disponibilités ne permettent pas de proposer une séance d’au moins $1 s.');
  // Seuls les champs de durée des messages connus sont convertis, pas tout nombre suivi de « s ».
  const durations = readable.replace(/(minimum éditorial de |médiane observée |maximum proposé(?: avant disponibilité)? |plafond prudent |chrono déclaré : |durée de découverte fournie par la politique : |durée réduite à |référence V2 |référence fournie : |séance d’au moins |maximum |repère )(\d+(?:[.,]\d+)?) s\b/gi,
    (_match,prefix:string,value:string)=>prefix+formatCoachDuration(Number(value.replace(',','.'))));
  return durations.replace(/^(\d+(?:[.,]\d+)?) minutes (?=faciles|en aisance)/,
    (_match,value:string)=>`${formatCoachDuration(Number(value.replace(',','.'))*60)} `);
}
export interface CoachExplanation { title: string; text: string }
/** Projection d'affichage : ne recalcule ni la date, ni la durée, ni les seuils du moteur. */
export function coachExplanations(proposal: CoachProposal, suggestion: SessionSuggestion, profile?: CoachProfile): CoachExplanation[] {
  const e=proposal.evidence, basis=suggestion.durationBasis, terrain=suggestion.recommendedTerrain;
  const available=!!profile?.availability.days?.length;
  const rhythm=e.medianGapDays===null
    ? `${e.possibleGap?'Les séances enregistrées ne donnent plus de repère de rythme actuel.':'Votre rythme actuel n’est pas suffisamment documenté.'}${available?' La date proposée utilise vos jours disponibles.':''}`
    : `Les sorties récentes enregistrées sont espacées d’environ ${e.medianGapDays.toLocaleString('fr-FR')} jours.${available?' La date proposée tient compte de ce rythme, de votre fréquence souhaitée si elle est renseignée et de vos jours disponibles.':''}`;
  const chosen=formatCoachDuration(suggestion.durationSeconds);
  const capped=basis.availableMaximumSeconds!==null && basis.availableMaximumSeconds<basis.proposedMaximumSeconds;
  const partial=e.knownDurations<(e.horizons.find(h=>h.kind==='recent')?.sessionIds.length??0);
  const observed=basis.observedMedianSeconds;
  // Approximation de langage uniquement ; le diagnostic conserve la médiane exacte.
  const approximateMinutes = observed === null ? null : Math.round(observed / 60);
  const usual = approximateMinutes === 0 ? 'quelques secondes' : `${approximateMinutes} minute${approximateMinutes === 1 ? '' : 's'}`;
  const duration=observed===null
    ? `Sans durée récente de référence, le Coach propose une sortie de découverte de ${chosen}.${capped?` Votre disponibilité de ${formatCoachDuration(basis.availableMaximumSeconds!)} limite aussi cette proposition.`:''}`
    : `Vos sorties récentes${partial?' dont la durée est connue':''} durent généralement autour de ${usual}. Le Coach vous propose ${chosen} pour cette séance${capped?`, en tenant compte de votre disponibilité de ${formatCoachDuration(basis.availableMaximumSeconds!)}`:''}.`;
  const surface={road:'la route',trail:'les chemins',treadmill:'le tapis',none:''}[terrain.surface];
  const surfaceText=surface
    ? suggestion.terrainPreference && suggestion.terrainPreference!=='none'?`Votre préférence pour ${surface} est conservée.`:`Les séances récentes renseignées indiquent ${surface}.`
    : 'Aucune surface particulière n’est imposée faute de préférence ou de données concordantes.';
  return [
    {title:'Votre rythme',text:rhythm},
    {title:'La durée',text:duration},
    {title:'L’intensité',text:'L’effort reste facile, sans allure chiffrée ni fréquence cardiaque cible faute de calibration individuelle.'},
    {title:'Le terrain',text:`${surfaceText} ${terrain.relief==='flat-or-gentle'?'Un terrain plat ou peu vallonné est conseillé pour cette sortie.':'Le relief reste libre.'}`},
  ];
}
/** Les diagnostics initiaux restent stockés ; seules les alertes d'échéance sont rappelées ici. */
export function originalPlanningWarnings(explanation: string): string[] {
  return explanation.split('\n').filter(line=>line.startsWith('Échéance déclarée')).map(formatCoachDurationText);
}
