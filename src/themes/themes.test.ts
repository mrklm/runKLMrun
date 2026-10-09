import { describe, expect, it } from 'vitest';
import { contrast, DEFAULT_THEME, GROUPS, THEMES, THEME_VARIABLES, themeVariables } from './themes';
import { createThemeStore, THEME_STORAGE_KEY } from './theme-store';

function environment(initial?: string) {
  const saved = new Map<string, string>(initial === undefined ? [] : [[THEME_STORAGE_KEY, initial]]);
  const css = new Map<string, string>();
  const root = { style: { setProperty: (key: string, value: string) => { css.set(key, value); } } };
  const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value); } };
  return { saved, css, root, storage, store: createThemeStore(root, () => storage) };
}

describe('catalogue des thèmes', () => {
  it('contient les 16 noms complets et les trois groupes attendus', () => {
    expect(THEMES.map(t => t.name)).toEqual(['Midnight Garage', 'AIR-KLM Night flight', 'Café Serré', 'Matrix Déjà Vu', 'Miami Vice 1987', 'Cyber Licorne', 'AIR-KLM Day flight', 'Matin Brumeux', 'Latte Vanille', 'Miellerie La Divette', 'Chewing-gum Océan', 'Pamplemousse', 'Raisin Toxique', 'Citron qui pique', 'Barbie Apocalypse', 'Compagnie Créole']);
    expect(GROUPS).toEqual(['Sombre', 'Clair', 'Pouêt']);
    expect(GROUPS.map(group => THEMES.filter(t => t.group === group).length)).toEqual([6, 4, 6]);
    expect(DEFAULT_THEME.name).toBe('Midnight Garage');
  });
  it.each(THEMES)('$name : six couleurs valides appliquées sans modification', theme => {
    expect(Object.keys(theme.colors)).toEqual(['BG', 'PANEL', 'FIELD', 'FG', 'FIELD_FG', 'ACCENT']);
    const variables = themeVariables(theme);
    for (const [key, variable] of Object.entries(THEME_VARIABLES)) {
      const color = theme.colors[key as keyof typeof theme.colors];
      expect(color).toMatch(/^#[0-9A-F]{6}$/);
      expect(variables[variable]).toBe(color);
    }
  });
  it.each(THEMES)('$name : textes et liens lisibles sur chaque surface', theme => {
    const variables = themeVariables(theme), c = theme.colors;
    for (const [background, foreground] of [[c.BG, '--page-fg'], [c.PANEL, '--panel-fg'], [c.FIELD, '--field-text'], [c.ACCENT, '--accent-fg'], [c.BG, '--page-link'], [c.PANEL, '--panel-link'], [c.FIELD, '--progress-fill']]) {
      expect(contrast(background, variables[foreground])).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('préserve la palette Compagnie Créole tout en adaptant son texte sur le fond', () => {
    const theme = THEMES.find(t => t.name === 'Compagnie Créole')!;
    const vars = themeVariables(theme);
    expect(vars['--bg']).toBe('#8B3A1A'); expect(vars['--fg']).toBe('#5A2E0C');
    expect(vars['--page-fg']).not.toBe(vars['--fg']);
    expect(vars['--panel-fg']).toBe(vars['--fg']);
  });
});

describe('application et préférence locale', () => {
  it('applique Midnight Garage au premier démarrage', () => {
    const { store, css } = environment(); store.initialize();
    expect(store.getSnapshot().theme.name).toBe('Midnight Garage');
    expect(css.get('--bg')).toBe('#151515'); expect(css.get('--accent')).toBe('#FF9800');
  });
  it('applique immédiatement le choix et avertit ses abonnés', () => {
    const { store, css } = environment(); store.initialize(); let notifications = 0;
    const unsubscribe = store.subscribe(() => notifications++);
    store.select('Café Serré');
    expect(css.get('--bg')).toBe('#1B120C'); expect(css.get('--field-fg')).toBe('#FFF4E6');
    expect(store.getSnapshot().theme.name).toBe('Café Serré'); expect(notifications).toBe(1);
    unsubscribe(); store.reset(); expect(notifications).toBe(1);
  });
  it('restaure le choix après un nouveau démarrage et ne touche aucune autre préférence', () => {
    const { store, root, storage, saved } = environment(); saved.set('autre-preference', 'conserver');
    store.initialize(); store.select('AIR-KLM Night flight');
    expect(saved.get(THEME_STORAGE_KEY)).toBe('AIR-KLM Night flight');
    const reopened = createThemeStore(root, () => storage); reopened.initialize();
    expect(reopened.getSnapshot().theme.name).toBe('AIR-KLM Night flight');
    expect(saved.get('autre-preference')).toBe('conserver');
  });
  it('revient au thème par défaut et persiste ce retour', () => {
    const { store, saved, css } = environment('Pamplemousse'); store.initialize(); store.reset();
    expect(saved.get(THEME_STORAGE_KEY)).toBe(DEFAULT_THEME.name);
    expect(css.get('--panel')).toBe('#1F1F1F'); expect(store.getSnapshot().theme).toBe(DEFAULT_THEME);
  });
  it('revient au défaut si la préférence enregistrée est inconnue', () => {
    const { store, css } = environment('ancien-theme'); store.initialize();
    expect(store.getSnapshot().theme).toBe(DEFAULT_THEME); expect(css.get('--bg')).toBe('#151515');
  });
  it('ne permet pas d’injecter une couleur via une préférence inconnue', () => {
    const { store, css } = environment(); store.select('url(https://example.invalid)');
    expect(css.get('--bg')).toBe('#151515'); expect(store.getSnapshot().theme).toBe(DEFAULT_THEME);
  });
  it('reste utilisable lorsque l’accès à localStorage est interdit', () => {
    const { root, css } = environment();
    const store = createThemeStore(root, () => { throw new Error('Access denied'); });
    store.initialize(); store.select('Citron qui pique');
    expect(css.get('--bg')).toBe('#FFF200'); expect(store.getSnapshot().storageUnavailable).toBe(true);
    store.reset(); expect(css.get('--bg')).toBe('#151515');
  });
  it('signale une écriture refusée sans annuler le changement visuel', () => {
    const { root, css } = environment();
    const store = createThemeStore(root, () => ({ getItem: () => 'Latte Vanille', setItem: () => { throw new Error('Quota'); } }));
    store.initialize(); expect(store.getSnapshot().storageUnavailable).toBe(false);
    store.select('Cyber Licorne'); expect(css.get('--accent')).toBe('#FF2CF7');
    expect(store.getSnapshot().storageUnavailable).toBe(true);
  });
});
