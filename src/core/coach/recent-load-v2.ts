import type { RecordedActivityEvidence } from './simulation/session-orchestrator-v2';
import type { ReferenceBootstrapResult } from './reference-bootstrap-v2';
import { validSessionDate } from '../analysis/session-summary';
import { isDocumentedActivityType } from '../../types/session';
import { effortLabels } from '../analysis/session-feeling';

export interface LoadMeasurementV2 {
  /** Somme des seules mesures connues ; null si des activités existent mais aucune mesure n'est connue. */
  knownTotal:number|null;
  knownCount:number;
  unknownCount:number;
  overflow:boolean;
}
export interface LoadWindowV2 {
  days:number;
  from:string;
  through:string;
  activityIds:string[];
  activityCount:number;
  activeDays:number;
  maximumActivitiesPerDay:number;
  durationSeconds:LoadMeasurementV2;
  distanceMeters:LoadMeasurementV2;
  efforts:Record<keyof typeof effortLabels,number> & {unknown:number};
  /** Même famille structurée que l'orchestrateur ; sortie longue séparée, sans intensité présumée. */
  structuredActivityIds:string[];
  longRunActivityIds:string[];
  unknownTypeCount:number;
}
const DAY=86_400_000;
const day=(date:string)=>Date.parse(`${date}T00:00:00Z`)/DAY;
const dateAt=(position:number)=>new Date(position*DAY).toISOString().slice(0,10);
const positive=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>0?value:null;
const distance=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
const structured=new Set(['intervals','steady-run','hills','endurance-variations']);

/** Analyse descriptive uniquement ; la politique séparée interprète sa sortie pour la sélection.
 * La référence doit être celle du pipeline existant, calculée à referenceDate.
 * Aucun résultat de recommandation ne crée une activité ou ne pondère ses mesures.
 * Les fenêtres sont des jours civils inclusifs, pas des périodes de 24 heures.
 */
export function analyzeRecentLoadV2(input:{activities:readonly RecordedActivityEvidence[];
  referenceDate:string;reference:ReferenceBootstrapResult}) {
  if(!validSessionDate(input.referenceDate))throw new Error('Date de référence de charge invalide.');
  const end=day(input.referenceDate);
  const normalize=(value:RecordedActivityEvidence)=>({
    date:value.date,durationSeconds:positive(value.durationSeconds),distanceMeters:distance(value.distanceMeters),
    documentedType:isDocumentedActivityType(value.documentedType)?value.documentedType:null,
    effort:typeof value.effort==='string'&&Object.hasOwn(effortLabels,value.effort)?value.effort:null,
  });
  type Row=ReturnType<typeof normalize> & {id:string};
  const groups=new Map<string,ReturnType<typeof normalize>[]>();
  let missingIdCount=0;
  for(const activity of input.activities){
    if(typeof activity.id!=='string'||!activity.id.trim()){missingIdCount++;continue;}
    const group=groups.get(activity.id)??[];group.push(normalize(activity));groups.set(activity.id,group);
  }
  const excluded:{id:string;reason:'conflicting-duplicate'|'invalid-date'|'future-date'}[]=[],rows:Row[]=[];
  const duplicateIds:string[]=[];
  for(const [id,group] of [...groups].sort(([a],[b])=>a.localeCompare(b))){
    if(group.length>1)duplicateIds.push(id);
    // Comparaison normalisée : ne fusionner ni choisir arbitrairement des données contradictoires.
    if(new Set(group.map(value=>JSON.stringify(value))).size>1){excluded.push({id,reason:'conflicting-duplicate'});continue;}
    const value=group[0];
    if(!validSessionDate(value.date)){excluded.push({id,reason:'invalid-date'});continue;}
    if(value.date>input.referenceDate){excluded.push({id,reason:'future-date'});continue;}
    rows.push({id,...value});
  }
  rows.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const supplied=input.reference;
  const referenceSeconds=supplied.available&&supplied.confidence!=='unavailable'&&supplied.freshness==='current'
    ?positive(supplied.referenceSeconds):null;
  const measure=(values:Row[],field:'durationSeconds'|'distanceMeters'):LoadMeasurementV2=>{
    const known=values.flatMap(value=>value[field]===null?[]:[value[field]]);
    const sum=known.reduce((total,value)=>total+value,0);
    return {knownTotal:(!values.length||known.length)&&Number.isFinite(sum)?sum:null,
      knownCount:known.length,unknownCount:values.length-known.length,overflow:!Number.isFinite(sum)};
  };
  const window=(days:number):LoadWindowV2=>{
    const from=dateAt(end-days+1),values=rows.filter(value=>value.date>=from);
    const counts=new Map<string,number>();
    const efforts:LoadWindowV2['efforts']={easy:0,moderate:0,hard:0,'very-hard':0,unknown:0};
    for(const value of values){counts.set(value.date,(counts.get(value.date)??0)+1);efforts[value.effort??'unknown']++;}
    return {days,from,through:input.referenceDate,activityIds:values.map(value=>value.id),activityCount:values.length,
      activeDays:counts.size,maximumActivitiesPerDay:Math.max(0,...counts.values()),
      durationSeconds:measure(values,'durationSeconds'),distanceMeters:measure(values,'distanceMeters'),efforts,
      structuredActivityIds:values.filter(value=>value.documentedType!==null&&structured.has(value.documentedType)).map(value=>value.id),
      longRunActivityIds:values.filter(value=>value.documentedType==='long-run').map(value=>value.id),
      unknownTypeCount:values.filter(value=>value.documentedType===null).length};
  };
  return {referenceDate:input.referenceDate,
    habitualReference:{seconds:referenceSeconds,confidence:supplied.confidence,freshness:supplied.freshness,
      sourceIds:[...new Set(supplied.sourceIds)].sort(),reasons:[...supplied.reasons]},
    activities:rows.map(value=>{
      const ratio=referenceSeconds!==null&&value.durationSeconds!==null?value.durationSeconds/referenceSeconds:null;
      return {...value,relativeDuration:ratio!==null&&Number.isFinite(ratio)?ratio:null};
    }),
    windows:{last3Days:window(3),last7Days:window(7),last14Days:window(14)},
    daily:Array.from({length:14},(_,index)=>{
      const date=dateAt(end-13+index),values=rows.filter(value=>value.date===date);
      return {date,activityCount:values.length,durationSeconds:measure(values,'durationSeconds')};
    }),
    quality:{missingIdCount,duplicateIds,excluded},
  };
}
