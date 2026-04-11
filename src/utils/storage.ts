import { ChipPreset, CompletedGame, ScheduledGame } from '../types';
import { apiGetGames, apiSaveGame, apiClearAllGames, apiGetPresets, apiSavePreset, apiDeletePreset, apiDeleteGame, apiGetScheduled, apiSaveScheduled, apiDeleteScheduled } from './api';

const LOCAL_HISTORY_KEY = 'poker_game_history';
const LOCAL_PRESETS_KEY = 'poker_chip_presets';
const LOCAL_VENUES_KEY = 'poker_venues';
const LOCAL_SCHEDULED_KEY = 'poker_scheduled_games';

let apiAvailable = true;

async function withFallback<T>(apiCall: () => Promise<T>, localStorageKey: string | null, localDefault: T): Promise<T> {
  if (!apiAvailable) {
    if (localStorageKey) {
      const data = localStorage.getItem(localStorageKey);
      return data ? JSON.parse(data) : localDefault;
    }
    return localDefault;
  }
  try {
    const result = await apiCall();
    return result;
  } catch {
    apiAvailable = false;
    if (localStorageKey) {
      const data = localStorage.getItem(localStorageKey);
      return data ? JSON.parse(data) : localDefault;
    }
    return localDefault;
  }
}

export async function loadGameHistory(): Promise<CompletedGame[]> {
  return withFallback(
    () => apiGetGames(),
    LOCAL_HISTORY_KEY,
    []
  );
}

export async function addCompletedGame(game: CompletedGame): Promise<void> {
  try {
    await apiSaveGame(game);
  } catch {
    apiAvailable = false;
    const history = JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || '[]');
    history.unshift(game);
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(history));
  }
}

export async function deleteCompletedGame(id: string): Promise<void> {
  try {
    await apiDeleteGame(id);
  } catch {
    apiAvailable = false;
  }
}

export async function clearGameHistory(): Promise<void> {
  try {
    await apiClearAllGames();
  } catch {
    apiAvailable = false;
    localStorage.removeItem(LOCAL_HISTORY_KEY);
  }
}

export async function loadPresets(): Promise<ChipPreset[]> {
  return withFallback(
    () => apiGetPresets(),
    LOCAL_PRESETS_KEY,
    []
  );
}

export async function savePresets(presets: ChipPreset[]): Promise<void> {
  // Сохраняем каждый пресет отдельно
  for (const preset of presets) {
    try {
      await apiSavePreset(preset);
    } catch {
      apiAvailable = false;
    }
  }
  localStorage.setItem(LOCAL_PRESETS_KEY, JSON.stringify(presets));
}

export async function deletePreset(id: string): Promise<void> {
  try {
    await apiDeletePreset(id);
  } catch {
    apiAvailable = false;
  }
  // Обновляем localStorage в любом случае
  const presets = JSON.parse(localStorage.getItem(LOCAL_PRESETS_KEY) || '[]');
  const updated = presets.filter((p: ChipPreset) => p.id !== id);
  localStorage.setItem(LOCAL_PRESETS_KEY, JSON.stringify(updated));
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

// Места проведения (пока только localStorage)
export function loadVenues(): string[] {
  const data = localStorage.getItem(LOCAL_VENUES_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveVenue(name: string): void {
  const venues = loadVenues();
  if (!venues.includes(name)) {
    venues.unshift(name);
    localStorage.setItem(LOCAL_VENUES_KEY, JSON.stringify(venues));
  }
}

export function deleteVenue(name: string): void {
  const venues = loadVenues().filter(v => v !== name);
  localStorage.setItem(LOCAL_VENUES_KEY, JSON.stringify(venues));
}

// Запланированные игры
export async function loadScheduledGames(): Promise<ScheduledGame[]> {
  return withFallback(
    () => apiGetScheduled(),
    LOCAL_SCHEDULED_KEY,
    []
  );
}

export async function saveScheduledGame(game: ScheduledGame): Promise<void> {
  try {
    await apiSaveScheduled(game);
  } catch {
    apiAvailable = false;
    const games = await loadScheduledGames();
    games.unshift(game);
    localStorage.setItem(LOCAL_SCHEDULED_KEY, JSON.stringify(games));
  }
}

export async function deleteScheduledGame(id: string): Promise<void> {
  try {
    await apiDeleteScheduled(id);
  } catch {
    apiAvailable = false;
  }
  const games = await loadScheduledGames();
  const filtered = games.filter(g => g.id !== id);
  localStorage.setItem(LOCAL_SCHEDULED_KEY, JSON.stringify(filtered));
}

// Проверка — есть ли запланированная игра рядом по времени (±30 мин)
export async function findNearbyScheduledGame(): Promise<ScheduledGame | null> {
  const games = await loadScheduledGames();
  const now = new Date();
  const margin = 30 * 60 * 1000; // 30 минут в мс

  for (const game of games) {
    const scheduled = new Date(game.scheduledAt).getTime();
    if (Math.abs(now.getTime() - scheduled) <= margin) {
      return game;
    }
  }
  return null;
}
