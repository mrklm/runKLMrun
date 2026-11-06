/** Données synthétiques du laboratoire D4d, jamais chargées par l'application. */
import type { RecordedActivityEvidence } from './session-orchestrator-v2';
import type { ReferenceBootstrapResult } from '../reference-bootstrap-v2';
import type { SpacingHypothesisV2 } from './spacing-calibration-v2';
export const CALIBRATION_DATE_V2='2026-11-05';
export const calibrationDateV2=(age:number)=>new Date(Date.parse(`${CALIBRATION_DATE_V2}T00:00:00Z`)-age*86400000).toISOString().slice(0,10);
export const CALIBRATION_REFERENCE_V2:ReferenceBootstrapResult={policy:'hybrid',available:true,confidence:'confirmed',freshness:'current',referenceSeconds:1800,
  sourceIds:['run-27','run-24','run-20','run-17','run-13','run-10','run-6','run-3'],reasons:[],excluded:[],artificialDecreaseRisk:false};
export const CALIBRATION_HYPOTHESES_V2:readonly SpacingHypothesisV2[]=[14,12,10].flatMap(structuredDays=>[10,9,7].map(longRunDays=>({
  id:`${structuredDays}/${longRunDays}`,structuredDays,longRunDays,durationIncreaseSeconds:0,
}))).concat([{id:'12/9+300s',structuredDays:12,longRunDays:9,durationIncreaseSeconds:300}]);
const base=():RecordedActivityEvidence[]=>[27,24,20,17,13,10,6,3].map(age=>({id:`run-${age}`,date:calibrationDateV2(age),durationSeconds:1800,
  distanceMeters:5000,documentedType:age===24||age===10?'intervals':'easy-endurance',effort:'moderate'}));
