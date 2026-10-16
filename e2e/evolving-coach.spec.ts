import { test, expect, type Page } from '@playwright/test';
const panel = (p: Page) => p.getByRole('region', { name: 'Votre accompagnement', exact: true });
async function open(p: Page) {
  await p.goto('./#/entrainement');
  await expect(p.locator('.splash-screen')).toHaveCount(0);
  await expect(p.getByRole('heading', { name: 'Coach', exact: true })).toBeVisible();
  await expect(panel(p).getByRole('button', { name: /Configurer mon accompagnement|Modifier mes choix/ })).toBeVisible();
}
async function read(p: Page, store: string) {
  return p.evaluate(async storeName => new Promise<unknown>((resolve, reject) => {
    const r = indexedDB.open('runklmrun'); r.onerror = () => reject(r.error);
    r.onsuccess = () => { const db = r.result, tx = db.transaction(storeName, 'readonly'), q = tx.objectStore(storeName).get('local');
      tx.oncomplete = () => { db.close(); resolve(q.result ?? null); }; };
  }), store);
}
for (const width of [390,1280]) test(`Coach unique, sept objectifs et configuration sans historique à ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await open(page);
  await expect(page.getByRole('heading', { name: 'Observations du coach' })).toBeVisible();
  await expect(page.getByText('Mode d’accompagnement', { exact: true })).toHaveCount(0);
  expect(await read(page, 'evolvingCoach')).toBeNull(); expect(await read(page, 'coachProfile')).toBeNull();
  const c = panel(page); await c.getByRole('button', { name: 'Configurer mon accompagnement' }).click();
  await expect(c.getByRole('combobox', { name: 'Votre objectif', exact: true }).locator('option')).toHaveCount(8);
  for (const goal of ['begin','wellbeing','return','endurance','speed','distance','race']) {
    await c.getByRole('combobox', { name: 'Votre objectif', exact: true }).selectOption(goal);
    await expect(c.getByLabel('Distance cible (km)', { exact: true })).toHaveCount(['distance','race'].includes(goal) ? 1 : 0);
    await expect(c.getByLabel('Chrono cible', { exact: false })).toHaveCount(goal === 'race' ? 1 : 0);
    await expect(c.getByLabel('Votre préférence d’accompagnement')).toHaveCount(goal === 'wellbeing' ? 0 : 1);
  }
  await c.getByLabel('Distance cible (km)', { exact: true }).fill('12,5');
  await c.getByLabel('Date de la course', { exact: true }).fill('2027-03-01');
  await c.getByLabel('Votre expérience déclarée', { exact: false }).selectOption('observe');
  await c.getByRole('button', { name: 'Enregistrer mes choix' }).click();
  await expect(c.getByText('Terminer, sans objectif chronométrique')).toBeVisible();
  expect(await read(page, 'evolvingCoach')).toMatchObject({ configuration: { goal: { kind: 'race', distanceMeters: 12500 }, experience: 'observe', structuredPlanningPreference: 'unexpressed' } });
  expect(await read(page, 'coachProfile')).toBeNull();
  await page.reload(); await expect(page.locator('.splash-screen')).toHaveCount(0);
  await c.getByRole('button', { name: 'Modifier mes choix' }).click();
  await c.getByLabel('Votre préférence d’accompagnement').selectOption('accepted');
  await c.getByLabel('Chrono cible', { exact: false }).fill('01:10:00');
  await c.getByRole('button', { name: 'Enregistrer mes choix' }).click();
  await expect(c.getByText('Propositions autorisées — acceptation au cas par cas')).toBeVisible();
  await c.getByRole('button', { name: 'Modifier mes choix' }).click();
  await c.getByRole('combobox', { name: 'Votre objectif', exact: true }).selectOption('wellbeing');
  await c.getByRole('button', { name: 'Enregistrer mes choix' }).click();
  expect(await read(page, 'evolvingCoach')).toMatchObject({ configuration: { goal: { kind: 'wellbeing' }, structuredPlanningPreference: 'declined' } });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('préserve exactement le profil historique lors du choix du nouvel objectif', async ({ page }) => {
  await open(page);
  await page.evaluate(async () => new Promise<void>(resolve => {
    const r = indexedDB.open('runklmrun'); r.onsuccess = () => {
      const db = r.result, tx = db.transaction('coachProfile','readwrite');
      tx.objectStore('coachProfile').put({ id: 'local', goal: { kind: 'regular', distance: { kind:'custom', meters: 8000 } }, availability: { days: ['monday'], minutesPerSession: 45 }, preferences: { terrain: 'road' }, accompanimentMode:'advisor', revision: 1, createdAt:'2026-10-01T12:00:00.000Z', updatedAt:'2026-10-01T12:00:00.000Z' });
      tx.oncomplete = () => { db.close(); resolve(); };
    };
  }));
  await page.reload(); await expect(page.locator('.splash-screen')).toHaveCount(0);
  const before = await read(page, 'coachProfile'), c = panel(page);
  await expect(page.getByRole('heading', { name: 'Observations du coach' })).toBeVisible();
  await c.getByRole('button', { name: 'Configurer mon accompagnement' }).click();
  await expect(c.getByRole('combobox', { name: 'Votre objectif', exact: true })).toHaveValue('');
  await c.getByRole('combobox', { name: 'Votre objectif', exact: true }).selectOption('speed');
  await c.getByRole('button', { name: 'Enregistrer mes choix' }).click();
  await expect(c.getByRole('status')).toContainText('enregistrés');
  expect(await read(page, 'coachProfile')).toEqual(before);
});
test('validation des champs et absence d’écriture en cas d’erreur', async ({ page }) => {
  await open(page); const c = panel(page);
  await c.getByRole('button', { name:'Configurer mon accompagnement' }).click();
  await c.getByRole('combobox', { name: 'Votre objectif', exact: true }).selectOption('race');
  await c.getByLabel('Distance cible (km)', { exact: true }).fill('0');
  await c.getByRole('button', { name: 'Enregistrer mes choix' }).click();
  await expect(c.getByRole('alert')).toContainText('Distance'); expect(await read(page,'evolvingCoach')).toBeNull();
  await c.getByLabel('Distance cible (km)', { exact: true }).fill('10');
  await c.getByRole('button', { name: 'Enregistrer mes choix' }).click();
  await expect(c.getByRole('alert')).toContainText('Date');
  await c.getByLabel('Date de la course', { exact: true }).fill('2027-01-01');
  await c.getByLabel('Chrono cible', { exact: false }).fill('01:99:00');
  await c.getByRole('button', { name: 'Enregistrer mes choix' }).click();
  await expect(c.getByRole('alert')).toContainText('hh:mm:ss'); expect(await read(page,'evolvingCoach')).toBeNull();
});
test('deux onglets : conflit explicite, saisies conservées et rechargement', async ({ page, context }) => {
  await open(page); const a = panel(page);
  await a.getByRole('button', { name: 'Configurer mon accompagnement' }).click();
  await a.getByRole('combobox', { name: 'Votre objectif', exact: true }).selectOption('begin');
  const second = await context.newPage(); await open(second); const b = panel(second);
  await b.getByRole('button', { name: 'Configurer mon accompagnement' }).click();
  await b.getByRole('combobox', { name: 'Votre objectif', exact: true }).selectOption('endurance');
  await b.getByRole('button', { name: 'Enregistrer mes choix' }).click();
  await expect(b.getByRole('status')).toContainText('enregistrés');
  await expect(a.getByRole('button', { name: 'Enregistrer mes choix' })).toBeDisabled();
  await expect(a.getByRole('alert')).toContainText('autre onglet');
  await expect(a.getByRole('combobox', { name: 'Votre objectif', exact: true })).toHaveValue('begin');
  await a.getByRole('button', { name: 'Recharger la configuration' }).click();
  await expect(a.getByText('Améliorer son endurance', { exact: true })).toBeVisible();
});
test('erreurs de stockage : observations disponibles et saisies conservées', async ({ page }) => {
  await page.addInitScript(() => {
    const get = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (...args) { if (this.name === 'evolvingCoach') throw new Error('Erreur synthétique'); return get.apply(this, args); };
    Object.assign(window, { restoreCoachRead: () => { IDBObjectStore.prototype.get = get; } });
  });
  await page.goto('./#/entrainement'); await expect(page.locator('.splash-screen')).toHaveCount(0);
  const c = panel(page);
  await expect(c.getByRole('alert')).toContainText('n’a pas pu être lue');
  await expect(page.getByRole('heading', { name: 'Observations du coach' })).toBeVisible();
  await page.evaluate(() => (window as unknown as { restoreCoachRead: () => void }).restoreCoachRead());
  await c.getByRole('button', { name: 'Réessayer la lecture de la configuration' }).click();
  await c.getByRole('button', { name: 'Configurer mon accompagnement' }).click();
  await c.getByRole('combobox', { name: 'Votre objectif', exact: true }).selectOption('return');
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) { if (this.name === 'evolvingCoach') throw new Error('Erreur synthétique'); return put.apply(this, args); };
    Object.assign(window, { restoreCoachWrite: () => { IDBObjectStore.prototype.put = put; } });
  });
  await c.getByRole('button', { name: 'Enregistrer mes choix' }).click();
  await expect(c.getByRole('alert')).toContainText('Vos saisies sont conservées');
  await expect(c.getByRole('combobox', { name: 'Votre objectif', exact: true })).toHaveValue('return');
  await page.evaluate(() => (window as unknown as { restoreCoachWrite: () => void }).restoreCoachWrite());
  await c.getByRole('button', { name: 'Enregistrer mes choix' }).click();
  await expect(c.getByRole('status')).toContainText('enregistrés');
});
