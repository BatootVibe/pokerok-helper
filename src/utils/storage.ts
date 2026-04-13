import { ChipPreset, CompletedGame, ScheduledGame } from '../types';
import { apiGetGames, apiSaveGame, apiClearAllGames, apiGetPresets, apiSavePreset, apiDeletePreset, apiDeleteGame, apiGetScheduled, apiSaveScheduled, apiDeleteScheduled, apiHealthCheck, apiGet, apiPost } from './api';
import {
  LOCAL_HISTORY_KEY,
  LOCAL_PRESETS_KEY,
  LOCAL_VENUES_KEY,
  LOCAL_SCHEDULED_KEY,
  LOCAL_USER_PROFILE_KEY,
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
    let history: CompletedGame[] = [];
    try {
      history = JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || '[]');
    } catch {
      // corrupted data, start fresh
    }
    history.unshift(game);
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(history));
  } catch {
    apiAvailable = false;
    apiLastFailTime = Date.now();
    let history: CompletedGame[] = [];
    try {
      history = JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || '[]');
    } catch {
      // corrupted
    }
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
  let history: CompletedGame[] = [];
  try {
    history = JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || '[]');
  } catch {
    // corrupted
  }
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

// === Venues (localStorage only) ===

export function loadVenues(): string[] {
  const data = localStorage.getItem(LOCAL_VENUES_KEY);
  try {
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
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
  // Обновляем localStorage: заменяем существующую или добавляем новую
  let games: ScheduledGame[] = [];
  try {
    games = JSON.parse(localStorage.getItem(LOCAL_SCHEDULED_KEY) || '[]');
  } catch {
    // corrupted
  }
  const existingIdx = games.findIndex((g: ScheduledGame) => g.id === game.id);
  if (existingIdx >= 0) {
    games[existingIdx] = game;
  } else {
    games.unshift(game);
  }
  localStorage.setItem(LOCAL_SCHEDULED_KEY, JSON.stringify(games));
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

// === User Profile & Players ===

export async function getUserProfile(tgId: string): Promise<{ name: string; tgId: string } | null> {
  // Сначала пробуем из localStorage
  try {
    const cached = localStorage.getItem(LOCAL_USER_PROFILE_KEY + tgId);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // ignore
  }

  // Если нет в localStorage — пробуем API
  try {
    const data = await apiGet<{ name: string; tgId: string } | null>(`/api/users/${tgId}`);
    // Кэшируем в localStorage
    if (data) {
      localStorage.setItem(LOCAL_USER_PROFILE_KEY + tgId, JSON.stringify(data));
    }
    return data;
  } catch {
    return null;
  }
}

export async function saveUserProfile(profile: { name: string; tgId: string }): Promise<void> {
  // Всегда сохраняем в localStorage
  localStorage.setItem(LOCAL_USER_PROFILE_KEY + profile.tgId, JSON.stringify(profile));

  try {
    await apiPost('/api/users', profile);
  } catch (e) {
    console.error('Failed to save profile to API', e);
  }
}

/**
 * Собирает все профили из localStorage.
 * Работает даже если API недоступен.
 */
function _getLocalProfiles(): { name: string; tgId: string }[] {
  const profiles: { name: string; tgId: string }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(LOCAL_USER_PROFILE_KEY)) {
      try {
        const profile = JSON.parse(localStorage.getItem(key) || '');
        if (profile && profile.name && profile.tgId) {
          profiles.push(profile);
        }
      } catch {
        // ignore
      }
    }
  }
  return profiles;
}

export async function getAllPlayers(): Promise<{ name: string; tgId: string | null }[]> {
  // Всегда собираем профили из localStorage
  const local = _getLocalProfiles();

  // Пробуем получить с API
  try {
    const apiPlayers = await apiGet<{ name: string; tgId: string | null }[]>('/api/players');
    // Объединяем: API-игроки + локальные, которых нет в API
    const apiTgIds = new Set(apiPlayers.map(p => p.tgId).filter((id): id is string => Boolean(id)));
    const extra = local.filter(p => !apiTgIds.has(p.tgId));
    return [...apiPlayers, ...extra.map(p => ({ name: p.name, tgId: p.tgId }))];
  } catch {
    // API недоступен — возвращаем только localStorage профили
    return local.map(p => ({ name: p.name, tgId: p.tgId }));
  }
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
