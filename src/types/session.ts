import type { OptionalSessionFeeling } from './evolving-coach';
import type { AscentEstimate } from '../core/analysis/ascent';
export type DocumentedActivityType='easy-endurance'|'endurance-variations'|'long-run'|'steady-run'|'intervals'|'hills'|'recovery';
export const documentedActivityTypeLabels:Readonly<Record<DocumentedActivityType,string>>={
  'easy-endurance':'Endurance facile','endurance-variations':'Variations modérées','long-run':'Sortie longue',
  'steady-run':'Séance soutenue',intervals:'Fractionné',hills:'Côtes',recovery:'Récupération',
};
export const isDocumentedActivityType=(value:unknown):value is DocumentedActivityType=>
  typeof value==='string'&&Object.hasOwn(documentedActivityTypeLabels,value);
/** Résumé léger. Distances/altitudes en m, durées en s, FC en bpm. */
export interface RunningSession {
  id: string;
  /** Annotation personnelle facultative, jamais déduite des mesures. */
  feeling?: OptionalSessionFeeling;
  /** Déclaration facultative du coureur ; jamais déduite des mesures ou suggestions. */
  trainingType?: DocumentedActivityType;
  /** Description déclarée, sans classification implicite. */
  trainingDescription?: string;
  title: string;
  date: string;
  startTime?: string;
  polarId?: string;
  source?: 'tcx';
  sport?: string;
  polarSportId?: string;
  timezoneOffsetMinutes?: number;
  distanceMeters?: number;
  durationSeconds: number;
  averageHeartRate?: number;
  maximumHeartRate?: number;
  ascentMeters?: number;
  ascentEstimate?: AscentEstimate;
  descentMeters?: number;
  averagePaceSecondsPerKm?: number;
  heartRateZones?: { lower?: number; upper?: number; durationSeconds?: number }[];
  runningIndex?: number;
  /** Score cardiovasculaire fourni par Polar, sans calcul runKLMrun. */
  cardioLoad?: number;
}
export interface Sample { timeSeconds: number; value: number | null }
export interface SessionDetails {
  id: string;
  /** Métadonnées TCX facultatives ; aucun changement des magasins IndexedDB. */
  laps?: { startTime: string; durationSeconds: number; distanceMeters?: number }[];
  cadenceUnit?: 'rpm' | 'source';
  heartRate?: Sample[];
  speed?: Sample[];
  cadence?: Sample[];
  altitude?: Sample[];
  distance?: Sample[];
  /** Origine temporelle des points GPS (temps relatifs à cette route). */
  gpsStartTime?: string;
  gps?: { timeSeconds: number; latitude: number | null; longitude: number | null; altitudeMeters?: number }[];
}
