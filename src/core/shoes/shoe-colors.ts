import type { ShoeColors } from '../../types/shoe';

/** Zones de l'icône dans l'ordre du formulaire ; calques générés par scripts/basket-zones.py.
 * Clés inchangées depuis la v1.6.0 : `midsole` et `outsole` désignent les parties haute et basse de la semelle. */
export const SHOE_COLOR_ZONES = ['upper', 'laces', 'stripes', 'midsole', 'outsole'] as const;
/** Ordre de superposition : fonds d'abord, puis les bandes, qui recouvrent la tige. */
export const SHOE_COLOR_LAYERS = ['upper', 'laces', 'midsole', 'outsole', 'stripes'] as const;
export const shoeColorLabels: Readonly<Record<keyof ShoeColors, string>> = {
  upper: 'Tige', laces: 'Lacets', stripes: 'Bandes', midsole: 'Semelle, partie haute', outsole: 'Semelle, partie basse',
};
/** Couleurs de l'image d'origine : les retrouver revient à ne rien personnaliser. */
export const DEFAULT_SHOE_COLORS: Readonly<ShoeColors> = { upper: '#ffffff', laces: '#ffffff', midsole: '#ffffff', stripes: '#1b1e25', outsole: '#ffffff' };
const HEX = /^#[0-9a-f]{6}$/;

export function isShoeColors(value: unknown): value is ShoeColors {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === SHOE_COLOR_ZONES.length && SHOE_COLOR_ZONES.every(zone => keys.includes(zone))
    && SHOE_COLOR_ZONES.every(zone => typeof (value as Record<string, unknown>)[zone] === 'string' && HEX.test((value as Record<string, string>)[zone]));
}
/** Couleurs à enregistrer : absentes si elles reprennent exactement l'image d'origine. */
export function storedShoeColors(colors?: ShoeColors): ShoeColors | undefined {
  if (!colors) return undefined;
  const normalized = Object.fromEntries(SHOE_COLOR_ZONES.map(zone => [zone, colors[zone].toLowerCase()])) as unknown as ShoeColors;
  return SHOE_COLOR_ZONES.every(zone => normalized[zone] === DEFAULT_SHOE_COLORS[zone]) ? undefined : normalized;
}
