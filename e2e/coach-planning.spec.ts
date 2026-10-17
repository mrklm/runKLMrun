import { readFile } from 'node:fs/promises';
import { readBackupFile } from '../src/backup/compression';
import { test,expect } from '@playwright/test';
import { seedCoach,seedLegacyPlanning,openCoach,revealAll,history,suggestions,planningData } from './helpers/coach';
test('ancien planning distinct, refus/notes/révisions intacts et dates sans conflit',async({page})=>{
 await seedCoach(page);await seedLegacyPlanning(page);const before=await planningData(page);await openCoach(page);
 await expect(history(page)).toContainText('Note historique conservée');await expect(suggestions(page).getByRole('article')).toHaveCount(2);
 await expect(suggestions(page).getByRole('article').nth(0)).toContainText('jeudi 22 octobre');await revealAll(page);expect(await planningData(page)).toEqual(before);
 await expect(suggestions(page).getByRole('button')).toHaveCount(0);
});
test('ancienne séance : modification manuelle, déplacement, annulation et persistance sur mobile',async({page})=>{
 await page.setViewportSize({width:390,height:900});await seedCoach(page);await seedLegacyPlanning(page);await openCoach(page);
 const p=history(page);await p.getByRole('button',{name:'Modifier cette séance'}).click();await p.getByLabel('Date prévue').fill('2026-10-24');
 await p.getByLabel('Durée maximale (minutes)').fill('17.5');await p.getByLabel('Note personnelle').fill('Note adaptée');await p.getByRole('button',{name:'Enregistrer la séance'}).click();
 await expect(p).toContainText('17 min 30 s');await expect(p).toContainText('24/10/2026');
 await p.getByRole('button',{name:'Annuler cette séance'}).click();await expect(p).toContainText('Annulée');
 await page.reload();await expect(page.locator('.splash-screen')).toHaveCount(0);await expect(p).toContainText('Note adaptée');
 const data=await planningData(page);expect(data.dismissed).toEqual(['b'.repeat(64)]);expect(data.sessions[0].original.durationSeconds).toBe(1800);expect(data.sessions[0].durationSeconds).toBe(1050);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('deux onglets : conflit historique conserve le brouillon',async({page,context})=>{
 await seedCoach(page);await seedLegacyPlanning(page);await openCoach(page);
 const other=await context.newPage();await other.clock.setFixedTime(new Date('2026-10-17T00:00:00Z'));await other.goto('./#/entrainement');await expect(other.locator('.splash-screen')).toHaveCount(0);
 await history(page).getByRole('button',{name:'Modifier cette séance'}).click();await history(page).getByLabel('Note personnelle').fill('Brouillon');
 await history(other).getByRole('button',{name:'Annuler cette séance'}).click();await expect(history(other)).toContainText('Annulée');
 await expect(history(page).getByRole('button',{name:'Enregistrer la séance'})).toBeDisabled();await expect(history(page).getByLabel('Note personnelle')).toHaveValue('Brouillon');
 await page.getByRole('button',{name:'Recharger le planning'}).click();await expect(history(page)).toContainText('Annulée');
});
test('retrait de consentement : aucune suggestion, anciennes séances toujours gérables',async({page})=>{
 await seedCoach(page);await seedLegacyPlanning(page);await openCoach(page);const before=await planningData(page);
 await page.evaluate(async()=>{const path='/runKLMrun/src/storage/evolving-coach.ts';const {createEvolvingCoachRepository}=await import(/* @vite-ignore */ path);const r=createEvolvingCoachRepository(),old=await r.get();await r.save({...old.configuration,structuredPlanningPreference:'declined'},old.revision);});
 await expect(suggestions(page).getByRole('article')).toHaveCount(0);await expect(history(page).getByRole('button',{name:'Modifier cette séance'})).toBeVisible();expect(await planningData(page)).toEqual(before);
});
test('planning historique et suggestions sauvegardés gzip, fusion JSON puis remplacement gzip',async({page})=>{
 await seedCoach(page);await seedLegacyPlanning(page);await openCoach(page);await revealAll(page);
 await page.getByRole('link',{name:'Paramètres',exact:true}).click();const b=page.getByRole('region',{name:'Données et sauvegardes',exact:true});
 const downloading=page.waitForEvent('download');await b.getByRole('button',{name:'Exporter mes données'}).click();const download=await downloading;
 const buffer=await readFile((await download.path())!),doc=await readBackupFile(new Blob([new Uint8Array(buffer)]));expect(doc.formatVersion).toBe(5);expect(doc.data.coachPlanning?.dismissed).toEqual(['b'.repeat(64)]);
 await openCoach(page);await history(page).getByRole('button',{name:'Annuler cette séance'}).click();await expect(history(page)).toContainText('Annulée');
 for(const mode of ['merge','replace'] as const){
  await page.getByRole('link',{name:'Paramètres',exact:true}).click();const choosing=page.waitForEvent('filechooser');await b.getByRole('button',{name:'Restaurer une sauvegarde'}).click();const chooser=await choosing;
  await chooser.setFiles({name:mode==='merge'?'synthetique.json':'synthetique.json.gz',mimeType:mode==='merge'?'application/json':'application/gzip',buffer:mode==='merge'?Buffer.from(JSON.stringify(doc)):buffer});
  await expect(b.getByRole('heading',{name:'Prévisualisation de la sauvegarde'})).toBeVisible();
  if(mode==='replace')await b.getByRole('radio',{name:'Remplacer les données locales',exact:true}).check();
  await b.getByRole('checkbox',{name:/^Je confirme/}).check();await b.getByRole('button',{name:'Confirmer la restauration'}).click();await expect(b.getByRole('status')).toContainText('La restauration est terminée');await openCoach(page);
  if(mode==='merge')await expect(history(page)).toContainText('Annulée');else await expect(history(page).getByRole('button',{name:'Modifier cette séance'})).toBeVisible();
 }
});
