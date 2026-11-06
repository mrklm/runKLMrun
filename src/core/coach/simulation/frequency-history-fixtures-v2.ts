import type { RecordedActivityEvidence } from './session-orchestrator-v2';
import type { ReferenceBootstrapResult } from '../reference-bootstrap-v2';
export const FREQUENCY_STUDY_DATE_V2='2026-11-05';
export const frequencyStudyDateV2=(age:number)=>new Date(Date.parse(`${FREQUENCY_STUDY_DATE_V2}T00:00:00Z`)-age*86400000).toISOString().slice(0,10);
export const FREQUENCY_STUDY_REFERENCE_V2:ReferenceBootstrapResult={policy:'hybrid',available:true,confidence:'confirmed',freshness:'current',referenceSeconds:1800,
  sourceIds:['synthetic-reference'],reasons:[],excluded:[],artificialDecreaseRisk:false};
export function frequencyHistoryRowsV2(days:number,gap?:number,type:RecordedActivityEvidence['documentedType']='intervals'):RecordedActivityEvidence[] {
  const ages=new Set<number>();for(let age=2;age<days;age+=3)ages.add(age);
  if(gap)for(let age=2;age<days;age+=gap)ages.add(age);
  return [...ages].sort((a,b)=>b-a).map(age=>({id:`run-${age}`,date:frequencyStudyDateV2(age),durationSeconds:1800,distanceMeters:5000,
    documentedType:gap&&(age-2)%gap===0?type:'easy-endurance',effort:'moderate'}));
}
export function frequencyHistoryScenariosV2():{id:string;activities:RecordedActivityEvidence[];note:string}[]{
  const base=()=>frequencyHistoryRowsV2(84,12);
  let structuredIndex=0;
  return [
    {id:'beginner-28',activities:frequencyHistoryRowsV2(28),note:'Quatre semaines enregistrées, aucune expérience exigeante déclarée.'},
    {id:'regular-28',activities:frequencyHistoryRowsV2(28,12),note:'Les fenêtres longues contiennent les mêmes trois structurées, pas une expérience plus longue.'},
    {id:'regular-56',activities:frequencyHistoryRowsV2(56,12),note:'La fenêtre 84 ne crée aucune observation antérieure à cet historique.'},
    {id:'regular-84',activities:base(),note:'Plusieurs intervalles de 12 jours répartis sur trois blocs ; pas une récupération démontrée.'},
    {id:'structured-12',activities:base(),note:'L’hypothèse B reproduit ici un espacement effectivement répété.'},
    {id:'structured-14',activities:frequencyHistoryRowsV2(84,14),note:'Douze jours seraient une fréquence supérieure à celle enregistrée.'},
    {id:'structured-7',activities:frequencyHistoryRowsV2(84,7),note:'Douze jours seraient plus espacés ; la fréquence élevée ne valide pas sa tolérance.'},
    {id:'long-9',activities:frequencyHistoryRowsV2(84,9,'long-run'),note:'Neuf jours sont observés plusieurs fois, sans éligibilité automatique.'},
    {id:'long-10',activities:frequencyHistoryRowsV2(84,10,'long-run'),note:'Neuf jours restent une accélération par rapport aux dix jours observés.'},
    {id:'high-frequency-growing',activities:frequencyHistoryRowsV2(84,7).map(value=>({...value,durationSeconds:value.date>=frequencyStudyDateV2(6)?3600:1800})),note:'Fréquence documentée avec hausse récente : cohérence historique ne neutralise pas la charge.'},
    {id:'high-frequency-hard',activities:frequencyHistoryRowsV2(84,7).map(value=>value.id==='run-2'?{...value,effort:'hard' as const}:value),note:'Le hard récent reste un signal défavorable, quelle que soit la profondeur.'},
    {id:'unknown-efforts',activities:base().map(value=>({...value,effort:undefined})),note:'Répétition identifiable, ressenti inconnu ; ne pas assimiler silence et tolérance.'},
    {id:'concentrated-demanding',activities:frequencyHistoryRowsV2(84).map(value=>value.date>=frequencyStudyDateV2(20)?{...value,documentedType:'intervals' as const}:value),note:'Une série régulière à trois jours n’occupe qu’un bloc récent de 28 jours.'},
    {id:'mixed-close',activities:[...base(),...Array.from({length:10},(_,index)=>({id:`long-${index}`,date:frequencyStudyDateV2(3+index*9),durationSeconds:2700,
      documentedType:'long-run' as const,effort:'moderate' as const}))],note:'Deux fréquences régulières peuvent produire des jours mixtes et des intervalles globaux courts.'},
    {id:'return-after-gap',activities:base().filter(value=>value.date<=frequencyStudyDateV2(56)||value.date>=frequencyStudyDateV2(8)),note:'Les intervalles anciens et la lacune restent visibles ; interruption réelle ou défaut de saisie non départagés.'},
    {id:'incomplete-history',activities:base().map(value=>value.id==='run-14'?{...value,documentedType:undefined,effort:undefined,durationSeconds:undefined}:value),note:'La disparition du type transforme deux intervalles de 12 jours en un intervalle apparent de 24 jours.'},
    {id:'corrected-activity',activities:base().map(value=>value.id==='run-14'?{...value,documentedType:'easy-endurance' as const}:value),note:'Le type réel corrigé retire une expérience structurée sans supprimer l’activité globale.'},
    {id:'deleted-activity',activities:base().filter(value=>value.id!=='run-14'),note:'Une suppression change fréquence globale et structurée, sans état historique conservé.'},
    {id:'future-activity',activities:[...base(),{id:'future',date:frequencyStudyDateV2(-1),durationSeconds:9999,documentedType:'hills' as const,effort:'very-hard' as const}],note:'L’activité future est exclue de chaque horizon et du contexte présent.'},
    {id:'alternating-structured',activities:base().map(value=>value.documentedType==='intervals'?{...value,documentedType:(['intervals','steady-run','hills','endurance-variations'] as const)[structuredIndex++%4]}:value),note:'Les quatre familles sont regroupées ; changer d’étiquette ne crée pas quatre historiques indépendants.'},
    {id:'slower-than-current',activities:frequencyHistoryRowsV2(84,18),note:'Une pratique à 18 jours ne documente pas une fréquence de 12 jours.'},
    {id:'variable-gaps',activities:frequencyHistoryRowsV2(84).map(value=>[83,65,44,35,14,2].some(age=>frequencyStudyDateV2(age)===value.date)?{...value,documentedType:'intervals' as const}:value),note:'Intervalles variables : aucune fréquence unique ne résume le dossier.'},
    {id:'very-hard-recent',activities:base().map(value=>value.id==='run-2'?{...value,effort:'very-hard' as const}:value),note:'La protection de sept jours reste active, même avec six intervalles de 12 jours.'},
    {id:'growing-and-concentrated',activities:[...base().map(value=>value.id==='run-2'?{...value,durationSeconds:3600}:value),
      {id:'recent-extra',date:frequencyStudyDateV2(1),durationSeconds:3600,documentedType:'long-run' as const,effort:'moderate' as const}],note:'Hausse et concentration concordantes D2 : aucune répétition historique ne peut les effacer.'},
  ];
}
