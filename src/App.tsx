import { Shoes } from './components/Shoes';
import { retentionService } from './storage/detail-retention';
import { subscribeStorage } from './storage/changes';
import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Branding, SplashScreen } from './components/Branding';
import { Home } from './pages/Home';
import { Courses } from './pages/Courses';
import { Training } from './pages/Training';
import { Settings } from './pages/Settings';
import { StorageBlockedError } from './storage/database-connection';
import { sessionRepository } from './storage/database';
import { sessionIdFromPath } from './core/analysis/session-detail';
import type { RunningSession } from './types/session';

const Session = lazy(() => import('./pages/Session').then(module => ({ default: module.Session })));


const pages = [
  { path: '/', label: 'Accueil', symbol: '⌂' },
  { path: '/courses', label: 'Courses', symbol: '≡' },
  { path: '/entrainement', label: 'Coach', symbol: '↗' },
  { path: '/chaussures', label: 'Mes chaussures', symbol: '◒' },
  { path: '/parametres', label: 'Paramètres', symbol: '⚙' },
];

const navigation = pages.filter(item => item.path !== '/entrainement' && item.path !== '/chaussures');

function subscribe(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}
function getPath() {
  const hashPath = window.location.hash.slice(1);
  if (hashPath) return hashPath;
  return window.location.pathname.replace(/\/$/, '') === `${import.meta.env.BASE_URL}entrainement` ? '/entrainement' : '/';
}

type DataState = { status: 'loading' } | { status: 'error'; message?: string } | { status: 'ready'; sessions: RunningSession[] };

export function App() {
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 3000);
    return () => window.clearTimeout(timer);
  }, []);
  const route = useSyncExternalStore(subscribe, getPath);
  const path = ['/historique', '/statistiques', '/courses/historique'].includes(route) ? '/courses' : route;
  const isSession = path.startsWith('/seance/');
  const sessionId = sessionIdFromPath(path);
  const currentPage = pages.find((item) => item.path === path);
  const [data, setData] = useState<DataState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    const maintain = async () => {
      if (running || document.visibilityState === 'hidden') return;
      running = true;
      try {
        const result = await retentionService.maintain({ signal: controller.signal });
        if (!controller.signal.aborted && result?.deleted) setAttempt(value => value + 1);
      } catch {
        // Entretien silencieux : une prochaine ouverture ou importation pourra réessayer.
      } finally { running = false; }
    };
    const timer = window.setTimeout(() => { if (!controller.signal.aborted) void maintain(); }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, []);
  useEffect(() => subscribeStorage(['sessions'], () => setAttempt(value => value + 1)), []);
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(path);

  useEffect(() => {
    let active = true;
    // Une relecture après notification ne doit pas remonter le Coach comme une nouvelle consultation.
    setData(previous => previous.status === 'ready' ? previous : { status: 'loading' });
    sessionRepository.list().then(
      (sessions) => { if (active) setData({ status: 'ready', sessions }); },
      error => { if (active) setData({ status: 'error', message: error instanceof StorageBlockedError ? error.message : undefined }); },
    );
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    document.title = `${currentPage?.label ?? (isSession ? 'Fiche de séance' : 'Page introuvable')} — runKLMrun`;
    if (previousPath.current !== path) {
      mainRef.current?.focus();
      previousPath.current = path;
    }
  }, [path, currentPage, isSession]);

  const needsData = path === '/chaussures' || path === '/entrainement' || path === '/parametres' || isSession || path === '/' || path === '/courses';
  return (
    <>
    {showSplash && <SplashScreen />}
    <div className="app-shell" inert={showSplash}>
      <a href="#main-content" className="skip-link" onClick={(event) => { event.preventDefault(); mainRef.current?.focus(); }}>Aller au contenu</a>
      <header className="site-header">
        <Branding />
      </header>
      <nav className="navigation" aria-label="Navigation principale">
        {navigation.map((item) => <a key={item.path} href={`#${item.path}`} aria-current={path === item.path ? 'page' : undefined}><span aria-hidden="true">{item.symbol}</span>{item.label}</a>)}
      </nav>
      <main id="main-content" ref={mainRef} tabIndex={-1}>
        {needsData && data.status === 'loading' && <div className="panel status" role="status">Ouverture de votre espace local…</div>}
        {needsData && data.status === 'error' && <div className="panel status" role="alert"><h1>Stockage local indisponible</h1><p>{data.message ?? 'Vos données n’ont pas pu être chargées. Vérifiez que votre navigateur autorise le stockage de ce site, puis réessayez.'}</p><button className="button" onClick={() => setAttempt((value) => value + 1)}>Réessayer</button></div>}
        {path === '/' && data.status === 'ready' && <Home sessions={data.sessions} />}
        <div hidden={path !== '/courses'}><Courses active={path === '/courses'} ready={data.status === 'ready'} sessions={data.status === 'ready' ? data.sessions : []} showHistory={route === '/courses/historique'} /></div>
        {isSession && data.status === 'ready' && <Suspense fallback={<p role="status">Chargement de la fiche…</p>}><Session key={path} session={data.sessions.find(s => s.id === sessionId)} /></Suspense>}
        {path === '/chaussures' && data.status === 'ready' && <Shoes sessions={data.sessions} />}
        {path === '/entrainement' && data.status === 'ready' && <Training sessions={data.sessions} />}
        <div hidden={path !== '/parametres'}><Settings active={path === '/parametres'} sessions={data.status === 'ready' ? data.sessions : []} /></div>
        {!currentPage && !isSession && <section className="panel status"><h1>Page introuvable</h1><p>Cette page n’existe pas.</p><a className="button" href="#/">Revenir à l’accueil</a></section>}
      </main>
      <footer><span>runKLMrun</span></footer>
    </div>
    </>
  );
}
