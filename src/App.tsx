import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { GameProvider } from './context/GameContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RequireGame } from './components/RequireGame';
import { ToastContainer } from './components/Toast';
import { HomePage } from './pages/HomePage';
import './App.css';

const CreateGamePage = lazy(() => import('./pages/CreateGamePage'));
const GameTablePage = lazy(() => import('./pages/GameTablePage'));
const ChipCountPage = lazy(() => import('./pages/ChipCountPage'));
const ResultsPage = lazy(() => import('./pages/ResultsPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const PresetsPage = lazy(() => import('./pages/PresetsPage'));
const ScheduledGamesPage = lazy(() => import('./pages/ScheduledGamesPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

function PageLoader() {
  return (
    <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Загрузка...</p>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <GameProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/create" element={<CreateGamePage />} />
              <Route
                path="/table"
                element={
                  <RequireGame>
                    <GameTablePage />
                  </RequireGame>
                }
              />
              <Route
                path="/chips-count"
                element={
                  <RequireGame>
                    <ChipCountPage />
                  </RequireGame>
                }
              />
              <Route
                path="/results"
                element={
                  <RequireGame>
                    <ResultsPage />
                  </RequireGame>
                }
              />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/presets" element={<PresetsPage />} />
              <Route path="/scheduled" element={<ScheduledGamesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={<HomePage />} />
            </Routes>
          </Suspense>
          <ToastContainer />
        </BrowserRouter>
      </GameProvider>
    </ErrorBoundary>
  );
}

export default App;
