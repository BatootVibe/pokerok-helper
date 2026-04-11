import { ChipPreset, CompletedGame, ScheduledGame } from '../types';
import { apiGetGames, apiSaveGame, apiClearAllGames, apiGetPresets, apiSavePreset, apiDeletePreset, apiDeleteGame, apiGetScheduled, apiSaveScheduled, apiDeleteScheduled, apiHealthCheck } from './api';
import {
  LOCAL_HISTORY_KEY,
  LOCAL_PRESETS_KEY,
  LOCAL_VENUES_KEY,
  LOCAL_SCHEDULED_KEY,
  NEARBY_GAME_MARGIN,
  API_AUTO_RESET_INTERVAL,
} from './constants';

/**
 * Флаг доступности API. Автоматически сбрасывается через API_AUTO_RESET_INTERVAL,
 * чтобы периодически проверять восстановление соединения.
 */
let apiAvailable = true;
let apiLastFailTime = 0;

function resetApiAvailability() {
  apiAvailable = true;
}

/** Периодический сброс флага — вызывается при каждой попытке API */
function checkAutoReset() {
  if (!apiAvailable && Date.now() - apiLastFailTime > API_AUTO_RESET_INTERVAL) {
    resetApiAvailability();
  }
}

async function withFallback<T>(
  apiCall: () => Promise<T>,
  localStorageKey: string | null,
  localDefault: T,
): Promise<T> {
  checkAutoReset();

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
    apiLastFailTime = Date.now();
    if (localStorageKey) {
      const data = localStorage.getItem(localStorageKey);
      return data ? JSON.parse(data) : localDefault;
    }
    return localDefault;
  }
}

// === Game History ===

export async function loadGameHistory(): Promise<CompletedGame[]> {
  return withFallback(
    () => apiGetGames(),
    LOCAL_HISTORY_KEY,
    [],
  );
}

export async function addCompletedGame(game: CompletedGame): Promise<void> {
  try {
    await apiSaveGame(game);
    // Обновляем localStorage для консистентности
    const history = JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || '[]');
    history.unshift(game);
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(history));
  } catch {
    apiAvailable = false;
    apiLastFailTime = Date.now();
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
    apiLastFailTime = Date.now();
  }
  // Удаляем из localStorage в любом случае
  const history = JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || '[]');
  const updated = history.filter((g: CompletedGame) => g.id !== id);
  localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(updated));
}

export async function clearGameHistory(): Promise<void> {
  try {
    await apiClearAllGames();
  } catch {
    apiAvailable = false;
    apiLastFailTime = Date.now();
  }
  localStorage.removeItem(LOCAL_HISTORY_KEY);
}

// === Presets ===

export async function loadPresets(): Promise<ChipPreset[]> {
  return withFallback(
    () => apiGetPresets(),
    LOCAL_PRESETS_KEY,
    [],
  );
}

export async function savePresets(presets: ChipPreset[]): Promise<void> {
  const savedIds = new Set<string>();
  for (const preset of presets) {
    try {
      await apiSavePreset(preset);
      savedIds.add(preset.id);
    } catch {
      apiAvailable = false;
      apiLastFailTime = Date.now();
    }
  }
  // Сохраняем в localStorage всегда
  localStorage.setItem(LOCAL_PRESETS_KEY, JSON.stringify(presets));
}

export async function deletePreset(id: string): Promise<void> {
  try {
    await apiDeletePreset(id);
  } catch {
    apiAvailable = false;
    apiLastFailTime = Date.now();
  }
  const presets = JSON.parse(localStorage.getItem(LOCAL_PRESETS_KEY) || '[]');
  const updated = presets.filter((p: ChipPreset) => p.id !== id);
  localStorage.setItem(LOCAL_PRESETS_KEY, JSON.stringify(updated));
}

// === ID generation ===

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

// === Venues (localStorage only) ===

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

// === Scheduled Games ===

export async function loadScheduledGames(): Promise<ScheduledGame[]> {
  return withFallback(
    () => apiGetScheduled(),
    LOCAL_SCHEDULED_KEY,
    [],
  );
}

export async function saveScheduledGame(game: ScheduledGame): Promise<void> {
  try {
    await apiSaveScheduled(game);
  } catch {
    apiAvailable = false;
    apiLastFailTime = Date.now();
  }
  // Обновляем localStorage
  const games = await loadScheduledGames();
  if (!games.some(g => g.id === game.id)) {
    games.unshift(game);
    localStorage.setItem(LOCAL_SCHEDULED_KEY, JSON.stringify(games));
  }
}

export async function deleteScheduledGame(id: string): Promise<void> {
  try {
    await apiDeleteScheduled(id);
  } catch {
    apiAvailable = false;
    apiLastFailTime = Date.now();
  }
  const games = await loadScheduledGames();
  const filtered = games.filter(g => g.id !== id);
  localStorage.setItem(LOCAL_SCHEDULED_KEY, JSON.stringify(filtered));
}

// === Nearby scheduled game ===

export async function findNearbyScheduledGame(): Promise<ScheduledGame | null> {
  const games = await loadScheduledGames();
  const now = new Date();

  for (const game of games) {
    const scheduled = new Date(game.scheduledAt).getTime();
    if (Math.abs(now.getTime() - scheduled) <= NEARBY_GAME_MARGIN) {
      return game;
    }
  }
  return null;
}

// === API availability status ===

export function isApiAvailable(): boolean {
  return apiAvailable;
}

/** Принудительная проверка API (health check) */
export async function checkApiHealth(): Promise<boolean> {
  try {
    await apiHealthCheck();
    apiAvailable = true;
    return true;
  } catch {
    apiAvailable = false;
    apiLastFailTime = Date.now();
    return false;
  }
}
