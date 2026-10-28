import { test, expect } from '@playwright/test';

const open=async(page:any)=>{await page.goto('./#/parametres');await expect(page.getByRole('combobox',{name:'Profil actif'})).toBeVisible();};
const addProfile=async(page:any,name:string)=>page.evaluate(async name=>{const r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts');return r.createRunnerProfile({displayName:name});},name);

test('valide le dialogue sans jamais activer la suppression',async({page})=>{
 await open(page);const destination=await addProfile(page,'Destination');await page.reload();const trigger=page.getByRole('button',{name:/Supprimer /}).first();await expect(trigger).toBeEnabled();await trigger.click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();const title=await dialog.getByRole('heading').textContent();const target=title!.replace('Supprimer ','');await expect(dialog.getByRole('combobox')).toHaveValue(destination.id);const confirm=dialog.getByLabel('Confirmez avec le pseudonyme');await confirm.fill('incorrect');await expect(dialog.getByRole('button',{name:'Supprimer définitivement'})).toBeDisabled();await confirm.fill(target);await expect(dialog.getByRole('button',{name:'Supprimer définitivement'})).toBeDisabled();await dialog.getByRole('button',{name:'Annuler'}).click();await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
 const before=await page.evaluate(async()=>{const r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts');return (await r.readProfileRegistry())!.profiles.map((x:any)=>x.id);});await trigger.click();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);const after=await page.evaluate(async()=>{const r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts');return (await r.readProfileRegistry())!.profiles.map((x:any)=>x.id);});expect(after).toEqual(before);
});

test('refuse le dernier profil actif',async({page})=>{await open(page);await expect(page.getByRole('button',{name:/Supprimer /})).toBeDisabled();});
