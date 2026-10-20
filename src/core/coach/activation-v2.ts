/** Interrupteur de rollback livré : le retour à V1 exige une modification de code. */
export const COACH_V2_PUBLIC_DEPLOYMENT_ENABLED=true;
/** Comparateur réservé au développement, fermé dans les livraisons publiques. */
export const COACH_V2_INTERNAL_COMPARISON_ENABLED=false;

export type CoachV2ActivationMode='off'|'internal'|'public';

export function coachV2ActivationMode(publicDeploymentEnabled=COACH_V2_PUBLIC_DEPLOYMENT_ENABLED):CoachV2ActivationMode {
  if(publicDeploymentEnabled)return 'public';
  return 'off';
}

export const coachV2Enabled=()=>coachV2ActivationMode()!=='off';
export const coachV2PublicEnabled=()=>coachV2ActivationMode()==='public';
