import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { themeStore } from './themes/theme-store';

// Restaurer les couleurs avant le premier rendu de React.
themeStore.initialize();

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
