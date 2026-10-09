export interface Theme {
  BG: string;
  PANEL: string;
  FIELD: string;
  FG: string;
  FIELD_FG: string;
  ACCENT: string;
}
export type ThemeGroup = 'Sombre' | 'Clair' | 'Pouêt';
export interface ThemeOption { name: string; group: ThemeGroup; colors: Theme }
const theme = (group: ThemeGroup, name: string, BG: string, PANEL: string, FIELD: string, FG: string, FIELD_FG: string, ACCENT: string): ThemeOption => ({ group, name, colors: { BG, PANEL, FIELD, FG, FIELD_FG, ACCENT } });
export const THEMES: readonly ThemeOption[] = [
  theme('Sombre', 'Midnight Garage', '#151515', '#1F1F1F', '#2A2A2A', '#EAEAEA', '#F0F0F0', '#FF9800'),
  theme('Sombre', 'AIR-KLM Night flight', '#0B1E2D', '#102A3D', '#16384F', '#EAF6FF', '#FFFFFF', '#00A1DE'),
  theme('Sombre', 'Café Serré', '#1B120C', '#2A1C14', '#3A281D', '#F2E6D8', '#FFF4E6', '#C28E5C'),
  theme('Sombre', 'Matrix Déjà Vu', '#000A00', '#001F00', '#003300', '#00FF66', '#66FF99', '#00FF00'),
  theme('Sombre', 'Miami Vice 1987', '#14002E', '#2B0057', '#004D4D', '#FFF0FF', '#FFFFFF', '#00FFD5'),
  theme('Sombre', 'Cyber Licorne', '#1A0026', '#2E004F', '#3D0066', '#F6E7FF', '#FFFFFF', '#FF2CF7'),
  theme('Clair', 'AIR-KLM Day flight', '#EAF6FF', '#D6EEF9', '#FFFFFF', '#0B2A3F', '#0B2A3F', '#00A1DE'),
  theme('Clair', 'Matin Brumeux', '#E6E7E8', '#D4D7DB', '#FFFFFF', '#1E1F22', '#1E1F22', '#6B7C93'),
  theme('Clair', 'Latte Vanille', '#FAF6F1', '#EFE6DC', '#FFFFFF', '#3D2E22', '#3D2E22', '#D8B892'),
  theme('Clair', 'Miellerie La Divette', '#E6B65C', '#F5E6CC', '#FFFFFF', '#50371A', '#50371A', '#F2B705'),
  theme('Pouêt', 'Chewing-gum Océan', '#00A6C8', '#0083A1', '#00C7B7', '#082026', '#082026', '#FF4FD8'),
  theme('Pouêt', 'Pamplemousse', '#FF4A1C', '#E63B10', '#FF7A00', '#1A0B00', '#1A0B00', '#00E5FF'),
  theme('Pouêt', 'Raisin Toxique', '#7A00FF', '#5B00C9', '#B000FF', '#0F001A', '#0F001A', '#39FF14'),
  theme('Pouêt', 'Citron qui pique', '#FFF200', '#E6D800', '#FFF7A6', '#1A1A00', '#1A1A00', '#0066FF'),
  theme('Pouêt', 'Barbie Apocalypse', '#FF1493', '#004D40', '#1B5E20', '#E8FFF8', '#FFFFFF', '#FFEB3B'),
  theme('Pouêt', 'Compagnie Créole', '#8B3A1A', '#F2C94C', '#FFFFFF', '#5A2E0C', '#5A2E0C', '#8B3A1A'),
];
export const GROUPS: readonly ThemeGroup[] = ['Sombre', 'Clair', 'Pouêt'];
export const DEFAULT_THEME = THEMES[0];
export const THEME_VARIABLES: Record<keyof Theme, string> = { BG: '--bg', PANEL: '--panel', FIELD: '--field', FG: '--fg', FIELD_FG: '--field-fg', ACCENT: '--accent' };
export function findTheme(name: string | null): ThemeOption { return THEMES.find(theme => theme.name === name) ?? DEFAULT_THEME; }

function luminance(hex: string): number {
  const linear = [1, 3, 5].map(i => {
    const value = parseInt(hex.slice(i, i + 2), 16) / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
}
export function contrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
function readable(background: string, preferred: string): string {
  if (contrast(background, preferred) >= 4.5) return preferred;
  return contrast(background, '#000000') >= contrast(background, '#FFFFFF') ? '#000000' : '#FFFFFF';
}
/** Variables dérivées seulement : les six couleurs originales restent intactes. */
export function themeVariables(theme: ThemeOption): Record<string, string> {
  const c = theme.colors;
  return {
    ...Object.fromEntries(Object.entries(THEME_VARIABLES).map(([key, variable]) => [variable, c[key as keyof Theme]])),
    '--page-fg': readable(c.BG, c.FG), '--panel-fg': readable(c.PANEL, c.FG),
    '--field-text': readable(c.FIELD, c.FIELD_FG), '--accent-fg': readable(c.ACCENT, c.FG),
    '--page-link': readable(c.BG, c.ACCENT), '--panel-link': readable(c.PANEL, c.ACCENT),
    '--color-scheme': luminance(c.BG) < .18 ? 'dark' : 'light',
    '--progress-fill': readable(c.FIELD, c.ACCENT),
    '--chart-line': readable(c.PANEL, c.ACCENT), '--chart-grid': readable(c.PANEL, c.FG),
  };
}
