import { DEFAULT_THEME, findTheme, themeVariables, type ThemeOption } from './themes';
export const THEME_STORAGE_KEY = 'runklmrun.theme';
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
type RootPort = { style: Pick<CSSStyleDeclaration, 'setProperty'> };
export interface ThemeState { theme: ThemeOption; storageUnavailable: boolean }
/** Injection des accès navigateur pour vérifier persistance et application sans IndexedDB. */
export function createThemeStore(root: RootPort, getStorage: () => StoragePort) {
  let state: ThemeState = { theme: DEFAULT_THEME, storageUnavailable: false };
  const listeners = new Set<() => void>();
  const apply = (theme: ThemeOption) => {
    for (const [key, value] of Object.entries(themeVariables(theme))) root.style.setProperty(key, value);
  };
  function initialize() {
    let name: string | null = null, storageUnavailable = false;
    try { name = getStorage().getItem(THEME_STORAGE_KEY); } catch { storageUnavailable = true; }
    state = { theme: findTheme(name), storageUnavailable }; apply(state.theme);
    listeners.forEach(listener => listener());
  }
  function select(name: string) {
    const theme = findTheme(name); let storageUnavailable = false;
    apply(theme);
    try { getStorage().setItem(THEME_STORAGE_KEY, theme.name); } catch { storageUnavailable = true; }
    state = { theme, storageUnavailable }; listeners.forEach(listener => listener());
  }
  return {
    initialize, select, reset: () => select(DEFAULT_THEME.name),
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
export const themeStore = createThemeStore(
  { style: { setProperty: (key, value) => document.documentElement.style.setProperty(key, value) } },
  () => window.localStorage,
);
