import { StrictMode } from 'react';
import { createRoot,type Root } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { themeStore } from './themes/theme-store';
import { startSuggestionReconciliation } from './storage/suggestion-reconciliation';

// Restaurer les couleurs avant le premier rendu de React.
themeStore.initialize();
const stopReconciliation = startSuggestionReconciliation();
if (import.meta.hot) import.meta.hot.dispose(stopReconciliation);

const container=document.getElementById('root')! as HTMLElement&{runklmrunRoot?:Root};
const root=container.runklmrunRoot??=createRoot(container);
root.render(
  <StrictMode><App /></StrictMode>,
);
