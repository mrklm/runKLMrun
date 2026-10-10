/** Résumé léger. Distances/altitudes en m, durées en s, FC en bpm. */
export interface RunningSession {
  id: string;
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
