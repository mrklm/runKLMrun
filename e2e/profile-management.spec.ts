import { test, expect } from '@playwright/test';
const open=async(page:any)=>{await page.goto('./#/parametres');await expect(page.locator('.splash-screen')).toHaveCount(0);await expect(page.getByRole('heading',{name:'Profils'})).toBeVisible();};
test('crée un profil, le propose puis bascule sans hériter des séances',async({page})=>{
 await open(page);const section=page.getByRole('region',{name:'Profils'});await section.getByRole('button',{name:'Créer un profil'}).click();await section.getByLabel('Pseudonyme').fill('Profil navigateur');await section.getByRole('button',{name:'Enregistrer'}).click();
 await expect(section.getByText('Profil créé.',{exact:true})).toBeVisible();await expect(page.getByRole('combobox',{name:'Profil actif'}).getByRole('option',{name:'Profil navigateur'})).toHaveCount(1);
 await section.getByRole('button',{name:'Utiliser ce profil'}).click();await expect(page.getByRole('combobox',{name:'Profil actif'})).toHaveText(/Profil navigateur/);await expect(section.getByRole('button',{name:'Utiliser ce profil'})).toHaveCount(0);
});
test('refuse des informations invalides et conserve les saisies',async({page})=>{
 await open(page);const section=page.getByRole('region',{name:'Profils'});await section.getByRole('button',{name:'Créer un profil'}).click();await section.getByLabel('Pseudonyme').fill('   ');await section.getByLabel('Taille (cm)').fill('301');await section.getByRole('button',{name:'Enregistrer'}).click();
 await expect(section.getByLabel('Taille (cm)')).toHaveValue('301');expect(await section.getByLabel('Taille (cm)').evaluate((input:HTMLInputElement)=>input.validity.valid)).toBe(false);
});
test('modifie un profil et conserve son identité après rechargement',async({page})=>{
 await open(page);const section=page.getByRole('region',{name:'Profils'});await section.getByRole('button',{name:'Créer un profil'}).click();await section.getByLabel('Pseudonyme').fill('Avant');await section.getByRole('button',{name:'Enregistrer'}).click();
 const identity=await page.evaluate(async()=>{const r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts');const s=await r.readProfileRegistry();const p=s!.profiles.find((x:any)=>x.displayName==='Avant')!;return {id:p.id,databaseName:p.databaseName};});
 await section.getByRole('button',{name:'Modifier'}).last().click();await section.getByLabel('Pseudonyme').fill('Après');await section.getByLabel('Date de naissance').fill('2000-01-02');await section.getByLabel('Taille (cm)').fill('180');await section.getByLabel('Poids (kg)').fill('70');await expect(section.getByLabel('Taille (cm)')).toHaveValue('180');await expect(section.getByLabel('Poids (kg)')).toHaveValue('70');await section.getByRole('button',{name:'Enregistrer'}).click();
 await expect(page.getByRole('combobox',{name:'Profil actif'}).getByRole('option',{name:'Après'})).toHaveCount(1);await page.reload();await expect(section.getByText('Après',{exact:true})).toBeVisible();
 const persisted=await page.evaluate(async(id)=>{const r=await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts');const s=await r.readProfileRegistry();return s!.profiles.find((x:any)=>x.id===id);},identity.id);expect(persisted.databaseName).toBe(identity.databaseName);expect(persisted.heightCm).toBe(180);expect(persisted.weightKg).toBe(70);
});
test('verrouille le formulaire pendant une opération critique',async({page})=>{
 await open(page);const section=page.getByRole('region',{name:'Profils'});await section.getByRole('button',{name:'Créer un profil'}).click();await expect(section.getByLabel('Pseudonyme')).toBeEnabled();
 await page.evaluate(async()=>{const g=await import(/* @vite-ignore */ '/runKLMrun/src/components/operation-guard.ts');(window as any).releaseProfileFormLock=g.acquireOperation();});await expect(section.getByLabel('Pseudonyme')).toBeDisabled();
 await page.evaluate(()=>{(window as any).releaseProfileFormLock();});await expect(section.getByLabel('Pseudonyme')).toBeEnabled();
});

test('avertit, refuse une révision obsolète et recharge avec confirmation',async({page,context})=>{
 await open(page);const section=page.getByRole('region',{name:'Profils'});await section.getByRole('button',{name:'Créer un profil'}).click();await section.getByLabel('Pseudonyme').fill('Profil conflit');await section.getByRole('button',{name:'Enregistrer'}).click();
 const other=await context.newPage();await open(other);const otherSection=other.getByRole('region',{name:'Profils'}),active=await other.getByRole('combobox',{name:'Profil actif'}).inputValue();
 await section.getByRole('listitem').filter({hasText:'Profil conflit'}).getByRole('button',{name:'Modifier'}).click();await otherSection.getByRole('listitem').filter({hasText:'Profil conflit'}).getByRole('button',{name:'Modifier'}).click();
 await otherSection.getByLabel('Pseudonyme').fill('Brouillon B');await section.getByLabel('Pseudonyme').fill('Modification A');await section.getByRole('button',{name:'Enregistrer'}).click();
 await expect(otherSection.getByText('Ce profil a été modifié dans un autre onglet.',{exact:false})).toBeVisible();await expect(otherSection.getByLabel('Pseudonyme')).toHaveValue('Brouillon B');await expect(other.getByRole('combobox',{name:'Profil actif'})).toHaveValue(active);
 await otherSection.getByRole('button',{name:'Enregistrer'}).click();await expect(otherSection.getByText('Ce profil a été modifié dans un autre onglet. Rechargez-le avant de réessayer.',{exact:true})).toBeVisible();await expect(otherSection.getByLabel('Pseudonyme')).toHaveValue('Brouillon B');await expect(section.getByText('Modification A',{exact:true})).toBeVisible();
 const refused=other.waitForEvent('dialog');await otherSection.getByRole('button',{name:'Recharger le profil'}).click();await (await refused).dismiss();await expect(otherSection.getByLabel('Pseudonyme')).toHaveValue('Brouillon B');
 const accepted=other.waitForEvent('dialog');await otherSection.getByRole('button',{name:'Recharger le profil'}).click();await (await accepted).accept();await expect(otherSection.getByLabel('Pseudonyme')).toHaveValue('Modification A');await expect(otherSection.getByText('Tes modifications en cours sont conservées.',{exact:false})).toHaveCount(0);
 await otherSection.getByLabel('Pseudonyme').fill('Modification B');await otherSection.getByRole('button',{name:'Enregistrer'}).click();await expect(otherSection.getByText('Profil modifié.',{exact:true})).toBeVisible();await page.reload();await expect(section.getByText('Modification B',{exact:true})).toBeVisible();
});
