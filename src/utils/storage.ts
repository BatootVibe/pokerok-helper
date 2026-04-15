import { ChipPreset, CompletedGame, ScheduledGame } from '../types';
import { apiGetGames, apiSaveGame, apiClearAllGames, apiGetPresets, apiSavePreset, apiDeletePreset, apiDeleteGame, apiGetScheduled, apiSaveScheduled, apiDeleteScheduled, apiHealthCheck, apiGet, apiPost, apiPut, apiRequest, apiGetVenues, apiSaveVenue, apiDeleteVenue } from './api';
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
    // Обновляем кэш только после успешного сохранения в API
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
    // API недоступен — не сохраняем в localStorage чтобы не было рассинхрона
    throw new Error('Не удалось сохранить игру на сервер');
  }
}

export async function deleteCompletedGame(id: string): Promise<void> {
  try {
    await apiDeleteGame(id);
    // Обновляем кэш после успешного удаления
    let history: CompletedGame[] = [];
    try {
      history = JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || '[]');
    } catch {
      // corrupted
    }
    const updated = history.filter((g: CompletedGame) => g.id !== id);
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    apiAvailable = false;
    apiLastFailTime = Date.now();
    throw new Error('Не удалось удалить игру с сервера');
  }
}

export async function clearGameHistory(): Promise<void> {
  try {
    await apiClearAllGames();
    localStorage.removeItem(LOCAL_HISTORY_KEY);
  } catch {
    apiAvailable = false;
    apiLastFailTime = Date.now();
    throw new Error('Не удалось очистить историю на сервере');
  }
  // Сбрасываем кэш последней игры
  window.lastGamePlayers = undefined;
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
  for (const preset of presets) {
    await apiSavePreset(preset);
  }
  // Сохраняем в кэш только после успешного сохранения всех пресетов в API
  localStorage.setItem(LOCAL_PRESETS_KEY, JSON.stringify(presets));
}

export async function deletePreset(id: string): Promise<void> {
  await apiDeletePreset(id);
  // Обновляем кэш после успешного удаления
  const presets = JSON.parse(localStorage.getItem(LOCAL_PRESETS_KEY) || '[]');
  const updated = presets.filter((p: ChipPreset) => p.id !== id);
  localStorage.setItem(LOCAL_PRESETS_KEY, JSON.stringify(updated));
}

// === Venues ===

export async function loadVenues(): Promise<string[]> {
  return withFallback(
    () => apiGetVenues(),
    LOCAL_VENUES_KEY,
    [],
  );
}

export async function saveVenue(name: string): Promise<void> {
  await apiSaveVenue(name);
  // Обновляем кэш после успешного сохранения
  const venues = await loadVenues();
  if (!venues.includes(name)) {
    venues.unshift(name);
    localStorage.setItem(LOCAL_VENUES_KEY, JSON.stringify(venues));
  }
}

export async function deleteVenue(name: string): Promise<void> {
  await apiDeleteVenue(name);
  // Обновляем кэш после успешного удаления
  const venues = await loadVenues();
  const updated = venues.filter(v => v !== name);
  localStorage.setItem(LOCAL_VENUES_KEY, JSON.stringify(updated));
}

// === Scheduled Games ===

export async function loadScheduledGames(): Promise<ScheduledGame[]> {
  return withFallback(
    () => apiGetScheduled(),
    LOCAL_SCHEDULED_KEY,
    [],
  ).then(games =>
    (games || []).filter(g =>
      g && typeof g.id === 'string' && typeof g.venue === 'string' &&
      typeof g.scheduledAt === 'string' && Array.isArray(g.players)
    )
  );
}