const change=(id:string,patch:Partial<RecordedActivityEvidence>)=>base().map(value=>value.id===id?{...value,...patch}:value);
export interface CalibrationScenarioV2 {id:string;activities:RecordedActivityEvidence[];risk:string;condition:string;perspectives?:{date:string;type:'intervals'}[]}
export function spacingCalibrationScenariosV2():CalibrationScenarioV2[] {
  return [
    {id:'slight-variation',activities:change('run-3',{durationSeconds:1860}),risk:'Une minute de plus suffit au maintien D4c, sans preuve de surcharge.',condition:'Revoir la définition descriptive du volume avant tout assouplissement.'},
    {id:'equal-volume',activities:base(),risk:'Deux dates structurées ne documentent qu’un seul intervalle.',condition:'Candidate ne remplace pas une validation sportive.'},
    {id:'high-volume',activities:base().map(value=>({...value,durationSeconds:18000})),risk:'Égalité à un niveau dix fois plus élevé : D4c ne détecte pas un excès absolu.',condition:'Comprendre le niveau individuel et la charge exigeante avant adaptation.'},
    {id:'beginner',activities:base().slice(-1),risk:'Une activité ne documente ni régularité ni expérience du groupe.',condition:'Conserver les délais faute de données.'},
    {id:'return',activities:[{...base()[0],date:calibrationDateV2(60)},base().at(-1)!],risk:'Une longue lacune peut être une interruption ou un défaut de saisie.',condition:'Documenter la reprise sans inférer un repos acquis.'},
    {id:'regular-intervals',activities:base(),risk:'Respect du délai actuel, pas démonstration de capacité à le raccourcir.',condition:'Expérience historique plus étendue nécessaire à une décision future.'},
    {id:'partial-hard',activities:base().map(value=>({...value,documentedType:value.id==='run-24'||value.id==='run-6'?'intervals':'easy-endurance',
      ...(value.id==='run-6'?{durationSeconds:900,effort:'hard',confirmedRealization:{occurrenceId:'synthetic',result:'partial'}}:{})})),risk:'Le ressenti et la durée réelle comptent, pas un échec présumé du partiel.',condition:'Ne pas assouplir en présence du ressenti défavorable.'},
    {id:'completed-very-hard',activities:base().map(value=>({...value,documentedType:value.id==='run-24'||value.id==='run-6'?'intervals':'easy-endurance',
      ...(value.id==='run-6'?{effort:'very-hard',confirmedRealization:{occurrenceId:'synthetic',result:'completed'}}:{})})),risk:'Completed ne neutralise pas very-hard.',condition:'Conserver la protection de sept jours et le maintien D4c.'},
    {id:'repeated-long',activities:base().map(value=>({...value,documentedType:value.id==='run-17'||value.id==='run-6'?'long-run':'easy-endurance'})),risk:'Deux sorties longues ne mesurent pas leur coût individuel.',condition:'Évaluation séparée des longues ; aucun transfert depuis les intervalles.'},
    {id:'alternating-families',activities:base().map((value,index)=>({...value,documentedType:(['intervals','steady-run','hills','endurance-variations'] as const)[index]??'easy-endurance'})),risk:'L’alternance masque une densité élevée si les familles sont dissociées.',condition:'Garder les quatre familles dans le même groupe.'},
    {id:'close-long-structured',activities:change('run-13',{date:calibrationDateV2(11),documentedType:'long-run'}),risk:'Une longue un jour avant le structuré : interaction documentée.',condition:'Ne pas relâcher les protections avec un croisement rapproché.'},
    {id:'volume-increase',activities:change('run-3',{durationSeconds:3600}),risk:'Hausse de 50 % entre semaines, sans concentration D2 concomitante.',condition:'Absence de préférence D2 ne suffit pas : maintien D4c.'},
    {id:'no-effort',activities:base().map(value=>({...value,effort:undefined})),risk:'Pas de ressenti ne signifie pas bonne récupération.',condition:'Compléter les observations, sans imputation favorable.'},
    {id:'partial-coverage',activities:change('run-3',{durationSeconds:undefined}),risk:'Somme connue sous-estimée, ratio potentiellement trompeur.',condition:'Ne pas qualifier le volume de stable.'},
    {id:'corrected-effort',activities:change('run-10',{effort:'moderate'}),risk:'La correction retire le motif lié à un ancien hard ; elle ne prouve pas la récupération.',condition:'Recalculer depuis l’instantané courant, jamais conserver une ancienne éligibilité.'},
    {id:'deleted-review',activities:change('run-10',{effort:undefined,documentedType:undefined}),risk:'Suppression du bilan laisse des inconnues, pas une séance facile.',condition:'Maintenir les inconnues et la candidature insuffisante.'},
    {id:'future-perspectives',activities:base(),perspectives:[{date:calibrationDateV2(-2),type:'intervals'}],risk:'Une perspective ne peut servir de preuve d’expérience.',condition:'Les intentions restent hors des entrées du simulateur.'},
    {id:'no-family-practice',activities:base().map(value=>({...value,documentedType:'easy-endurance'})),risk:'Aucun blocage temporel malgré aucune expérience exigeante.',condition:'Insufficient-data interdit de déduire une candidature de portes ouvertes.'},
    {id:'joint-candidate',activities:base().map(value=>value.id==='run-20'||value.id==='run-6'?{...value,documentedType:'long-run'}:value),risk:'Les deux groupes peuvent être candidate simultanément ; les cumuls futurs ne sont pas contrôlés par D4c.',condition:'Étudier un garde-fou commun de densité sans créer implicitement un délai partagé.'},
    {id:'omitted-record',activities:base().filter(value=>value.id!=='run-27'),risk:'Une activité omise sans diagnostic peut rester indétectable et laisser candidate.',condition:'La couverture des champs ne garantit jamais l’exhaustivité de la pratique.'},
    {id:'decreased-volume',activities:change('run-3',{durationSeconds:1740}),risk:'Une minute de moins devient insuffisante, sans signal défavorable.',condition:'Distinguer baisse, stabilité non démontrée et récupération.'},
    {id:'deleted-activity',activities:base().filter(value=>value.id!=='run-24'),risk:'La suppression retire la seule répétition structurée.',condition:'Recalculer l’expérience sans mémoire persistante.'},
    {id:'old-hard',activities:change('run-10',{effort:'hard'}),risk:'Hard à J-10 a quitté D4b mais maintient D4c sur 28 jours.',condition:'Ne pas confondre fenêtre historique descriptive et délai de récupération.'},
  ];
}
