/** Messages fixes uniquement : aucune valeur issue des fichiers dans les erreurs. */
export const IMPORT_REASONS = {
  invalidJson: 'Fichier JSON invalide',
  unsupportedStructure: 'Structure non reconnue',
  unknownSport: 'Sport non reconnu',
  otherSport: 'Autre sport',
  missingIdentifier: 'Identifiant manquant ou invalide',
  invalidDate: 'Date invalide ou absente',
  missingDuration: 'Durée manquante',
  invalidNumbers: 'Données numériques invalides',
  oversized: 'Fichier trop volumineux (limite : 64 Mio)',
  decompression: 'Erreur de décompression ou d’intégrité',
  encrypted: 'Fichier chiffré non pris en charge',
} as const;
export type ImportReason = keyof typeof IMPORT_REASONS;
export class PolarImportError extends Error {
  constructor(public readonly reason: ImportReason) { super(IMPORT_REASONS[reason]); }
}