export async function saveScheduledGame(game: ScheduledGame): Promise<void> {
  try {
    await apiSaveScheduled(game);
  } catch {
    apiAvailable = false;
    apiLastFailTime = Date.now();
    throw new Error('Не удалось сохранить игру на сервер');
  }
  // Обновляем кэш только после успешного сохранения в API
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
    throw new Error('Не удалось удалить игру с сервера');
  }
  // Обновляем кэш напрямую, без запроса к API
  let games: ScheduledGame[] = [];
  try {
    games = JSON.parse(localStorage.getItem(LOCAL_SCHEDULED_KEY) || '[]');
  } catch {
    // corrupted
  }
  const filtered = games.filter((g: ScheduledGame) => g.id !== id);
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

/** Получает профиль текущего пользователя (только имя). */
export async function getUserProfile(): Promise<{ name: string } | null> {
  try {
    const data = await apiGet<{ name: string } | null>('/api/users/me');
    if (data && data.name) {
      localStorage.setItem(LOCAL_USER_PROFILE_KEY + 'current', JSON.stringify(data));
      return data;
    }
  } catch {
    try {
      const cached = localStorage.getItem(LOCAL_USER_PROFILE_KEY + 'current');
      if (cached) return JSON.parse(cached);
    } catch { /* ignore */ }
  }
  return null;
}

/** Привязка: сервер сам определяет пользователя из подписи. */
export async function saveUserProfile(profile: { name: string }): Promise<{ success: boolean; error?: string }> {
  try {
    await apiPost('/api/users', profile);
  } catch (e: unknown) {
    const apiErr = e as { status?: number; body?: { error?: string } };
    if (apiErr.status === 409 && apiErr.body?.error) {
      return { success: false, error: apiErr.body.error };
    }
    return { success: false, error: 'Ошибка при привязке. Попробуйте ещё раз.' };
  }
  localStorage.setItem(LOCAL_USER_PROFILE_KEY + 'current', JSON.stringify(profile));
  return { success: true };
}

/** Удаление профиля. */
export async function deleteUserProfile(): Promise<void> {
  try {
    await apiRequest('/api/users', { method: 'DELETE' });
  } catch {
    apiAvailable = false;
    apiLastFailTime = Date.now();
    throw new Error('Не удалось отвязать аккаунт на сервере');
  }
  localStorage.removeItem(LOCAL_USER_PROFILE_KEY + 'current');
}

/** Обновление имени. */
export async function updateUserProfile(profile: { name: string }): Promise<{ success: boolean; error?: string }> {
  try {
    await apiPut('/api/users', profile);
    localStorage.setItem(LOCAL_USER_PROFILE_KEY + 'current', JSON.stringify(profile));
    return { success: true };
  } catch (e: unknown) {
    const apiErr = e as { status?: number; body?: { error?: string } };
    if (apiErr.status === 409 && apiErr.body?.error) {
      return { success: false, error: apiErr.body.error };
    }
    return { success: false, error: 'Ошибка при сохранении. Попробуйте ещё раз.' };
  }
}

/** Собирает профили из localStorage (fallback для офлайн-режима). */
function _getLocalProfiles(): { name: string; userId: number }[] {
  const profiles: { name: string; userId: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(LOCAL_USER_PROFILE_KEY)) {
      try {
        const profile = JSON.parse(localStorage.getItem(key) || '');
        if (profile && profile.name && profile.userId) {
          profiles.push(profile);
        }
      } catch { /* ignore */ }
    }
  }
  return profiles;
}

/**
 * Получает список всех привязанных игроков (id + name).
 * API: из БД. Fallback: из localStorage.
 */
export async function getAllPlayers(): Promise<{ name: string; id: number }[]> {
  const local = _getLocalProfiles();
  try {
    const apiPlayers = await apiGet<{ name: string; id: number }[]>('/api/players');
    const apiIds = new Set(apiPlayers.map(p => p.id));
    const extra = local.filter(p => !apiIds.has(p.userId));
    return [...apiPlayers, ...extra.map(p => ({ name: p.name, id: p.userId }))];
  } catch {
    return local.map(p => ({ name: p.name, id: p.userId }));
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
