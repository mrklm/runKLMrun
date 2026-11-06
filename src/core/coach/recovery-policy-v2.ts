import { validSessionDate } from '../analysis/session-summary';
import { isDocumentedActivityType } from '../../types/session';
import type { PrototypeSessionType } from './simulation/session-strategies-v2';
import type { OptionalSessionFeeling } from '../../types/evolving-coach';

export interface RecoveryTimingV2 {
  minimumDaysAfterActivity:number;
  structuredActivityGapDays:number;
  longActivityGapDays:number;
}
/** Valeurs historiques. Le paramétrage reste réservé aux simulations existantes. */
export const RECOVERY_TIMING_V2:Readonly<RecoveryTimingV2>=Object.freeze({
  minimumDaysAfterActivity:2,structuredActivityGapDays:14,longActivityGapDays:10,
});
/** Fenêtre éditoriale temporaire, pas une estimation physiologique de récupération. */
export const FEELING_PREFERENCE_WINDOW_DAYS=7;
export const STRUCTURED_RECOVERY_TYPES_V2:readonly PrototypeSessionType[]=Object.freeze(['intervals','steady-run','hills','endurance-variations']);
export const isStructuredRecoveryTypeV2=(type:PrototypeSessionType|null|undefined)=>type!=null&&STRUCTURED_RECOVERY_TYPES_V2.includes(type);
export type RecoveryScopeV2='all'|'structured'|'long-run';
export const recoveryScopeV2=(type:PrototypeSessionType):RecoveryScopeV2=>
  type==='easy-endurance'||type==='recovery'?'all':type==='long-run'?'long-run':'structured';
export interface RecoveryActivityV2 {
  id?:string;date:string;documentedType?:PrototypeSessionType|null;effort?:OptionalSessionFeeling['effort']|null;
}
export interface RecoverySourceV2 {
  kind:'activity'|'intention';id:string|null;date:string;
  documentedType:PrototypeSessionType|null;effort:OptionalSessionFeeling['effort']|null;
}
export type RecoveryProtectionCodeV2='minimum-rest'|'structured-gap'|'long-run-gap'|'very-hard-protection';
export interface RecoveryProtectionV2 {
  code:RecoveryProtectionCodeV2;scope:RecoveryScopeV2|'demanding';status:'deferred';
  days:number;notBefore:string;sources:RecoverySourceV2[];explanation:string;
}
export interface RecoveryGateV2 {
  scope:RecoveryScopeV2;status:'admissible'|'deferred';notBefore:string|null;
  protections:RecoveryProtectionCodeV2[];sources:RecoverySourceV2[];
}
const DAY=86400000;
const day=(date:string)=>Date.parse(`${date}T00:00:00Z`)/DAY;
const addDays=(date:string,days:number)=>new Date((day(date)+days)*DAY).toISOString().slice(0,10);
const sourceKey=(value:RecoverySourceV2)=>JSON.stringify(value);
const orderedUnique=(values:readonly RecoverySourceV2[])=>[...new Map(values.map(value=>[sourceKey(value),value])).values()]
  .sort((a,b)=>a.date.localeCompare(b.date)||(a.id??'').localeCompare(b.id??'')||sourceKey(a).localeCompare(sourceKey(b)));
const explanations:Record<RecoveryProtectionCodeV2,string>={
  'minimum-rest':'Deux jours civils minimum après toute activité réelle, même sans durée.',
  'structured-gap':'Espacement existant de quatorze jours après un type structuré déclaré.',
  'long-run-gap':'Espacement existant de dix jours après une sortie longue déclarée.',
  'very-hard-protection':'Pendant sept jours, privilégier le facile ; sans option facile admissible, aucune séance exigeante.',
};

/** Source commune des protections, pas une mesure physiologique. Les appelants
 * fournissent leurs preuves admissibles D1/D2a : aucun sport ou lien n'est inféré.
 * Les inconnues restent explicites sans ajouter d'interdiction ; les préférences
 * liées au volume et à la qualité restent du ressort de D2.
 * Les intentions servent uniquement à espacer les choix de la projection.
 */
