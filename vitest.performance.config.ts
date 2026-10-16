import { defineConfig } from 'vitest/config';

/** Mesure manuelle de charge, hors validation fonctionnelle de publication. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/experimental/**/*.performance.ts'],
    // Pas de budget machine universel : affiche la durée réelle, garde les assertions.
    // Ce lancement explicite peut être interrompu avec Ctrl+C.
    testTimeout: 0,
    maxWorkers: 1,
  },
});
