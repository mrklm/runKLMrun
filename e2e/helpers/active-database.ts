import type { Page } from '@playwright/test';

export async function activeDatabase(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const registry = await import(/* @vite-ignore */ '/runKLMrun/src/storage/profile-registry.ts');
    const state = await registry.readProfileRegistry();
    if (!state || state.migration !== 'complete') throw new Error('Registre des profils non initialisé.');
    const profile = state.profiles.find(value => value.id === state.lastUsedProfileId && registry.isProfileActive(value))
      ?? state.profiles.find(registry.isProfileActive);
    if (!profile) throw new Error('Profil actif introuvable.');
    if (profile.databaseName !== registry.profileDatabaseName(profile.id)) throw new Error('Base du profil actif invalide.');
    if (typeof indexedDB.databases !== 'function') throw new Error('Vérification non créatrice de la base indisponible.');
    if (!(await indexedDB.databases()).some(value => value.name === profile.databaseName)) throw new Error('Base du profil actif absente.');
    return profile.databaseName;
  });
}
