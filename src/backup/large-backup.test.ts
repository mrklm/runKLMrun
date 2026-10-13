import { expect, it } from 'vitest';
import { exportGzip, readBackupFile } from './compression';
import { fixture } from './test-fixture';

/** Contrôle lourd volontairement séparé du cycle rapide :
 * RUN_LARGE_BACKUP_TEST=1 npm test -- src/backup/large-backup.test.ts --maxWorkers=1
 * Aucun fichier ni aucune donnée personnelle. */
it.skipIf(process.env.RUN_LARGE_BACKUP_TEST !== '1')('exporte et relit un GPS peu profond dépassant réellement les 40 millions d’anciens jetons', async () => {
  const data = fixture(), count = 4_500_000;
  data.details[0].gps = Array.from({ length: count }, (_, i) => ({
    timeSeconds: i / 8,
    latitude: i % 101 === 0 ? null : i % 90,
    longitude: i % 101 === 0 ? null : -(i % 180),
    altitudeMeters: i % 100,
  }));
  expect(count * 9).toBeGreaterThan(40_000_000); // Ancien compteur : 1 objet + 4 clés + 4 primitives.
  expect(count).toBeLessThan(8_000_000); // Ce cas ne dépasse pas l’ancien compteur de conteneurs.
  const { file, jsonBytes } = await exportGzip(data, '0.4.0');
  expect(jsonBytes).toBeGreaterThan(128 * 1024 * 1024);
  const restored = await readBackupFile(file);
  expect(restored.data.sessions).toEqual(data.sessions);
  expect(restored.data.coachProfile).toEqual(data.coachProfile);
  expect(restored.data.details[0].gps).toHaveLength(count);
  // Chaque temps, valeur et interruption doit être identique, sans copie d’assertion géante.
  const actual = restored.data.details[0].gps!, original = data.details[0].gps!;
  let mismatches = 0;
  for (let i = 0; i < count; i++) if (actual[i].timeSeconds !== original[i].timeSeconds || actual[i].latitude !== original[i].latitude || actual[i].longitude !== original[i].longitude || actual[i].altitudeMeters !== original[i].altitudeMeters) mismatches++;
  expect(mismatches).toBe(0);
  console.info(`Contrôle synthétique : ${jsonBytes} octets JSON → ${file.size} octets gzip ; ${count} échantillons vérifiés.`);
}, 300000);
