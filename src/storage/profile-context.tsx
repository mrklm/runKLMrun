import { createContext, useContext } from 'react';
import type { RunnerProfile } from '../types/runner-profile';
import { DATABASE_NAME } from './database-connection';

export const ProfileDatabaseContext = createContext<string | undefined>(undefined);
export const ActiveProfileContext = createContext<RunnerProfile | undefined>(undefined);
export interface ActiveProfileController { profile: RunnerProfile; selectActiveProfile(id: string): Promise<void>; }
export const ActiveProfileControllerContext = createContext<ActiveProfileController | undefined>(undefined);
export function useActiveProfileController() {
  const controller = useContext(ActiveProfileControllerContext);
  if (!controller) throw new Error('Contrôleur de profil indisponible.');
  return controller;
}
/** Un composant de données doit toujours recevoir une base de profil explicite. */
export function useProfileDatabase() {
  // Compatibilité des rendus isolés et des tests ; l'application montée fournit toujours un profil.
  return useContext(ProfileDatabaseContext) ?? DATABASE_NAME;
}
