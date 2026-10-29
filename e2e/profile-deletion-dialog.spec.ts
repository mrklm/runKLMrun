import { test, expect } from '@playwright/test';

const open=async(page:any)=>{await page.goto('./#/parametres');await expect(page.getByRole('combobox',{name:'Profil actif'})).toBeVisible();const section=page.getByRole('region',{name:'Profils'}),panel=section.locator('> details');await panel.locator(':scope > summary').click();await expect(panel).toHaveAttribute('open','');return section;};
const addProfile=async(page:any,name:string)=>page.evaluate(async name=>{const r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts');return r.createRunnerProfile({displayName:name});},name);

test('la suppression publique reste indisponible avec un profil sélectionnable',async({page})=>{
 const section=await open(page),destination=await addProfile(page,'Destination');await page.reload();const refreshed=await open(page),active=await page.getByRole('combobox',{name:'Profil actif'}).inputValue(),target=refreshed.getByRole('combobox',{name:'Profil à supprimer'});await expect(target).toHaveValue(active);await target.selectOption(destination.id);await expect(target).toHaveValue(destination.id);await expect(refreshed.getByRole('combobox',{name:'Profil à modifier'})).toHaveValue(active);
 const before=await page.evaluate(async()=>{const r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts');return (await r.readProfileRegistry())!.profiles.map((x:any)=>x.id);});await expect(refreshed.getByRole('button',{name:'Supprimer',exact:true})).toBeDisabled();await expect(page.getByRole('dialog')).toHaveCount(0);const after=await page.evaluate(async()=>{const r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts');return (await r.readProfileRegistry())!.profiles.map((x:any)=>x.id);});expect(after).toEqual(before);
});

test('la suppression reste indisponible avec le seul profil actif',async({page})=>{const section=await open(page);await expect(section.getByRole('button',{name:'Supprimer',exact:true})).toBeDisabled();});
