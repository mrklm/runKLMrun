import { exportGzip, readBackupFile } from '../src/backup/compression';
import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createBackup } from '../src/backup/format';
import { fixture } from '../src/backup/test-fixture';
import type { BackupData } from '../src/types/backup';
import { activeDatabase } from './helpers/active-database';

const panel = (page: Page) => page.getByRole('region', { name: 'Données', exact: true }).locator('details').filter({ has: page.getByText('Données et sauvegardes', { exact: true }) });
const section = (page: Page) => panel(page).locator('.backups');
const latestSession = (page: Page, title: string) => page.getByRole('region', { name: 'Dernière sortie', exact: true }).getByRole('link', { name: title, exact: true });
async function open(page: Page) {
  await page.goto('./#/parametres');
  await expect(page.locator('.splash-screen')).toHaveCount(0);
  await expect(panel(page)).toBeVisible();
  if (!await panel(page).evaluate((element: HTMLDetailsElement) => element.open)) await panel(page).locator('summary').click();
  await expect(section(page)).toBeVisible();
}
async function openCoach(page: Page) {
  await page.goto('./#/entrainement');
  await expect(page.getByRole('heading', { name: 'Coach', exact: true })).toBeVisible();
}
async function upload(page: Page, data = fixture(), gzip = false) {
  const buffer = gzip
    ? Buffer.from(await (await exportGzip(data, '0.4.0')).file.arrayBuffer())
    : Buffer.from(JSON.stringify(await createBackup(data, '0.4.0', '2026-10-10T10:00:00Z')));
  const chooserPromise = page.waitForEvent('filechooser');
  await section(page).getByRole('button', { name: 'Restaurer une sauvegarde', exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: gzip ? 'synthetique.JSON.GZ' : 'synthetique.JSON', mimeType: gzip ? 'application/gzip' : 'application/json', buffer });
  await expect(section(page).getByRole('heading', { name: 'Prévisualisation de la sauvegarde' })).toBeVisible();
}
async function seed(page: Page, data = fixture()) {
  const database = await activeDatabase(page);
  await page.evaluate(async ({ data, database }) => {
    if (!(await indexedDB.databases()).some(value => value.name === database)) throw new Error(`Base du profil actif absente : ${database}`);
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(database);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        let tx: IDBTransaction;
        try { tx = db.transaction(['sessions', 'details', 'coachProfile'], 'readwrite'); }
        catch (error) { db.close(); reject(error); return; }
        for (const s of data.sessions) tx.objectStore('sessions').put(s);
        for (const d of data.details) tx.objectStore('details').put(d);
        if (data.coachProfile) tx.objectStore('coachProfile').put(data.coachProfile);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Transaction IndexedDB interrompue.')); };
      };
    });
  }, { data, database });
}
async function confirm(page: Page) {
  const s = section(page);
  await s.getByRole('checkbox', { name: /^Je confirme/ }).check();
  await s.getByRole('button', { name: 'Confirmer la restauration' }).click();
  await expect(s.getByRole('status')).toContainText('La restauration est terminée');
}
for (const width of [390, 1280]) test(`sauvegarde, prévisualisation et remplacement au clavier à ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await open(page); await seed(page);
  const s = section(page);
  const downloadPromise = page.waitForEvent('download');
  await s.getByRole('button', { name: 'Exporter mes données' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^runKLMrun-sauvegarde-\d{4}-\d{2}-\d{2}\.json\.gz$/);
  const exported = await readBackupFile(new Blob([new Uint8Array(await readFile((await download.path())!))]));
  expect(exported.data).toEqual(fixture());
  await upload(page, fixture(), true);
  await expect(s.getByRole('heading', { name: 'Prévisualisation de la sauvegarde' })).toBeFocused();
  await expect(s.getByRole('button', { name: 'Confirmer la restauration' })).toBeDisabled();
  await s.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(s.getByRole('status')).toContainText('inchangées');
  const data: BackupData = { sessions: [{ id: 'replacement', title: 'Séance remplacée', date: '2026-10-09', durationSeconds: 1200 }], details: [], coachProfile: null };
  await upload(page, data, width === 390);
  await s.getByRole('radio', { name: 'Remplacer les données locales', exact: true }).check();
  await expect(s.getByText(/votre profil local sera supprimé/)).toBeVisible();
  const check = s.getByRole('checkbox', { name: /^Je confirme/ });
  await check.focus(); await check.press('Space'); await check.press('Tab');
  await expect(s.getByRole('button', { name: 'Confirmer la restauration' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(s.getByRole('status')).toContainText('La restauration est terminée');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Accueil', exact: true }).click();
  await expect(latestSession(page, 'Séance remplacée')).toBeVisible();
  await expect(page.getByText('Sortie synthétique', { exact: true })).toHaveCount(0);
  await openCoach(page);
  await page.reload(); await expect(page.locator('.splash-screen')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enregistrer mon profil', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Accueil', exact: true }).click();
  await expect(latestSession(page, 'Séance remplacée')).toBeVisible();
});
test('fusionne, avertit des conflits et traite le profil indépendamment', async ({ page }) => {
  await open(page); await seed(page);
  const incoming = fixture();
  incoming.sessions[0].title = 'Variante du fichier';
  incoming.sessions.push({ id: 'new', title: 'Nouvelle séance synthétique', date: '2026-10-09', durationSeconds: 60 });
  incoming.coachProfile!.availability.maxMinutesByDay!.monday = 90;
  await upload(page, incoming, true);
  const s = section(page);
  await expect(s.getByRole('radio', { name: /Conserver le profil local/ })).toBeChecked();
  await expect(s.getByText(/1 conflit\(s\)/)).toBeVisible();
  await confirm(page);
  await openCoach(page);
  await expect(page.getByRole('region', { name: 'Votre profil de coureur', exact: true }).getByText('Lundi : 45 min', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Paramètres', exact: true }).click();
  await upload(page, incoming, true);
  await s.getByRole('radio', { name: 'Remplacer mon profil par celui du fichier', exact: true }).check();
  await confirm(page);
  await openCoach(page);
  await expect(page.getByRole('region', { name: 'Votre profil de coureur', exact: true }).getByText('Lundi : 1 h 30', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Accueil', exact: true }).click();
  const recentActivities = page.getByRole('group', { name: 'Activités récentes', exact: true });
  await recentActivities.locator('summary').click();
  await expect(recentActivities.getByRole('link', { name: 'Sortie synthétique', exact: true })).toBeVisible();
  await expect(latestSession(page, 'Nouvelle séance synthétique')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Variante du fichier', exact: true })).toHaveCount(0);
});
test('refuse un fichier invalide sans afficher une confirmation', async ({ page }) => {
  await open(page); await seed(page);
  const s = section(page);
  await s.getByLabel('Fichier de sauvegarde').setInputFiles({ name: 'invalide.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"autre"}') });
  await expect(s.getByRole('alert')).toContainText('pas une sauvegarde');
  await expect(s.getByRole('button', { name: 'Confirmer la restauration' })).toHaveCount(0);
  await page.reload(); await expect(page.locator('.splash-screen')).toHaveCount(0);
  await page.getByRole('link', { name: 'Accueil', exact: true }).click();
  await expect(latestSession(page, 'Sortie synthétique')).toBeVisible();
});
test('refuse une prévisualisation devenue obsolète après écriture dans un autre onglet', async ({ page, context }) => {
  await open(page); await seed(page); await upload(page);
  const second = await context.newPage(); await open(second);
  const changed = fixture(); changed.sessions[0].title = 'Modification concurrente'; await seed(second, changed);
  await section(page).getByRole('checkbox', { name: /^Je confirme/ }).check();
  await section(page).getByRole('button', { name: 'Confirmer la restauration' }).click();
  await expect(section(page).getByRole('alert')).toContainText('ont changé');
});

test('actualise les autres onglets après restauration et propose le profil absent', async ({ page, context }) => {
  await open(page);
  const second = await context.newPage(); await second.goto('./#/entrainement');
  await expect(second.locator('.splash-screen')).toHaveCount(0);
  await expect(second.getByRole('button', { name: 'Enregistrer mon profil', exact: true })).toBeVisible();
  await upload(page);
  await section(page).getByRole('radio', { name: 'Restaurer le profil du fichier', exact: true }).check();
  await confirm(page);
  await expect(second.getByRole('alert')).toContainText('Votre profil a été modifié dans un autre onglet');
  await second.getByRole('button', { name: 'Recharger le profil enregistré', exact: true }).click();
  await expect(second.getByRole('region', { name: 'Votre profil de coureur', exact: true }).getByText('Lundi : 45 min', { exact: true })).toBeVisible();
});

test('refuse un gzip tronqué et conserve les données après rechargement', async ({ page }) => {
  await open(page); await seed(page);
  const s = section(page), { file } = await exportGzip(fixture(), '0.4.0');
  await s.getByLabel('Fichier de sauvegarde').setInputFiles({
    name: 'tronque.json.gz', mimeType: 'application/gzip',
    buffer: Buffer.from(await file.slice(0, file.size - 8).arrayBuffer()),
  });
  await expect(s.getByRole('alert')).toContainText('gzip');
  await expect(s.getByRole('button', { name: 'Confirmer la restauration' })).toHaveCount(0);
  await page.reload(); await expect(page.locator('.splash-screen')).toHaveCount(0);
  await openCoach(page);
  await expect(page.getByRole('region', { name: 'Votre profil de coureur', exact: true }).getByText('Lundi : 45 min', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Accueil', exact: true }).click();
  await expect(latestSession(page, 'Sortie synthétique')).toBeVisible();
});

test('distingue profondeur et nombre de propriétés sans exposer le contenu du fichier', async ({ page }) => {
  await open(page);
  const s = section(page), input = s.getByLabel('Fichier de sauvegarde');
  await input.setInputFiles({ name: 'profond.json', mimeType: 'application/json', buffer: Buffer.from('['.repeat(33) + '0' + ']'.repeat(33)) });
  await expect(s.getByRole('alert')).toContainText('Profondeur JSON excessive : 33 ; limite : 32');
  const text = JSON.stringify(Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`NE_PAS_AFFICHER_${i}`, 0])));
  await input.setInputFiles({ name: 'proprietes.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(s.getByRole('alert')).toContainText('propriétés dans un objet JSON : 65 ; limite : 64');
  await expect(s.getByRole('alert')).not.toContainText('NE_PAS_AFFICHER');
  await expect(s.getByRole('button', { name: 'Confirmer la restauration' })).toHaveCount(0);
});

test('applique les 30 jours après aperçu, annulation et confirmation du remplacement', async ({ page }) => {
  await open(page); await seed(page);
  const data = fixture();
  const today = new Date().toISOString();
  data.sessions[0] = { ...data.sessions[0], id: 'recent', date: today.slice(0, 10), startTime: today };
  data.details[0].id = 'recent';
  data.sessions.push(
    { id: 'old', title: 'Ancienne synthétique', date: '2000-01-01', durationSeconds: 600 },
    { id: 'uncertain', title: 'Date inconnue', date: '', durationSeconds: 600 },
    { id: 'summary-only', title: 'Résumé seul', date: today.slice(0, 10), durationSeconds: 600 },
  );
  data.details.push({ id: 'old', heartRate: [{ timeSeconds: 0, value: 140 }] }, { id: 'uncertain', heartRate: [{ timeSeconds: 0, value: 130 }] });
  const keys = async () => { const database = await activeDatabase(page); return page.evaluate(async database => {
    if (!(await indexedDB.databases()).some(value => value.name === database)) throw new Error(`Base du profil actif absente : ${database}`);
    return new Promise<{ sessions: IDBValidKey[]; details: IDBValidKey[] }>((resolve, reject) => {
    const request = indexedDB.open(database);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      let tx: IDBTransaction;
      try { tx = db.transaction(['sessions', 'details']); }
      catch (error) { db.close(); reject(error); return; }
      const sessions = tx.objectStore('sessions').getAllKeys(), details = tx.objectStore('details').getAllKeys();
      tx.oncomplete = () => { db.close(); resolve({ sessions: sessions.result, details: details.result }); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Transaction IndexedDB interrompue.')); };
    };
    });
  }, database); };
  const before = await keys(), s = section(page);
  await upload(page, data, true);
  await expect(s.getByText('Détails anciens du fichier ignorés', { exact: true }).locator('..').locator('dd')).toHaveText('1');
  await expect(s.getByText('Séances avec détails récents conservables', { exact: true }).locator('..').locator('dd')).toHaveText('1');
  await expect(s.getByText('Séances à date incertaine', { exact: true }).locator('..').locator('dd')).toHaveText('1');
  await s.getByRole('button', { name: 'Annuler', exact: true }).click();
  expect(await keys()).toEqual(before);
  await upload(page, data, true);
  await s.getByRole('radio', { name: 'Remplacer les données locales', exact: true }).check();
  await expect(s.getByRole('button', { name: 'Confirmer la restauration' })).toBeDisabled();
  await confirm(page);
  expect(await keys()).toEqual({ sessions: ['old', 'recent', 'summary-only', 'uncertain'], details: ['recent', 'uncertain'] });
  await page.getByRole('link', { name: 'Courses', exact: true }).click();
  await page.getByText('Historique des courses', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Séances sans date exploitable', exact: true })).toBeVisible();
});
