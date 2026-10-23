import type { SessionDetails } from '../../types/session';

type GpsPoint = NonNullable<SessionDetails['gps']>[number];
export type RoutePosition = [latitude: number, longitude: number];
export interface SessionRoute {
  /** Positions d'affichage : les longitudes peuvent dépasser 180° pour cadrer l'antiméridien. */
  segments: RoutePosition[][];
  start: RoutePosition | null;
  end: RoutePosition | null;
  bounds: [RoutePosition, RoutePosition] | null;
  pointCount: number;
}

export function validGpsCoordinates(point: GpsPoint): boolean {
  return typeof point.latitude === 'number' && Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90
    && typeof point.longitude === 'number' && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180;
}
const validTime = (point: GpsPoint) => Number.isFinite(point.timeSeconds) && point.timeSeconds >= 0;

/** Copie chronologique stable, sans déplacer une mesure au-delà d'une rupture temporelle inconnue. */
function chronological(points: readonly GpsPoint[]): GpsPoint[] {
  const ordered: GpsPoint[] = [];
  let run: GpsPoint[] = [];
  const flush = () => { run.sort((a, b) => a.timeSeconds - b.timeSeconds); for (const point of run) ordered.push(point); run = []; };
  for (const point of points) {
    if (validTime(point)) run.push(point);
    else { flush(); ordered.push(point); }
  }
  flush();
  return ordered;
}

/** Lecture seule ; aucune interpolation ni réduction des mesures enregistrées.
 * Les trous restent dans la séquence triée et interrompent les lignes.
 * On coupe aussi aux franchissements de ±180°, puis on cadre dans le plus petit arc de longitude.
 */
export function prepareSessionRoute(points: readonly GpsPoint[] = []): SessionRoute {
  const ordered = chronological(points);
  const valid = ordered.filter(point => validTime(point) && validGpsCoordinates(point));
  if (!valid.length) return { segments: [], start: null, end: null, bounds: null, pointCount: 0 };
  const longitudes = valid.map(point => (point.longitude! + 360) % 360).sort((a, b) => a - b);
  let west = longitudes[0], largestGap = -1;
  for (let i = 0; i < longitudes.length; i++) {
    const next = i + 1 < longitudes.length ? longitudes[i + 1] : longitudes[0] + 360;
    if (next - longitudes[i] > largestGap) { largestGap = next - longitudes[i]; west = next % 360; }
  }
  const shift = west > 180 ? -360 : 0;
  const position = (point: GpsPoint): RoutePosition => {
    const longitude = (point.longitude! + 360) % 360;
    return [point.latitude!, longitude + (longitude < west ? 360 : 0) + shift];
  };
  const segments: RoutePosition[][] = [];
  let segment: RoutePosition[] = [], previous: GpsPoint | undefined;
  let south = Infinity, north = -Infinity, east = -Infinity, left = Infinity;
  const flush = () => { if (segment.length) segments.push(segment); segment = []; previous = undefined; };
  for (const point of ordered) {
    if (!validTime(point) || !validGpsCoordinates(point)) { flush(); continue; }
    const current = position(point);
    // Aucune ligne à travers le monde, même pour une trace couvrant un très grand arc.
    if (previous && (Math.abs(point.longitude! - previous.longitude!) > 180
      || Math.abs(current[1] - segment[segment.length - 1][1]) > 180)) flush();
    segment.push(current); previous = point;
    south = Math.min(south, current[0]); north = Math.max(north, current[0]);
    left = Math.min(left, current[1]); east = Math.max(east, current[1]);
  }
  flush();
  return { segments, start: position(valid[0]), end: position(valid[valid.length - 1]),
    bounds: [[south, left], [north, east]], pointCount: valid.length };
}
