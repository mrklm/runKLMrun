import { expect, it } from 'vitest';
import { formatCoachDuration, formatCoachDurationText } from './coach-duration-format';

it.each([[900,'15 min'],[1050,'17 min 30 s'],[3600,'1 h'],[4500,'1 h 15 min'],[5430,'1 h 30 min 30 s'],[7200,'2 h'],[1050.5,'17 min 30,5 s'],[3600.125,'1 h 0,125 s'],[0,'0 s'],[NaN,'—'],[-1,'—']] as const)('formate %s sans changer la précision', (value,label)=>expect(formatCoachDuration(value)).toBe(label));
it('convertit seulement les durées du texte existant',()=>{const source='Maximum 1050 s, repère 3600 s.';expect(formatCoachDurationText(source)).toBe('Maximum 17 min 30 s, repère 1 h.');expect(source).toBe('Maximum 1050 s, repère 3600 s.');});
it.each([[45,'45 s'],[90,'1 min 30 s'],[1800,'30 min'],[2192,'36 min 32 s'],[3665,'1 h 1 min 5 s']] as const)('formate la durée réelle %s', (seconds,label)=>expect(formatCoachDuration(seconds)).toBe(label));
it('préserve les nombres hors durée et les messages non reconnus',()=>{
 const source='328 activités, fraction éditoriale 0.8, identifiant 2192 s ; médiane observée 2192 s ; maximum proposé avant disponibilité 1800 s.';
 expect(formatCoachDurationText(source)).toBe('328 activités, fraction éditoriale 0.8, identifiant 2192 s ; médiane observée 36 min 32 s ; maximum proposé avant disponibilité 30 min.');
 expect(formatCoachDurationText('36.5 minutes faciles, selon vos sorties récentes.')).toBe('36 min 30 s faciles, selon vos sorties récentes.');
});
it('traduit le seuil technique uniquement à l’affichage',()=>{
 const source='Après arrondi inférieur par pas de 5 minutes, durée inférieure au minimum éditorial fourni (1800 s), sans dépassement du plafond.';
 expect(formatCoachDurationText(source)).toBe('Vos sorties récentes ou vos disponibilités ne permettent pas de proposer une séance d’au moins 30 min.');
 expect(source).toContain('minimum éditorial');
});
