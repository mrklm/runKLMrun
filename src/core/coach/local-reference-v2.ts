import { localToday } from '../analysis/statistics-period';
import { validSessionDate } from '../analysis/session-summary';

export interface CoachV2LocalReference { date:string;minuteOfDay:number }
/** Les appels historiques avec une date seule représentent explicitement minuit. */
export type CoachV2Reference=CoachV2LocalReference|string;

/** Une seule lecture de l'horloge à l'entrée de l'interface, en heure locale. */
export function localCoachV2Reference(now=new Date()):CoachV2LocalReference {
  return resolveCoachV2Reference({date:localToday(now),minuteOfDay:now.getHours()*60+now.getMinutes()});
}
export function resolveCoachV2Reference(value:CoachV2Reference):CoachV2LocalReference {
  const reference=typeof value==='string'?{date:value,minuteOfDay:0}:value;
  if(!validSessionDate(reference.date)||!Number.isInteger(reference.minuteOfDay)||reference.minuteOfDay<0||reference.minuteOfDay>=1440)
    throw new Error('Date ou heure locale de référence V2 invalide.');
  return reference;
}
