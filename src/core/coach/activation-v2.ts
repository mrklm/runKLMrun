export const COACH_V2_INTERNAL_KEY='runklmrun:coach-v2-internal';

/** Interrupteur de déploiement volontairement fermé. Son activation future exige
 * une modification livrée et relue ; aucune commande navigateur ne peut l'ouvrir. */
export const COACH_V2_PUBLIC_DEPLOYMENT_ENABLED=false;

export type CoachV2ActivationMode='off'|'internal'|'public';

export function coachV2ActivationMode():CoachV2ActivationMode {
  if(COACH_V2_PUBLIC_DEPLOYMENT_ENABLED)return 'public';
  return import.meta.env.DEV&&typeof localStorage!=='undefined'&&localStorage.getItem(COACH_V2_INTERNAL_KEY)==='enabled'
    ?'internal':'off';
}

export const coachV2Enabled=()=>coachV2ActivationMode()!=='off';
export const coachV2PublicEnabled=()=>coachV2ActivationMode()==='public';
