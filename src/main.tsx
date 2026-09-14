import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeOffline, startSync } from './offline/store';

initializeOffline().then(() => { createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
startSync(); }).catch(error => { document.getElementById('root')!.textContent='Не удалось открыть локальную базу: '+error.message; });
