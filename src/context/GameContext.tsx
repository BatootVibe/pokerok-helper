import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Game, GamePlayer } from '../types';
import { GAMES_KEY, CURRENT_GAME_ID_KEY, CHIP_INPUTS_KEY } from '../utils/constants';
import { generateId } from '../utils/id';

// === localStorage helpers (inline, изолированные) ===

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

// === Context ===

interface GameContextType {
  currentGame: Game | null;
  createGame: (players: { name: string; userId?: number }[], startingChips: number, buyInRubles: number, chipPresetId: string | null, venue: string, chipPresetIsTemporary?: boolean) => void;
  addPlayer: (player: { name: string; userId?: number }) => void;
  incrementRebuy: (playerId: string) => void;
  decrementRebuy: (playerId: string) => void;
  removePlayer: (playerId: string) => void;
  finishGame: () => void;
  selectedPresetId: string | null;
  setSelectedPresetId: (id: string | null) => void;
  updateGame: (game: Game) => void;
  chipPresetIsTemporary: boolean;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [chipPresetIsTemporary, setChipPresetIsTemporary] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const saveTimerRef = useRef<number | null>(null);

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

  // Debounced сохранение при каждом изменении (не чаще 300мс)
  useEffect(() => {
    if (!initialized || !currentGame) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      const games = loadGames();
      games[currentGame.id] = currentGame;
      saveGames(games);
      saveCurrentGameId(currentGame.id);
      saveTimerRef.current = null;
    }, 300);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [currentGame, initialized]);

  const createGame = useCallback((players: { name: string; userId?: number }[], startingChips: number, buyInRubles: number, chipPresetId: string | null, venue: string, chipPresetIsTemporary?: boolean) => {
    const safeStartingChips = startingChips > 0 ? startingChips : 1;
    const gamePlayers: GamePlayer[] = players.map(p => ({
      id: generateId(),
      name: p.name,
      userId: p.userId,
      rebuyQty: 0,
    }));

    const game: Game = {
      id: generateId(),
      date: new Date().toISOString(),
      players: gamePlayers,
      startingChips: safeStartingChips,
      buyInRubles,
      chipPriceRubles: buyInRubles / safeStartingChips,
      chipPresetId,
      venue,
    };

    setCurrentGame(game);
    setSelectedPresetId(chipPresetId);
    setChipPresetIsTemporary(!!chipPresetIsTemporary);
  }, []);

  const addPlayer = useCallback((player: { name: string; userId?: number }) => {
    setCurrentGame(prev => {
      if (!prev) return prev;
      const newPlayer: GamePlayer = { id: generateId(), name: player.name, userId: player.userId, rebuyQty: 0 };
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

  const finishGame = useCallback(() => {
    // Сначала flush-им pending save
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    
    // Удаляем из активных игр ПОСЛЕ сохранения
    const game = currentGame;
    if (game) {
      const games = loadGames();
      delete games[game.id];
      saveGames(games);
      clearCurrentGameId();
      // Очищаем введённые фишки
      localStorage.removeItem(CHIP_INPUTS_KEY + game.id);
    }
    
    setCurrentGame(null);
    setSelectedPresetId(null);
    setChipPresetIsTemporary(false);
  }, [currentGame]);

  // Убран useEffect удаления — логика перенесена в finishGame

  if (!initialized) {
    return (
      <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Загрузка...</p>
      </div>
    );
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
        finishGame,
        selectedPresetId,
        setSelectedPresetId,
        updateGame,
        chipPresetIsTemporary,
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
