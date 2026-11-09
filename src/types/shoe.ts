export interface Shoe {
  id: string;
  name: string;
  brand?: string;
  purchaseDate?: string;
  firstUseDate?: string;
  /** Repères personnels en kilomètres, facultatifs, sans valeur universelle. */
  limitKm?: number;
  /** Ancienne marge, conservée pour les données et sauvegardes ; ignorée par le suivi. */
  warningKm?: number;
  /** Couleurs de l'icône, facultatives : sans elles, l'image d'origine (sauvegarde format 11). */
  colors?: ShoeColors;
  status: 'active' | 'archived';
  isDefault: boolean;
  revision: number;
}
/** Couleurs hexadécimales `#rrggbb` en minuscules, une par zone de l'icône. */
export interface ShoeColors { upper: string; laces: string; midsole: string; stripes: string; outsole: string }
/** Une seule association par séance ; aucun champ ajouté au résumé Polar. */
export interface ShoeAssignment { sessionId: string; shoeId: string }
export interface ShoeData { settings?: ShoeSettings; shoes: Shoe[]; shoeAssignments: ShoeAssignment[] }
export interface ShoeSettings { id: 'local'; mode: 'automatic' | 'manual'; revision: number }
