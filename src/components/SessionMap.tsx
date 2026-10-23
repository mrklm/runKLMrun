import { useEffect, useMemo, useState } from 'react';
import { divIcon } from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import type { RoutePosition, SessionRoute } from '../core/analysis/session-route';
import { sessionMapTiles } from './session-map-tiles';
import 'leaflet/dist/leaflet.css';

const startIcon = divIcon({ className: 'session-map-marker session-map-start', html: '<span aria-hidden="true">D</span>', iconSize: [30, 30], iconAnchor: [15, 30] });
const endIcon = divIcon({ className: 'session-map-marker session-map-end', html: '<span aria-hidden="true">A</span>', iconSize: [30, 30], iconAnchor: [15, 0] });
// Web Mercator ne représente pas les pôles. Limitation d'affichage uniquement.
const MAX_LATITUDE = 85.05112878;
const projected = ([latitude, longitude]: RoutePosition): RoutePosition => [Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, latitude)), longitude];

function RouteViewport({ bounds }: { bounds: [RoutePosition, RoutePosition] }) {
  const map = useMap();
  useEffect(() => {
    const fit = () => {
      map.invalidateSize({ pan: false });
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16, animate: false });
    };
    fit();
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    });
    observer.observe(map.getContainer());
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [map, bounds]);
  return null;
}

export default function SessionMap({ route }: { route: SessionRoute }) {
  const [tileError, setTileError] = useState(false);
  const display = useMemo(() => ({
    segments: route.segments.filter(segment => segment.length > 1).map(segment => segment.map(projected)),
    start: route.start && projected(route.start), end: route.end && projected(route.end),
    bounds: route.bounds && route.bounds.map(projected) as [RoutePosition, RoutePosition] | null,
  }), [route]);
  const tileEvents = useMemo(() => ({ tileerror: () => setTileError(true) }), []);
  if (!display.bounds || !display.start || !display.end) return null;
  return <>
    {tileError && <p role="status">Fond cartographique indisponible ou incomplet. Le tracé GPS reste affiché ; vérifiez votre connexion.</p>}
    {route.bounds && (route.bounds[0][0] < -MAX_LATITUDE || route.bounds[1][0] > MAX_LATITUDE)
      && <p>Les positions proches des pôles sont affichées à la limite du fond cartographique.</p>}
    <div data-testid="session-map" className="session-map-frame" role="region" aria-label="Carte du parcours GPS">
      <MapContainer className="session-map" zoomControl={false} scrollWheelZoom={false}>
        <RouteViewport bounds={display.bounds} />
        <ZoomControl zoomInTitle="Zoom avant" zoomOutTitle="Zoom arrière" />
        <TileLayer {...sessionMapTiles} eventHandlers={tileEvents} keepBuffer={0} />
        {display.segments.map((positions, index) => <Polyline key={index} positions={positions} smoothFactor={1}
          className="session-map-route" pathOptions={{ color: '#1166cc', weight: 4, opacity: 1 }} />)}
        <Marker position={display.start} icon={startIcon} title="Départ du parcours GPS" alt="Départ du parcours GPS">
          <Tooltip>Départ : premier point GPS disponible</Tooltip>
        </Marker>
        <Marker position={display.end} icon={endIcon} title="Arrivée du parcours GPS" alt="Arrivée du parcours GPS">
          <Tooltip>Arrivée : dernier point GPS disponible</Tooltip>
        </Marker>
      </MapContainer>
    </div>
  </>;
}
