import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomePage } from './pages/HomePage';
import { CreateGamePage } from './pages/CreateGamePage';
import { GameTablePage } from './pages/GameTablePage';
import { FinishPage } from './pages/FinishPage';
import { HistoryPage } from './pages/HistoryPage';
import { ChipCalculatorPage } from './pages/ChipCalculatorPage';
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
            <Route path="/table" element={<GameTablePage />} />
            <Route path="/finish" element={<FinishPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/chips" element={<ChipCalculatorPage />} />
            <Route path="/scheduled" element={<ScheduledGamesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </BrowserRouter>
      </GameProvider>
    </ErrorBoundary>
  );
}

export default App;
