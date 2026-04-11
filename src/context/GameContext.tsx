import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Game, GamePlayer, FinishedPlayerChips } from '../types';
import { generateId } from '../utils/storage';

const GAMES_KEY = 'poker_games';
const CURRENT_GAME_ID_KEY = 'poker_current_game_id';

function loadGames(): Record<string, Game> {
  try {
    const data = localStorage.getItem(GAMES_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveGames(games: Record<string, Game>) {
  localStorage.setItem(GAMES_KEY, JSON.stringify(games));
}

function loadCurrentGameId(): string | null {
  return localStorage.getItem(CURRENT_GAME_ID_KEY);
}

function saveCurrentGameId(id: string) {
  localStorage.setItem(CURRENT_GAME_ID_KEY, id);
}

function clearCurrentGameId() {
  localStorage.removeItem(CURRENT_GAME_ID_KEY);
}

interface GameContextType {
  currentGame: Game | null;
  createGame: (players: string[], startingChips: number, buyInRubles: number, chipPresetId: string | null, venue: string) => void;
  addPlayer: (name: string) => void;
  incrementRebuy: (playerId: string) => void;
  decrementRebuy: (playerId: string) => void;
  removePlayer: (playerId: string) => void;
  playerChips: Record<string, FinishedPlayerChips>;
  setPlayerChips: (playerId: string, chips: FinishedPlayerChips) => void;
  finishGame: () => void;
  selectedPresetId: string | null;
  setSelectedPresetId: (id: string | null) => void;
  updateGame: (game: Game) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [playerChips, setPlayerChips] = useState<Record<string, FinishedPlayerChips>>({});
  const [initialized, setInitialized] = useState(false);

  // Загрузка текущей игры при старте
  useEffect(() => {
    const gameId = loadCurrentGameId();
    if (gameId) {
      const games = loadGames();
      if (games[gameId]) {
        setCurrentGame(games[gameId]);
        setSelectedPresetId(games[gameId].chipPresetId);
      }
    }
    setInitialized(true);
  }, []);

  // Сохранение при каждом изменении
  useEffect(() => {
    if (!initialized) return;
    if (!currentGame) return;
    const games = loadGames();
    games[currentGame.id] = currentGame;
    saveGames(games);
    saveCurrentGameId(currentGame.id);
  }, [currentGame, initialized]);

  const createGame = useCallback((players: string[], startingChips: number, buyInRubles: number, chipPresetId: string | null, venue: string) => {
    const gamePlayers: GamePlayer[] = players.map(name => ({
      id: generateId(),
      name,
      rebuyQty: 0,
    }));

    const game: Game = {
      id: generateId(),
      date: new Date().toISOString(),
      players: gamePlayers,
      startingChips,
      buyInRubles,
      chipPriceRubles: buyInRubles / startingChips,
      chipPresetId,
      venue,
    };

    setCurrentGame(game);
    setSelectedPresetId(chipPresetId);
    setPlayerChips({});
  }, []);

  const addPlayer = useCallback((name: string) => {
    setCurrentGame(prev => {
      if (!prev) return prev;
      const newPlayer: GamePlayer = { id: generateId(), name, rebuyQty: 0 };
      return { ...prev, players: [...prev.players, newPlayer] };
    });
  }, []);

  const incrementRebuy = useCallback((playerId: string) => {
    setCurrentGame(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        players: prev.players.map(p =>
          p.id === playerId ? { ...p, rebuyQty: p.rebuyQty + 1 } : p
        ),
      };
    });
  }, []);

  const decrementRebuy = useCallback((playerId: string) => {
    setCurrentGame(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        players: prev.players.map(p =>
          p.id === playerId ? { ...p, rebuyQty: Math.max(0, p.rebuyQty - 1) } : p
        ),
      };
    });
  }, []);

  const removePlayer = useCallback((playerId: string) => {
    setCurrentGame(prev => {
      if (!prev) return prev;
      return { ...prev, players: prev.players.filter(p => p.id !== playerId) };
    });
  }, []);

  const updateGame = useCallback((game: Game) => {
    setCurrentGame(game);
  }, []);

  const setPlayerChipsFn = useCallback((playerId: string, chips: FinishedPlayerChips) => {
    setPlayerChips(prev => ({ ...prev, [playerId]: chips }));
  }, []);

  const finishGame = useCallback(() => {
    setCurrentGame(prev => {
      if (!prev) return prev;
      // Удаляем из сохранённых
      const games = loadGames();
      delete games[prev.id];
      saveGames(games);
      clearCurrentGameId();
      return null;
    });
    setSelectedPresetId(null);
    setPlayerChips({});
  }, []);

  if (!initialized) {
    return <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Загрузка...</p>
    </div>;
  }

  return (
    <GameContext.Provider
      value={{
        currentGame,
        createGame,
        addPlayer,
        incrementRebuy,
        decrementRebuy,
        removePlayer,
        playerChips,
        setPlayerChips: setPlayerChipsFn,
        finishGame,
        selectedPresetId,
        setSelectedPresetId,
        updateGame,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextType {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
}
