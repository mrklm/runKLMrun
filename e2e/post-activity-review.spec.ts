import { test, expect } from './helpers/protected-test';
import type { Page } from '@playwright/test';
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
import { activeDatabase } from './helpers/active-database';
const root = '/runKLMrun/src/';
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Bilan de votre séance', exact: true });
const tcx = (index: number) => ({ name: `synthetic-${index}.tcx`, mimeType: 'application/xml', buffer: Buffer.from(
  `<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Running"><Lap StartTime="2026-10-20T${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}:00Z"><TotalTimeSeconds>600</TotalTimeSeconds><DistanceMeters>1000</DistanceMeters></Lap></Activity></Activities></TrainingCenterDatabase>`) });
async function prepare(page: Page) {
  await page.goto('./'); await expect(page.getByText('Votre histoire commence ici')).toBeVisible();
  await expect(page.locator('.app-shell')).toHaveJSProperty('inert', false);
  const database = await activeDatabase(page);
  await page.getByRole('navigation').getByRole('link', { name: 'Courses', exact: true }).click();
  await page.getByText('Importer des activités', { exact: true }).click();
  return database;
}
async function importFiles(page: Page, files: ReturnType<typeof tcx>[]) {
  await page.getByLabel('Sélectionner les fichiers').setInputFiles(files);
  await page.getByRole('button', { name: 'Importer les séances', exact: true }).click();
  await expect(page.getByRole('status', { includeHidden: true }).filter({ hasText: 'Compte rendu' })).toContainText('séances ajoutées');
}
async function sessions(page: Page, database: string) {
  return page.evaluate(async ({ root, database }) => {
    const { createSessionRepository } = await import(/* @vite-ignore */ root + 'storage/database.ts');
    return createSessionRepository(database).list();
  }, { root, database });
}
async function manual(page: Page) {
  await page.getByText('Ajouter une sortie manuellement', { exact: true }).click();
  const form = page.getByRole('form', { name: 'Ajouter une sortie manuellement' });
  await form.getByLabel('Date de la sortie').fill('2026-10-20');
  await form.getByLabel('Durée (minutes)', { exact: true }).fill('30');
  return form;
}

