import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Home } from './pages/Home';
import { History } from './pages/History';
import { Training } from './pages/Training';
import { Settings } from './pages/Settings';
import { sessionRepository } from './storage/database';
import type { RunningSession } from './types/session';

const Statistics = lazy(() => import('./pages/Statistics').then(module => ({ default: module.Statistics })));

const navigation = [
  { path: '/', label: 'Accueil', symbol: '⌂' },
  { path: '/historique', label: 'Historique', symbol: '≡' },
  { path: '/statistiques', label: 'Statistiques', symbol: '▥' },
  { path: '/entrainement', label: 'Entraînement', symbol: '↗' },
  { path: '/parametres', label: 'Paramètres', symbol: '⚙' },
];

function subscribe(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}
function getPath() { return window.location.hash.slice(1) || '/'; }

type DataState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; sessions: RunningSession[] };

export function App() {
  const path = useSyncExternalStore(subscribe, getPath);
  const currentPage = navigation.find((item) => item.path === path);
  const [data, setData] = useState<DataState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(path);

  useEffect(() => {
    let active = true;
    setData({ status: 'loading' });
    sessionRepository.list().then(
      (sessions) => { if (active) setData({ status: 'ready', sessions }); },
      () => { if (active) setData({ status: 'error' }); },
    );
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    document.title = `${currentPage?.label ?? 'Page introuvable'} — runKLMrun`;
    if (previousPath.current !== path) {
      mainRef.current?.focus();
      previousPath.current = path;
    }
  }, [path, currentPage]);

  const needsData = path === '/' || path === '/historique' || path === '/statistiques';
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link" onClick={(event) => { event.preventDefault(); mainRef.current?.focus(); }}>Aller au contenu</a>
      <header className="site-header">
        <a href="#/" className="brand" aria-label="runKLMrun — Accueil"><span className="brand-mark" aria-hidden="true">r.</span>runKLMrun</a>
        <span className="local-label"><span aria-hidden="true" />Vos données, sur cet appareil</span>
      </header>
      <nav className="navigation" aria-label="Navigation principale">
        {navigation.map((item) => <a key={item.path} href={`#${item.path}`} aria-current={path === item.path ? 'page' : undefined}><span aria-hidden="true">{item.symbol}</span>{item.label}</a>)}
      </nav>
      <main id="main-content" ref={mainRef} tabIndex={-1}>
        {needsData && data.status === 'loading' && <div className="panel status" role="status">Ouverture de votre espace local…</div>}
        {needsData && data.status === 'error' && <div className="panel status" role="alert"><h1>Stockage local indisponible</h1><p>Vos données n’ont pas pu être chargées. Vérifiez que votre navigateur autorise le stockage de ce site, puis réessayez.</p><button className="button" onClick={() => setAttempt((value) => value + 1)}>Réessayer</button></div>}
        {path === '/' && data.status === 'ready' && <Home sessions={data.sessions} />}
        {path === '/historique' && data.status === 'ready' && <History sessions={data.sessions} />}
        {path === '/statistiques' && data.status === 'ready' && <Suspense fallback={<p role="status">Chargement des graphiques…</p>}><Statistics sessions={data.sessions} /></Suspense>}
        {path === '/entrainement' && <Training />}
        <div hidden={path !== '/parametres'}><Settings onImported={() => setAttempt(value => value + 1)} /></div>
        {!currentPage && <section className="panel status"><h1>Page introuvable</h1><p>Cette page n’existe pas.</p><a className="button" href="#/">Revenir à l’accueil</a></section>}
      </main>
      <footer><span>runKLMrun</span><span>Un pas après l’autre. À votre rythme.</span></footer>
    </div>
  );
}