export function evaluateRecoveryV2(input:{referenceDate:string;activities:readonly RecoveryActivityV2[];
  intentions?:readonly {date:string;type:PrototypeSessionType}[];parameters?:RecoveryTimingV2}) {
  const parameters=input.parameters??RECOVERY_TIMING_V2;
  if(!validSessionDate(input.referenceDate)||Object.values(parameters).some(value=>!Number.isSafeInteger(value)||value<0)
    ||[...input.activities,...(input.intentions??[])].some(value=>!validSessionDate(value.date)))throw new Error('Entrée de récupération V2 invalide.');
  const activities=orderedUnique(input.activities.map(value=>({kind:'activity',id:typeof value.id==='string'&&value.id.trim()?value.id:null,
    date:value.date,documentedType:isDocumentedActivityType(value.documentedType)?value.documentedType:null,
    effort:value.effort==='easy'||value.effort==='moderate'||value.effort==='hard'||value.effort==='very-hard'?value.effort:null})));
  const intentions=orderedUnique((input.intentions??[]).map(value=>({kind:'intention',id:null,date:value.date,
    documentedType:value.type,effort:null})));
  const known=activities.filter(value=>value.date<=input.referenceDate);
  const planned=intentions.filter(value=>value.date<=input.referenceDate);
  const inWindow=(values:RecoverySourceV2[],days:number)=>values.filter(value=>day(input.referenceDate)-day(value.date)<days);
  const protections:RecoveryProtectionV2[]=[];
  const protect=(code:RecoveryProtectionCodeV2,scope:RecoveryProtectionV2['scope'],days:number,sources:RecoverySourceV2[])=>{
    const active=orderedUnique(inWindow(sources,days));if(!active.length)return;
    const notBefore=active.map(value=>addDays(value.date,days)).sort().at(-1)!;
    // Le texte historique D2 reste inchangé pour les valeurs de production.
    const explanation=active.some(value=>value.kind==='intention')
      ? `Espacement de ${days} jours civils pour ce périmètre ; les intentions ne constituent pas des activités réalisées.`
      :days===RECOVERY_TIMING_V2.minimumDaysAfterActivity&&code==='minimum-rest'
        ||days===RECOVERY_TIMING_V2.structuredActivityGapDays&&code==='structured-gap'
        ||days===RECOVERY_TIMING_V2.longActivityGapDays&&code==='long-run-gap'||code==='very-hard-protection'
        ?explanations[code]:`Espacement de simulation : ${days} jours civils.`;
    protections.push({code,scope,status:'deferred',days,notBefore,sources:active,explanation});
  };
  protect('minimum-rest','all',parameters.minimumDaysAfterActivity,[...known,...planned]);
  protect('structured-gap','structured',parameters.structuredActivityGapDays,[...known,...planned].filter(value=>isStructuredRecoveryTypeV2(value.documentedType)));
  protect('long-run-gap','long-run',parameters.longActivityGapDays,[...known,...planned].filter(value=>value.documentedType==='long-run'));
  protect('very-hard-protection','demanding',FEELING_PREFERENCE_WINDOW_DAYS,known.filter(value=>value.effort==='very-hard'));
  const difficult=inWindow(known.filter(value=>value.effort==='hard'||value.effort==='very-hard'),FEELING_PREFERENCE_WINDOW_DAYS);
  const latest=[...difficult].sort((a,b)=>b.date.localeCompare(a.date)||(a.effort===b.effort?0:a.effort==='very-hard'?-1:1))[0];
  const gate=(scope:RecoveryScopeV2,includeFeeling:boolean):RecoveryGateV2=>{
    const relevant=protections.filter(value=>value.scope==='all'||value.scope===scope
      ||includeFeeling&&scope!=='all'&&value.scope==='demanding');
    return {scope,status:relevant.length?'deferred':'admissible',notBefore:relevant.map(value=>value.notBefore).sort().at(-1)??null,
      protections:relevant.map(value=>value.code),sources:orderedUnique(relevant.flatMap(value=>value.sources))};
  };
  const byId=new Map<string,RecoverySourceV2[]>();
  for(const source of known)if(source.id){const group=byId.get(source.id)??[];group.push(source);byId.set(source.id,group);}
  return {policyVersion:'recovery-v2-fixed-1' as const,referenceDate:input.referenceDate,parameters:{...parameters},protections,
    gates:{all:gate('all',true),structured:gate('structured',true),longRun:gate('long-run',true)},
    // Étape d'espacement séparée pour préserver l'ordre historique de classement
    // et ses explications. Le ressenti est ensuite appliqué, jamais abandonné.
    spacing:{all:gate('all',false),structured:gate('structured',false),longRun:gate('long-run',false)},
    preference:{status:difficult.length?'prefer-easy' as const:'unchanged' as const,scope:'demanding' as const,
      days:FEELING_PREFERENCE_WINDOW_DAYS,until:difficult.map(value=>addDays(value.date,FEELING_PREFERENCE_WINDOW_DAYS)).sort().at(-1)??null,
      sources:difficult,latest:latest??null,
      explanation:'Ressenti difficile dans la fenêtre existante de sept jours : préférer une option facile admissible.',
      latestExplanation:latest?`Séance facile privilégiée plutôt qu’une séance exigeante : la course du ${latest.date.split('-').reverse().join('/')} a été ressentie comme ${latest.effort==='very-hard'?'très difficile':'difficile'}, dans la fenêtre de sept jours examinée.`:null},
    quality:{missingIds:known.filter(value=>value.id===null),unknownTypes:known.filter(value=>value.documentedType===null),
      unknownEfforts:known.filter(value=>value.effort===null),conflictingIds:[...byId].filter(([,group])=>group.length>1).map(([id])=>id).sort(),
      ignoredFutureSources:orderedUnique([...activities,...intentions].filter(value=>value.date>input.referenceDate))},
    limitations:['Admissible signifie seulement non bloqué par ces protections ; aucune recommandation n’est garantie.',
      'Les types et ressentis inconnus ne sont pas déduits des prescriptions ; les diagnostics D2 restent distincts.',
      'Les intentions ne constituent ni une activité, ni une confirmation, ni une preuve de tolérance.',
      'Les contradictions restantes ne sont pas arbitrées : leurs protections connues se cumulent. La validation des sources reste en amont.'],
  };
}
export type RecoveryDecisionV2=ReturnType<typeof evaluateRecoveryV2>;
