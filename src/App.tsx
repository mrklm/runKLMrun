import { Shoes } from './components/Shoes';
import { createRetentionService } from './storage/detail-retention';
import { subscribeStorage } from './storage/changes';
import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { appVersion, Branding, SplashScreen } from './components/Branding';
import { Home } from './pages/Home';
import { Courses } from './pages/Courses';
import { Training } from './pages/Training';
import { Settings } from './pages/Settings';
import { Help } from './pages/Help';
import { StorageBlockedError } from './storage/database-connection';
import { createSessionRepository } from './storage/database';
import { bootstrapProfiles } from './storage/profile-bootstrap';
import { ActiveProfileContext, ActiveProfileControllerContext, ProfileDatabaseContext } from './storage/profile-context';
import { selectProfile } from './storage/profile-bootstrap';
import { isProfileActive, readProfileRegistry, replacementProfile, subscribeProfileRegistry } from './storage/profile-registry';
import { operationBusy, useOperationBusy } from './components/operation-guard';
import type { RunnerProfile } from './types/runner-profile';
import { sessionIdFromPath } from './core/analysis/session-detail';
import type { RunningSession } from './types/session';

const Session = lazy(() => import('./pages/Session').then(module => ({ default: module.Session })));


const pages = [
  { path: '/', label: 'Accueil', symbol: '⌂' },
  { path: '/courses', label: 'Courses', symbol: '≡' },
  { path: '/entrainement', label: 'Coach', symbol: '↗' },
  { path: '/chaussures', label: 'Mes chaussures', symbol: '◒' },
  { path: '/parametres', label: 'Paramètres', symbol: '⚙' },
  { path: '/aide', label: 'Aide', symbol: '?' },
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
  const [profile, setProfile] = useState<RunnerProfile>();
  const [profiles, setProfiles] = useState<RunnerProfile[]>([]);
  const [profileError, setProfileError] = useState(false);
  const [selecting, setSelecting] = useState(false);
  useEffect(() => { let active = true; void bootstrapProfiles().then(result => { if (active) { setProfiles(result.state.profiles.filter(isProfileActive)); setProfile(result.active); } }, () => { if (active) setProfileError(true); }); return () => { active = false; }; }, []);
  useEffect(() => {
    let active=true, running=false, dirty=false;
    const refresh=async()=>{if(running){dirty=true;return;}running=true;try { const state=await readProfileRegistry(); if(!active||!state)return; setProfiles(state.profiles.filter(isProfileActive)); setProfile(current=>{if(!current)return current;const updated=state.profiles.find(item=>item.id===current.id&&isProfileActive(item));if(updated)return updated;const replacement=replacementProfile(state,current.id);if(replacement)return replacement;setProfileError(true);return current;}); } catch { if(active)setProfileError(true); } finally { running=false;if(dirty){dirty=false;void refresh();} }};
    return subscribeProfileRegistry(()=>void refresh());
  }, []);
  const selectActiveProfile = async (id: string) => {
    if (selecting || operationBusy()) throw new Error('Une opération est en cours. Réessayez après sa fin.');
    setSelecting(true);
    try { const selected = await selectProfile(id); setProfile(selected); if (window.location.hash.startsWith('#/seance/')) window.location.hash = '#/'; }
    finally { setSelecting(false); }
  };
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const target = window as Window & { __runklmrunSelectActiveProfile?: (id: string) => Promise<void> };
    target.__runklmrunSelectActiveProfile = selectActiveProfile;
    return () => { delete target.__runklmrunSelectActiveProfile; };
  }, [profile]);
  if (profileError) return <main className="panel status" role="alert">Impossible d’ouvrir les profils locaux.</main>;
  if (!profile) return <main className="panel status" role="status">Ouverture de votre espace local…</main>;
  return <ActiveProfileControllerContext value={{ profile, selectActiveProfile }}><ActiveProfileContext value={profile}><ProfileDatabaseContext value={profile.databaseName}><AppContent key={profile.id} database={profile.databaseName} profiles={profiles} selecting={selecting} selectActiveProfile={selectActiveProfile} /></ProfileDatabaseContext></ActiveProfileContext></ActiveProfileControllerContext>;
}
function ProfileSelect({ profiles, profile, selecting, selectActiveProfile }: { profiles: RunnerProfile[]; profile: RunnerProfile; selecting: boolean; selectActiveProfile: (id: string) => Promise<void> }) {
  const [message,setMessage]=useState('');
  const busy=useOperationBusy();
  return <div className="profile-select"><label htmlFor="active-profile">Profil actif</label><select id="active-profile" value={profile.id} disabled={selecting||busy} onChange={event=>{const id=event.currentTarget.value;void selectActiveProfile(id).then(()=>setMessage(''),error=>setMessage(error instanceof Error?error.message:'Le profil n’a pas pu être sélectionné.'));}}>{profiles.map(item=><option key={item.id} value={item.id}>{item.displayName}</option>)}</select>{busy&&<p role="status">Changement de profil indisponible pendant l’opération en cours.</p>}{message&&<p role="alert">{message}</p>}</div>;
}
function AppContent({ database, profiles, selecting, selectActiveProfile }: { database: string; profiles: RunnerProfile[]; selecting: boolean; selectActiveProfile: (id: string) => Promise<void> }) {
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
        const result = await createRetentionService({ name: database }).maintain({ signal: controller.signal });
        if (!controller.signal.aborted && result?.deleted) setAttempt(value => value + 1);
      } catch {
        // Entretien silencieux : une prochaine ouverture ou importation pourra réessayer.
      } finally { running = false; }
    };
    const timer = window.setTimeout(() => { if (!controller.signal.aborted) void maintain(); }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [database]);
  useEffect(() => subscribeStorage(['sessions'], () => setAttempt(value => value + 1), database), [database]);
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(path);

  useEffect(() => {
    let active = true;
    // Une relecture après notification ne doit pas remonter le Coach comme une nouvelle consultation.
    setData(previous => previous.status === 'ready' ? previous : { status: 'loading' });
    createSessionRepository(database).list().then(
      (sessions) => { if (active) setData({ status: 'ready', sessions }); },
      error => { if (active) setData({ status: 'error', message: error instanceof StorageBlockedError ? error.message : undefined }); },
    );
    return () => { active = false; };
  }, [attempt, database]);

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
    <div className="app-shell" {...(showSplash ? { inert: true } : {})}>
      <a href="#main-content" className="skip-link" onClick={(event) => { event.preventDefault(); mainRef.current?.focus(); }}>Aller au contenu</a>
      <header className="site-header">
        <Branding />
      </header>
      <nav className="navigation" aria-label="Navigation principale">
        {navigation.map((item) => <a key={item.path} href={`#${item.path}`} aria-current={path === item.path ? 'page' : undefined}>{item.path === '/' ? <img className="navigation-home-icon" src={`${import.meta.env.BASE_URL}images/coureur.png`} alt="" /> : <span aria-hidden="true">{item.symbol}</span>}{item.label}</a>)}
        <ProfileSelect profiles={profiles} profile={profiles.find(item=>item.databaseName===database) ?? profiles[0]} selecting={selecting} selectActiveProfile={selectActiveProfile} />
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
        {path === '/aide' && <Help />}
        {!currentPage && !isSession && <section className="panel status"><h1>Page introuvable</h1><p>Cette page n’existe pas.</p><a className="button" href="#/">Revenir à l’accueil</a></section>}
      </main>
      <footer><span>runKLMrun</span><span>{appVersion}</span></footer>
    </div>
    </>
  );
}
