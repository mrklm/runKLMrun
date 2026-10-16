import { it, expect } from 'vitest';
import { coverage, compareMethods, DEMO } from './analysis';
import { fixtures, synthetic } from './fixtures';
it('distingue absence, zéro, estimation et estimation partielle', () => {
  const c=coverage(fixtures);
  expect(c.total).toBe(15);expect(c.ascentAbsent).toBe(1);expect(c.ascentZero).toBe(2);expect(c.ascentEstimated).toBe(2);expect(c.ascentPartial).toBe(1);
  expect(c.provenance['TCX explicite']).toBe(2);
  expect(coverage([{...synthetic('x',NaN,Infinity),polarId:undefined,averageHeartRate:0}])).toMatchObject({distanceUsable:0,ascentInvalid:1,averageHeartRateUsable:0,provenance:{Inconnue:1}});
});
it('produit trois rapports sans mutation et sans dépendre de l’ordre ou des performances', () => {
  const before=structuredClone(fixtures), report=compareMethods(fixtures,DEMO);
  expect(fixtures).toEqual(before);expect(compareMethods([...fixtures].reverse(),DEMO)).toEqual(report);
  expect(compareMethods(fixtures.map(s=>({...s,durationSeconds:999,averageHeartRate:200,averagePaceSecondsPerKm:100})),DEMO).methods).toEqual(report.methods);
  for(const m of report.methods) { expect(m.examples.some(e=>[e.a,e.b].includes('8-D'))).toBe(false);expect(m.examples.some(e=>e.a==='8-B'&&e.b==='8-A')).toBe(true); }
  expect(report.excluded.map(e=>e.id)).toEqual(['absent','partiel']);
  expect(report.methods.map(({pairs,matchedSessions})=>[pairs,matchedSessions])).toEqual([[13,11],[12,10],[12,10]]);
});
it('respecte les frontières inclusives et ne crée pas de groupes par chaînage', () => {
  const list=[synthetic('A',5000,0),synthetic('B',5300,15),synthetic('C',5600,30)];
  const r=compareMethods(list,DEMO).methods[0];expect(r.pairs).toBe(2);expect(r.examples.some(e=>e.a==='A'&&e.b==='C')).toBe(false);
  expect(compareMethods([list[0],synthetic('b',5300.001,15)],DEMO).methods[0].pairs).toBe(0);
  expect(compareMethods([synthetic('a',5000,0),synthetic('b',5000,1)],DEMO).methods[1].pairs).toBe(0);
});
it('gère vide, incohérences, identifiants dupliqués et paramètres invalides', () => {
  expect(compareMethods([],DEMO).methods.every(m=>m.pairs===0)).toBe(true);
  expect(()=>compareMethods([fixtures[0],fixtures[0]],DEMO)).toThrow();
  expect(()=>compareMethods(fixtures,{...DEMO,relativeDistance:1})).toThrow();
  expect(compareMethods([{...fixtures[13],ascentMeters:99}],DEMO).excluded).toHaveLength(1);
});
it('borne les exemples sans fausser les comptes sur un jeu fonctionnel synthétique', () => {
  const count=40, list=Array.from({length:count},(_,i)=>synthetic(String(i),5000,0));
  const report=compareMethods(list,{...DEMO,maxExamples:3});
  for(const m of report.methods) { expect(m.pairs).toBe(count*(count-1)/2);expect(m.matchedSessions).toBe(count);expect(m.examples).toHaveLength(3);expect(m.examplesTruncated).toBe(true); }
});