for (const count of [1, 5, 6, 50]) test(`TCX : ${count} créations, seuil exact et ouverture unique`, async ({ page }) => {
  const database = await prepare(page);
  await importFiles(page, Array.from({ length: count }, (_, index) => tcx(index)));
  expect(await sessions(page, database)).toHaveLength(count);
  if (count <= 5) {
    await expect(dialog(page)).toBeVisible(); await expect(page.locator('dialog[open]')).toHaveCount(1);
    if (count > 1) await expect(dialog(page)).toContainText('Activité 1 sur 5');
    await dialog(page).getByRole('button', { name: 'Quitter le bilan', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Importer les séances', exact: true })).toBeFocused();
  } else {
    await expect(dialog(page)).toHaveCount(0); await expect(page.getByText('Ce bilan est facultatif.', { exact: false })).toHaveCount(0);
  }
  await page.getByRole('navigation').getByRole('link', { name: 'Accueil', exact: true }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Courses', exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
});

test('zéro création, doublons, fichiers rejetés et lots successifs indépendants', async ({ page }) => {
  const database = await prepare(page);
  await importFiles(page, [{ name: 'invalid.tcx', mimeType: 'application/xml', buffer: Buffer.from('invalid') }]);
  await expect(dialog(page)).toHaveCount(0); expect(await sessions(page, database)).toHaveLength(0);
  await importFiles(page, [tcx(0)]); await dialog(page).getByRole('button', { name: 'Plus tard', exact: true }).click();
  await importFiles(page, [tcx(0), tcx(0)]); await expect(dialog(page)).toHaveCount(0);
  await importFiles(page, [tcx(0), tcx(1), { name: 'bad.tcx', mimeType: 'application/xml', buffer: Buffer.from('bad') }]);
  await expect(dialog(page)).toBeVisible(); await expect(dialog(page).getByText(/Activité \d sur/)).toHaveCount(0);
  await dialog(page).getByLabel('Commentaire personnel (facultatif)').fill('Deuxième lot');
  await dialog(page).getByRole('button', { name: 'Enregistrer', exact: true }).click(); await expect(dialog(page)).toHaveCount(0);
  const data = await sessions(page, database); expect(data).toHaveLength(2);
  expect(data.filter(session => session.feeling?.comment === 'Deuxième lot')).toHaveLength(1);
  await importFiles(page, [tcx(2)]); await expect(dialog(page).getByLabel('Commentaire personnel (facultatif)')).toHaveValue('');
  await page.keyboard.press('Escape'); await expect(dialog(page)).toHaveCount(0);
});

for (const width of [390, 1280]) test(`navigation, brouillons, abandon explicite et réponses conservées à ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); const database = await prepare(page);
  await importFiles(page, [tcx(0), tcx(1), tcx(2)]);
  const modal = dialog(page);
  await expect(modal.locator('header h2')).toBeFocused();
  await modal.locator('[data-testid="session-review"]:visible').getByLabel('Commentaire personnel (facultatif)').fill('Brouillon premier');
  await modal.getByRole('button', { name: 'Plus tard', exact: true }).click(); await expect(modal).toContainText('Activité 2 sur 3');
  await modal.locator('[data-testid="session-review"]:visible').getByLabel('Effort perçu (facultatif)').selectOption('moderate');
  await modal.getByRole('button', { name: 'Enregistrer et suivant', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(modal).toContainText('Activité 3 sur 3');
  await modal.getByRole('button', { name: 'Précédent', exact: true }).click(); await expect(modal.locator('[data-testid="session-review"]:visible').getByLabel('Effort perçu (facultatif)')).toHaveValue('moderate');
  await modal.getByRole('button', { name: 'Précédent', exact: true }).click(); await expect(modal.locator('[data-testid="session-review"]:visible').getByLabel('Commentaire personnel (facultatif)')).toHaveValue('Brouillon premier');
  for (let index = 0; index < 10; index++) {
    await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  }
  expect(await modal.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.press('Escape'); await expect(modal.getByRole('alert')).toContainText('seront abandonnées');
  await expect(modal.getByRole('button', { name: 'Continuer le bilan', exact: true })).toBeFocused();
  await modal.getByRole('button', { name: 'Continuer le bilan', exact: true }).click();
  await expect(modal.locator('[data-testid="session-review"]:visible').getByLabel('Commentaire personnel (facultatif)')).toHaveValue('Brouillon premier');
  await modal.getByRole('button', { name: 'Quitter le bilan', exact: true }).click();
  await modal.getByRole('button', { name: 'Fermer sans enregistrer', exact: true }).click();
  const data = await sessions(page, database); expect(data.filter(session => session.feeling?.effort === 'moderate')).toHaveLength(1);
  expect(data.some(session => session.feeling?.comment)).toBe(false);
  await page.reload(); await expect(dialog(page)).toHaveCount(0);
  expect((await sessions(page, database)).filter(session => session.feeling?.effort === 'moderate')).toHaveLength(1);
});

test('création manuelle : report, sauvegarde, fiche sans popup et thèmes', async ({ page }) => {
  const database = await prepare(page), form = await manual(page);
  await form.getByLabel('Commentaire personnel (facultatif)').fill('Déjà saisi');
  await form.getByRole('button', { name: 'Enregistrer la sortie', exact: true }).click();
  await expect(dialog(page)).toHaveCount(1); await expect(dialog(page).getByLabel('Commentaire personnel (facultatif)')).toHaveValue('Déjà saisi');
  await expect(dialog(page).getByRole('radio')).toHaveCount(0);
  await dialog(page).getByRole('button', { name: 'Plus tard', exact: true }).click();
  expect(await sessions(page, database)).toHaveLength(1);
  await expect(form.getByRole('button', { name: 'Enregistrer la sortie', exact: true })).toBeFocused();
  await form.getByLabel('Durée (minutes)', { exact: true }).fill('20');
  await form.getByRole('button', { name: 'Enregistrer la sortie', exact: true }).click();
  await dialog(page).getByRole('combobox', { name: 'Type d’entraînement', exact: true }).selectOption('other');
  await dialog(page).getByLabel('Précisez votre entraînement').fill('Entraînement libre');
  await dialog(page).getByRole('button', { name: 'Enregistrer', exact: true }).click(); await expect(dialog(page)).toHaveCount(0);
  await form.getByRole('link', { name: 'Consulter la sortie', exact: true }).click();
  await expect(page.getByTestId('session-review')).toHaveCount(1); await expect(dialog(page)).toHaveCount(0);
  await page.getByTestId('session-review').getByLabel('Commentaire personnel (facultatif)').fill('Correction depuis la fiche');
  await page.getByTestId('session-review').getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByTestId('session-review').getByRole('status')).toContainText('enregistré'); await expect(dialog(page)).toHaveCount(0);
  for (const theme of ['AIR-KLM Day flight', 'Midnight Garage']) {
    await page.getByRole('navigation').getByRole('link', { name: 'Paramètres', exact: true }).click();
    await page.getByRole('combobox', { name: 'Thème', exact: true }).selectOption({ label: theme });
    await page.getByRole('navigation').getByRole('link', { name: 'Courses', exact: true }).click();
    await form.getByLabel('Durée (minutes)', { exact: true }).fill('10'); await form.getByRole('button', { name: 'Enregistrer la sortie', exact: true }).click();
    await expect(dialog(page)).toBeVisible(); expect(await dialog(page).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await dialog(page).getByRole('button', { name: 'Plus tard', exact: true }).click();
  }
});

test('échec manuel et import TCX partiel : uniquement les écritures validées', async ({ page }) => {
  const database = await prepare(page), form = await manual(page);
  await page.evaluate(() => {
    const add = IDBObjectStore.prototype.add;
    let count = 0;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === 'sessions' && (count++ === 0 || count === 3)) throw new Error('Quota synthétique');
      return add.apply(this, args);
    };
  });
  await form.getByRole('button', { name: 'Enregistrer la sortie', exact: true }).click();
  await expect(form.getByRole('alert')).toContainText('n’a pas pu'); await expect(dialog(page)).toHaveCount(0); expect(await sessions(page, database)).toHaveLength(0);
  await importFiles(page, [tcx(0), tcx(1), tcx(2)]);
  await expect(dialog(page)).toBeVisible(); expect(await sessions(page, database)).toHaveLength(1);
  await dialog(page).getByRole('button', { name: 'Plus tard', exact: true }).click();
});

test('ZIP réel : une seule fenêtre après la fin du worker', async ({ page }) => {
  const database = await prepare(page), writer = new ZipWriter(new BlobWriter(), { useWebWorkers: false });
  for (const id of ['a', 'b']) await writer.add(`training-session_${id}.json`, new TextReader(JSON.stringify({ exercises: [{ sport: 'RUNNING', startTime: '2026-10-20T10:00:00', duration: 'PT10M' }] })));
  await importFiles(page, [{ name: 'synthetic.zip', mimeType: 'application/zip', buffer: Buffer.from(await (await writer.close()).arrayBuffer()) }]);
  await expect(dialog(page)).toHaveCount(1); await expect(dialog(page)).toContainText('Activité 1 sur 2'); expect(await sessions(page, database)).toHaveLength(2);
});

for (const abrupt of [false, true]) test(`worker interrompu : ${abrupt ? 'aucun bilan sur liste incertaine' : 'liste terminale récupérable'}`, async ({ page }) => {
  const database = await prepare(page);
  await page.evaluate(({ abrupt, root }) => {
    class SyntheticWorker {
      onmessage?: (event: { data: unknown }) => void;
      onerror?: () => void;
      terminate() {}
      postMessage(input: { database: string; batchId: string }) {
        void (async () => {
          const { createSessionRepository } = await import(/* @vite-ignore */ root + 'storage/database.ts');
          await createSessionRepository(input.database).addImported({ id: 'confirmed', title: 'Synthétique', date: '2026-10-20', durationSeconds: 600 });
          if (abrupt) this.onerror?.();
          else {
            const report = { imported: 1, processed: 1, total: 2, duplicates: 0, ignored: 0, invalid: 0, reasons: {}, issues: [], error: 'Interruption synthétique' };
            this.onmessage?.({ data: { type: 'done', batchId: 'lot-périmé', importedIds: ['inconnu'], report } });
            this.onmessage?.({ data: { type: 'error', batchId: input.batchId, importedIds: ['confirmed'], report } });
            this.onmessage?.({ data: { type: 'done', batchId: input.batchId, importedIds: ['confirmed'], report } });
          }
        })();
      }
    }
    Object.defineProperty(window, 'Worker', { value: SyntheticWorker, configurable: true });
  }, { abrupt, root });
  await page.getByLabel('Sélectionner les fichiers').setInputFiles({ name: 'synthetic.zip', mimeType: 'application/zip', buffer: Buffer.from('synthetic') });
  await page.getByRole('button', { name: 'Importer les séances', exact: true }).click();
  if (abrupt) { await expect(page.getByText('Import interrompu.', { exact: false })).toBeVisible(); await expect(dialog(page)).toHaveCount(0); }
  else { await expect(dialog(page)).toHaveCount(1); await expect(dialog(page)).toContainText('20/10/2026'); await dialog(page).getByRole('button', { name: 'Plus tard', exact: true }).click(); await expect(dialog(page)).toHaveCount(0); }
  expect(await sessions(page, database)).toHaveLength(1);
});

test('profil changé pendant le bilan : réponses conservées et brouillon abandonné', async ({ page }) => {
  const database = await prepare(page);
  await importFiles(page, [tcx(0), tcx(1)]);
  const other = await page.evaluate(async root => {
    const { createRunnerProfile } = await import(/* @vite-ignore */ root + 'storage/profile-registry.ts');
    return createRunnerProfile({ displayName: 'Profil B synthétique' });
  }, root);
  const editor = dialog(page).locator('[data-testid="session-review"]:visible');
  await editor.getByLabel('Commentaire personnel (facultatif)').fill('A enregistré');
  await dialog(page).getByRole('button', { name: 'Enregistrer et suivant', exact: true }).click();
  await expect(dialog(page)).toContainText('Activité 2 sur 2');
  await editor.getByLabel('Commentaire personnel (facultatif)').fill('Brouillon A');
  await page.evaluate(async id => { await (window as unknown as { __runklmrunSelectActiveProfile: (id: string) => Promise<void> }).__runklmrunSelectActiveProfile(id); }, other.id);
  await expect(dialog(page)).toHaveCount(0); expect((await sessions(page, database)).filter(session => session.feeling?.comment === 'A enregistré')).toHaveLength(1);
  expect((await sessions(page, database)).some(session => session.feeling?.comment === 'Brouillon A')).toBe(false);
  await expect(page.locator('.app-shell')).toHaveJSProperty('inert', false);
  await page.getByRole('navigation').getByRole('link', { name: 'Courses', exact: true }).click();
  const manualB = await manual(page); await manualB.getByRole('button', { name: 'Enregistrer la sortie', exact: true }).click();
  await dialog(page).getByLabel('Commentaire personnel (facultatif)').fill('Profil B'); await dialog(page).getByRole('button', { name: 'Enregistrer', exact: true }).click();
  expect((await sessions(page, other.databaseName))[0].feeling?.comment).toBe('Profil B');
  expect((await sessions(page, database)).filter(session => session.feeling?.comment === 'A enregistré')).toHaveLength(1);
  expect((await sessions(page, database)).some(session => session.feeling?.comment === 'Brouillon A')).toBe(false);
});

test('création manuelle tardive après changement de profil : aucune ouverture ni écriture croisée', async ({ page }) => {
  const database = await prepare(page), form = await manual(page);
  const other = await page.evaluate(async root => {
    const { createRunnerProfile } = await import(/* @vite-ignore */ root + 'storage/profile-registry.ts');
    return createRunnerProfile({ displayName: 'Destination synthétique' });
  }, root);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      const request = original.apply(this, args);
      if (this.name === 'sessions') {
        IDBObjectStore.prototype.add = original;
        let released = false;
        Object.assign(window, { __releaseSynthetic: () => { released = true; } });
        const keepAlive = () => { if (!released) this.get('synthetic-missing-key').onsuccess = keepAlive; };
        keepAlive();
      }
      return request;
    };
  });
  await form.getByRole('button', { name: 'Enregistrer la sortie', exact: true }).click();
  await expect(form.getByRole('button', { name: 'Enregistrer la sortie', exact: true })).toBeDisabled();
  await expect(dialog(page)).toHaveCount(0);
  await page.evaluate(async id => { await (window as unknown as { __runklmrunSelectActiveProfile: (id: string) => Promise<void> }).__runklmrunSelectActiveProfile(id); }, other.id);
  await expect(page.getByRole('combobox', { name: 'Profil actif', exact: true })).toHaveValue(other.id);
  await page.evaluate(() => (window as unknown as { __releaseSynthetic: () => void }).__releaseSynthetic());
  await expect.poll(async () => (await sessions(page, database)).length).toBe(1);
  await expect(dialog(page)).toHaveCount(0); expect(await sessions(page, other.databaseName)).toHaveLength(0);
});

test('suppression du profil depuis un autre onglet : fermeture du bilan', async ({ page, context }) => {
  const database = await prepare(page), form = await manual(page);
  const profiles = await page.evaluate(async ({ root, database }) => {
    const { createRunnerProfile, readProfileRegistry } = await import(/* @vite-ignore */ root + 'storage/profile-registry.ts');
    const other = await createRunnerProfile({ displayName: 'Profil conservé synthétique' });
    const current = (await readProfileRegistry()).profiles.find((profile: { databaseName: string }) => profile.databaseName === database);
    return { current, other };
  }, { root, database });
  await form.getByRole('button', { name: 'Enregistrer la sortie', exact: true }).click();
  await dialog(page).getByLabel('Commentaire personnel (facultatif)').fill('Brouillon du profil supprimé');
  const otherTab = await context.newPage(); await otherTab.goto('./');
  await expect(otherTab.getByRole('combobox', { name: 'Profil actif', exact: true })).toBeVisible();
  await otherTab.evaluate(async ({ root, profiles }) => {
    const { markRunnerProfileDeleting, deleteRunnerProfileDatabase } = await import(/* @vite-ignore */ root + 'storage/profile-registry.ts');
    const pending = await markRunnerProfileDeleting(profiles.current.id, profiles.other.id, profiles.current.revision);
    await deleteRunnerProfileDatabase(pending.id, pending.deletion.operationId);
  }, { root, profiles });
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Profil actif', exact: true })).toHaveValue(profiles.other.id);
  expect(await sessions(page, profiles.other.databaseName)).toHaveLength(0);
  expect(await page.evaluate(async database => (await indexedDB.databases()).some(item => item.name === database), database)).toBe(false);
});

test('conflit dans la fenêtre : brouillon conservé, aucune avance automatique', async ({ page }) => {
  const database = await prepare(page); await importFiles(page, [tcx(0), tcx(1)]);
  const modal = dialog(page), editor = modal.locator('[data-testid="session-review"]:visible');
  await editor.getByLabel('Commentaire personnel (facultatif)').fill('Brouillon local');
  await page.evaluate(async ({ root, database }) => {
    const { createSessionRepository } = await import(/* @vite-ignore */ root + 'storage/database.ts');
    const { createSessionReviewRepository } = await import(/* @vite-ignore */ root + 'storage/session-review.ts');
    const repository = createSessionReviewRepository(database);
    for (const session of await createSessionRepository(database).list()) await repository.save(await repository.get(session.id), { feeling: { comment: 'Modification externe' } });
  }, { root, database });
  await modal.getByRole('button', { name: 'Enregistrer et suivant', exact: true }).click();
  await expect(editor.getByRole('alert')).toBeVisible(); await expect(modal).toContainText('Activité 1 sur 2');
  await expect(editor.getByLabel('Commentaire personnel (facultatif)')).toHaveValue('Brouillon local');
  await editor.getByRole('button', { name: 'Recharger le bilan', exact: true }).click();
  await expect(editor.getByLabel('Commentaire personnel (facultatif)')).toHaveValue('Modification externe');
  await modal.getByRole('button', { name: 'Quitter le bilan', exact: true }).click(); await expect(modal).toHaveCount(0);
});
