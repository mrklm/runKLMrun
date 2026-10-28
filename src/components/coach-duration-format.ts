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
