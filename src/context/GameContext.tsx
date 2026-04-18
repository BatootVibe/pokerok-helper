import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Game, GamePlayer } from '../types';
import { GAMES_KEY, CURRENT_GAME_ID_KEY, CHIP_INPUTS_KEY } from '../utils/constants';
import { generateId } from '../utils/id';
import { apiSaveActiveGame, apiGetMyActiveGame, apiDeleteActiveGame } from '../utils/api';
import { apiGet } from '../utils/api';

function enrichPlayersWithUserId(game: Game, myUserId: number | null, myPlayerName: string | null): Game {
  if (!myUserId && !myPlayerName) return game;
  let changed = false;
  const players = game.players.map(p => {
    if (p.userId) return p;
    if (myPlayerName && p.name === myPlayerName) {
      changed = true;
      return { ...p, userId: myUserId ?? undefined };
    }
    return p;
  });
  return changed ? { ...game, players } : game;
}

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
  syncFromServer: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  chipPresetIsTemporary: boolean;
  myPlayerId: string | null;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const [currentGame, _setCurrentGame] = useState<Game | null>(null);
  const [isOwner, setIsOwner] = useState(true);
  const [remoteChipInputs, setRemoteChipInputs] = useState<Record<string, Record<number, number>>>({});
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [chipPresetIsTemporary, setChipPresetIsTemporary] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [myPlayerName, setMyPlayerName] = useState<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const apiSaveTimerRef = useRef<number | null>(null);
  const currentGameRef = useRef<Game | null>(null);
  const remoteChipInputsRef = useRef<Record<string, Record<number, number>>>({});

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

  // === Initialization: always check server ===
  useEffect(() => {
    let mounted = true;

    (async () => {
      let userId: number | null = null;
      let playerName: string | null = null;

      try {
        const profile = await apiGet<{ id: number; name: string } | null>('/api/users/me');
        if (mounted && profile?.id) {
          userId = profile.id;
          playerName = profile.name || null;
          setMyUserId(userId);
          setMyPlayerName(playerName);
        }
      } catch {}

      // Try server first — even if localStorage has a game
      try {
        const result = await apiGetMyActiveGame();
        if (mounted && result) {
          const game = enrichPlayersWithUserId(result.game, userId, playerName);
          setCurrentGame(game);
          setSelectedPresetId(game.chipPresetId);
          setIsOwner(result.isOwner);
          setRemoteChipInputs(result.chipInputs || {});
          remoteChipInputsRef.current = result.chipInputs || {};
          saveCurrentGameId(game.id);
          const games = loadGames();
          games[game.id] = game;
          saveGames(games);
          setInitialized(true);
          return;
        }
        // Server returned null — game was deleted, clean localStorage
        const gameId = loadCurrentGameId();
        if (gameId) {
          const games = loadGames();
          delete games[gameId];
          saveGames(games);
          clearCurrentGameId();
          localStorage.removeItem(CHIP_INPUTS_KEY + gameId);
        }
      } catch {
        // API unavailable — fallback to localStorage
        const gameId = loadCurrentGameId();
        if (gameId) {
          const games = loadGames();
          if (games[gameId] && mounted) {
            setCurrentGame(games[gameId]);
            setSelectedPresetId(games[gameId].chipPresetId);
            setIsOwner(true);
          }
        }
      }

      if (mounted) setInitialized(true);
    })();

    return () => { mounted = false; };
  }, []);

  // Re-enrich players when profile changes (e.g. after binding)
  useEffect(() => {
    if (!currentGame || (!myUserId && !myPlayerName)) return;
    const enriched = enrichPlayersWithUserId(currentGame, myUserId, myPlayerName);
    if (enriched !== currentGame) {
      setCurrentGame(enriched);
    }
  }, [myUserId, myPlayerName]);

  // Debounced save to localStorage
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

  // Poll for active game when none exists (so players see new games on home page)
  useEffect(() => {
    if (!initialized || currentGame) return;

    const poll = async () => {
      try {
        const result = await apiGetMyActiveGame();
        if (result) {
          const game = enrichPlayersWithUserId(result.game, myUserId, myPlayerName);
          setCurrentGame(game);
          setSelectedPresetId(game.chipPresetId);
          setIsOwner(result.isOwner);
          setRemoteChipInputs(result.chipInputs || {});
          remoteChipInputsRef.current = result.chipInputs || {};
          saveCurrentGameId(game.id);
          const games = loadGames();
          games[game.id] = game;
          saveGames(games);
        }
      } catch {}
    };

    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [initialized, currentGame, myUserId, myPlayerName]);

  // Poll server for enriched game data when owner has active game
  useEffect(() => {
    if (!initialized || !currentGame || !isOwner) return;

    const poll = async () => {
      try {
        const result = await apiGetMyActiveGame();
        if (result) {
          const game = enrichPlayersWithUserId(result.game, myUserId, myPlayerName);
          setCurrentGame(prev => {
            if (!prev) return game;
            // Only update if players' userId changed (verified highlight)
            const prevIds = prev.players.map(p => `${p.id}:${p.userId ?? ''}`).join(',');
            const newIds = game.players.map(p => `${p.id}:${p.userId ?? ''}`).join(',');
            if (prevIds === newIds) return prev;
            return { ...prev, players: game.players };
          });
          setRemoteChipInputs(result.chipInputs || {});
          remoteChipInputsRef.current = result.chipInputs || {};
        }
      } catch {}
    };

    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [initialized, currentGame, isOwner, myUserId, myPlayerName]);

  // Debounced save to server (owner only) — sends game data WITHOUT chipInputs
  // Server will preserve existing chipInputs when chipInputs is empty
  useEffect(() => {
    if (!initialized || !currentGame || !isOwner) return;

    if (apiSaveTimerRef.current) clearTimeout(apiSaveTimerRef.current);

    apiSaveTimerRef.current = window.setTimeout(() => {
      if (!currentGameRef.current) return;
      apiSaveActiveGame(currentGameRef.current, {}).catch(() => {});
      apiSaveTimerRef.current = null;
    }, 500);

    return () => {
      if (apiSaveTimerRef.current) clearTimeout(apiSaveTimerRef.current);
    };
  }, [currentGame, initialized, isOwner]);

  const createGame = useCallback((players: { name: string; userId?: number }[], startingChips: number, buyInRubles: number, chipPresetId: string | null, venue: string, chipPresetIsTemporary?: boolean) => {
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
    setSelectedPresetId(chipPresetId);
    setChipPresetIsTemporary(!!chipPresetIsTemporary);
    setIsOwner(true);
    setRemoteChipInputs({});
    remoteChipInputsRef.current = {};

    apiSaveActiveGame(game, {}).catch(() => {});
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
    remoteChipInputsRef.current = chipInputs;
  }, []);

  // syncFromServer — no circular dependency, uses refs
  const syncFromServerRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    syncFromServerRef.current = async () => {
      try {
        const result = await apiGetMyActiveGame();
        if (!result) {
          // Game deleted on server — clean up
          const g = currentGameRef.current;
          if (g) {
            const games = loadGames();
            delete games[g.id];
            saveGames(games);
            localStorage.removeItem(CHIP_INPUTS_KEY + g.id);
          }
          clearCurrentGameId();
          setCurrentGame(null);
          setSelectedPresetId(null);
          setChipPresetIsTemporary(false);
          setIsOwner(true);
          setRemoteChipInputs({});
          remoteChipInputsRef.current = {};
          return;
        }

        const game = enrichPlayersWithUserId(result.game, myUserId, myPlayerName);
        setCurrentGame(game);
        setSelectedPresetId(game.chipPresetId);
        setIsOwner(result.isOwner);
        setRemoteChipInputs(result.chipInputs || {});
        remoteChipInputsRef.current = result.chipInputs || {};

        const games = loadGames();
        games[game.id] = game;
        saveGames(games);
        saveCurrentGameId(game.id);
      } catch {
        // API unavailable — keep current state
      }
    };
  }, [myUserId, myPlayerName]);

  const syncFromServer = useCallback(async () => {
    await syncFromServerRef.current();
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await apiGet<{ id: number; name: string } | null>('/api/users/me');
      if (profile?.id) {
        setMyUserId(profile.id);
        setMyPlayerName(profile.name || null);
      }
    } catch {}
  }, []);

  const finishGame = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (apiSaveTimerRef.current) {
      clearTimeout(apiSaveTimerRef.current);
      apiSaveTimerRef.current = null;
    }

    const game = currentGameRef.current;
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
    remoteChipInputsRef.current = {};
  }, []);

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
        refreshProfile,
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
