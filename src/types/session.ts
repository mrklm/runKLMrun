/** Données brutes d'une sortie. Les unités sont explicites ; aucun calcul ici. */
export interface RunningSession {
  id: string;
  title: string;
  /** Date civile au format YYYY-MM-DD. */
  date: string;
  distanceMeters: number;
  durationSeconds: number;
}
