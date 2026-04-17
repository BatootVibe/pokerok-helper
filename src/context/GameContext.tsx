import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Game, GamePlayer } from '../types';
import { GAMES_KEY, CURRENT_GAME_ID_KEY, CHIP_INPUTS_KEY } from '../utils/constants';
import { generateId } from '../utils/id';
import { apiSaveActiveGame, apiGetMyActiveGame, apiDeleteActiveGame, ActiveGameResponse } from '../utils/api';
import { apiGet } from '../utils/api';

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
  isOwner: boolean;
  remoteChipInputs: Record<string, Record<number, number>>;
  createGame: (players: { name: string; userId?: number }[], startingChips: number, buyInRubles: number, chipPresetId: string | null, venue: string, chipPresetIsTemporary?: boolean) => void;
  addPlayer: (player: { name: string; userId?: number }) => void;
  incrementRebuy: (playerId: string) => void;
  decrementRebuy: (playerId: string) => void;
  removePlayer: (playerId: string) => void;
  finishGame: () => void;
  selectedPresetId: string | null;
  setSelectedPresetId: (id: string | null) => void;
  updateGame: (game: Game | null) => void;
  updateRemoteChipInputs: (chipInputs: Record<string, Record<number, number>>) => void;
  syncFromServer: () => Promise<ActiveGameResponse | null>;
  chipPresetIsTemporary: boolean;
  myPlayerId: string | null;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const [currentGame, _setCurrentGame] = useState<Game | null>(null);

  const setCurrentGame = useCallback((value: Game | null | ((prev: Game | null) => Game | null)) => {
    if (typeof value === 'function') {
      _setCurrentGame(prev => {
        const next = (value as (prev: Game | null) => Game | null)(prev);
        currentGameRef.current = next;
        return next;
      });
    } else {
      currentGameRef.current = value;
      _setCurrentGame(value);
    }
  }, []);
  const [isOwner, setIsOwner] = useState(true);
  const [remoteChipInputs, setRemoteChipInputs] = useState<Record<string, Record<number, number>>>({});
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [chipPresetIsTemporary, setChipPresetIsTemporary] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const apiSaveTimerRef = useRef<number | null>(null);
  const currentGameRef = useRef<Game | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const profile = await apiGet<{ id: number; name: string } | null>('/api/users/me');
        if (mounted && profile && profile.id) {
          setMyUserId(profile.id);
        }
      } catch {}

      const gameId = loadCurrentGameId();
      if (gameId) {
        const games = loadGames();
        if (games[gameId]) {
          if (mounted) {
            setCurrentGame(games[gameId]);
            setSelectedPresetId(games[gameId].chipPresetId);
            setIsOwner(true);
          }
          setInitialized(true);
          return;
        }
      }

      try {
        const result = await apiGetMyActiveGame();
        console.log('[GameContext] apiGetMyActiveGame result=', result);
        if (mounted && result) {
          setCurrentGame(result.game);
          setSelectedPresetId(result.game.chipPresetId);
          setIsOwner(result.isOwner);
          setRemoteChipInputs(result.chipInputs || {});
          saveCurrentGameId(result.game.id);
          const games = loadGames();
          games[result.game.id] = result.game;
          saveGames(games);
        }
      } catch {}

      if (mounted) setInitialized(true);
    })();

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!initialized || !currentGame) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = window.setTimeout(() => {
      const games = loadGames();
      games[currentGame.id] = currentGame;
      saveGames(games);
      saveCurrentGameId(currentGame.id);
      saveTimerRef.current = null;
    }, 300);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [currentGame, initialized]);

  useEffect(() => {
    if (!initialized || !currentGame || !isOwner) return;

    if (apiSaveTimerRef.current) clearTimeout(apiSaveTimerRef.current);

    apiSaveTimerRef.current = window.setTimeout(() => {
      if (!currentGame) return;
      apiSaveActiveGame(currentGame, {}).catch(() => {});
      apiSaveTimerRef.current = null;
    }, 500);

    return () => {
      if (apiSaveTimerRef.current) clearTimeout(apiSaveTimerRef.current);
    };
  }, [currentGame, initialized, isOwner]);

  const createGame = useCallback((players: { name: string; userId?: number }[], startingChips: number, buyInRubles: number, chipPresetId: string | null, venue: string, chipPresetIsTemporary?: boolean) => {
    console.log('[GameContext] createGame called, players=', players.map(p => ({ name: p.name, userId: p.userId })));
    const prevGame = currentGameRef.current;
    if (prevGame) {
      apiDeleteActiveGame(prevGame.id).catch(() => {});
      const games = loadGames();
      delete games[prevGame.id];
      saveGames(games);
      localStorage.removeItem(CHIP_INPUTS_KEY + prevGame.id);
    }

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
    currentGameRef.current = game;
    setSelectedPresetId(chipPresetId);
    setChipPresetIsTemporary(!!chipPresetIsTemporary);
    setIsOwner(true);
    setRemoteChipInputs({});

    apiSaveActiveGame(game, {}).then(r => console.log('[GameContext] apiSaveActiveGame ok', r)).catch(e => console.error('[GameContext] apiSaveActiveGame FAIL', e));
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

  const updateGame = useCallback((game: Game | null) => {
    setCurrentGame(game);
    if (!game) {
      setSelectedPresetId(null);
      setChipPresetIsTemporary(false);
    }
  }, []);

  const updateRemoteChipInputs = useCallback((chipInputs: Record<string, Record<number, number>>) => {
    setRemoteChipInputs(chipInputs);
  }, []);

  const syncFromServer = useCallback(async (): Promise<ActiveGameResponse | null> => {
    try {
      const result = await apiGetMyActiveGame();
      if (!result) {
        setCurrentGame(null);
        clearCurrentGameId();
        const games = loadGames();
        if (currentGame?.id) {
          delete games[currentGame.id];
          saveGames(games);
        }
        return null;
      }
      setCurrentGame(result.game);
      setSelectedPresetId(result.game.chipPresetId);
      setIsOwner(result.isOwner);
      setRemoteChipInputs(result.chipInputs || {});

      const games = loadGames();
      games[result.game.id] = result.game;
      saveGames(games);
      saveCurrentGameId(result.game.id);

      return result;
    } catch {
      return null;
    }
  }, [currentGame]);

  const finishGame = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (apiSaveTimerRef.current) {
      clearTimeout(apiSaveTimerRef.current);
      apiSaveTimerRef.current = null;
    }

    const game = currentGame;
    if (game) {
      const games = loadGames();
      delete games[game.id];
      saveGames(games);
      clearCurrentGameId();
      localStorage.removeItem(CHIP_INPUTS_KEY + game.id);

      apiDeleteActiveGame(game.id).catch(() => {});
    }

    setCurrentGame(null);
    setSelectedPresetId(null);
    setChipPresetIsTemporary(false);
    setIsOwner(true);
    setRemoteChipInputs({});
  }, [currentGame]);

  const myPlayerId = (() => {
    if (!currentGame || !myUserId) return null;
    const me = currentGame.players.find(p => p.userId === myUserId);
    return me?.id ?? null;
  })();

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
        isOwner,
        remoteChipInputs,
        createGame,
        addPlayer,
        incrementRebuy,
        decrementRebuy,
        removePlayer,
        finishGame,
        selectedPresetId,
        setSelectedPresetId,
        updateGame,
        updateRemoteChipInputs,
        syncFromServer,
        chipPresetIsTemporary,
        myPlayerId,
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
