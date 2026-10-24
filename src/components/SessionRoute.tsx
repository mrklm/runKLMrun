import { Component, lazy, Suspense, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { prepareSessionRoute } from '../core/analysis/session-route';
import type { DetailsState } from '../storage/load-session-details';

const SessionMap = lazy(() => import('./SessionMap'));
class MapLoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <p role="alert">La carte n’a pas pu être chargée. Vérifiez votre connexion puis rechargez la fiche.</p> : this.props.children;
  }
}

/** Aucun accès au stockage : réutilise les détails déjà lus par la fiche. */
export function SessionRoute({ state }: { state: DetailsState }) {
  const headingId = useId();
  const panelId = useId();
  const points = state.status === 'ready' ? state.details?.gps : undefined;
  const route = useMemo(() => prepareSessionRoute(points), [points]);
  const hasRoute = state.status === 'ready' && route.pointCount > 0;
  const [open, setOpen] = useState<boolean | undefined>(() => state.status === 'loading' ? undefined : hasRoute);
  useEffect(() => {
    if (open === undefined && state.status !== 'loading') setOpen(hasRoute);
  }, [hasRoute, open, state.status]);
  const expanded = open ?? false;
  const title = hasRoute || state.status === 'loading' ? 'Parcours GPS' : 'Parcours GPS · Indisponible';
  return <section className="panel settings-panel session-route-panel" aria-labelledby={headingId}>
    <h2 id={headingId}><button type="button" className="session-route-toggle" aria-expanded={expanded} aria-controls={panelId}
      onClick={() => setOpen(value => !(value ?? false))}>{title}<span aria-hidden="true">{expanded ? '▾' : '▸'}</span></button></h2>
    <div id={panelId} hidden={!expanded}>
      {expanded && <>
        {state.status === 'loading' && <p role="status">Chargement des coordonnées GPS…</p>}
        {state.status === 'error' && <p>Les coordonnées GPS n’ont pas pu être lues. Utilisez « Réessayer » ci-dessous.</p>}
        {state.status === 'ready' && (route.pointCount === 0
          ? <p>Coordonnées GPS indisponibles. Les détails peuvent être absents ou ne plus être conservés.</p>
          : <>
            {route.pointCount === 1 && <p>Un seul point GPS disponible : sa position est affichée sans tracé de parcours.</p>}
            <MapLoadBoundary><Suspense fallback={<p role="status">Chargement de la carte…</p>}>
              <SessionMap route={route} />
            </Suspense></MapLoadBoundary>
          </>)}
      </>}
    </div>
  </section>;
}
