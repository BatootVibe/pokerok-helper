import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RequireGame } from './components/RequireGame';
import { HomePage } from './pages/HomePage';
import { CreateGamePage } from './pages/CreateGamePage';
import { GameTablePage } from './pages/GameTablePage';
import { ChipCountPage } from './pages/ChipCountPage';
import { ResultsPage } from './pages/ResultsPage';
import { HistoryPage } from './pages/HistoryPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { PresetsPage } from './pages/PresetsPage';
import { ScheduledGamesPage } from './pages/ScheduledGamesPage';
import { SettingsPage } from './pages/SettingsPage';
import './App.css';

function App() {
  return (
    <ErrorBoundary>
      <GameProvider>
        <BrowserRouter>
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
            <Route path="*" element={<HomePage />} />
          </Routes>
        </BrowserRouter>
      </GameProvider>
    </ErrorBoundary>
  );
}

export default App;
