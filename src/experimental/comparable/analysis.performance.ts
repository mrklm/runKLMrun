import { it, expect } from 'vitest';
import { compareMethods, DEMO } from './analysis';
import { synthetic } from './fixtures';

it('mesure 3 000 résumés comparables et vérifie tous les comptes', () => {
  const count=3000;
  const list=Array.from({length:count},(_,i)=>synthetic(String(i),5000,0));
  const started=performance.now();
  const report=compareMethods(list,{...DEMO,maxExamples:3});
  const elapsed=performance.now()-started;
  for(const m of report.methods) {
    expect(m.pairs).toBe(count*(count-1)/2);
    expect(m.matchedSessions).toBe(count);
    expect(m.examples).toHaveLength(3);
    expect(m.examplesTruncated).toBe(true);
  }
  console.info(`Charge synthétique : ${count} résumés, ${report.methods.length} méthodes, ${elapsed.toFixed(0)} ms (comparaison seule).`);
});
