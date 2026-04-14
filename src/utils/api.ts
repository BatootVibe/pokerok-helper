import { CompletedGame, ChipPreset, ScheduledGame } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';
const API_TIMEOUT = 30000; // 30 секунд

interface ApiError extends Error {
  status?: number;
  body?: unknown;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...options,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const error = new Error(`API error: ${res.status} ${res.statusText}`) as ApiError;
      error.status = res.status;
      try {
        error.body = await res.json();
      } catch {
        // Response body not JSON
      }
      throw error;
    }

    return res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      const error = new Error('Request timeout') as ApiError;
      error.status = 504;
      throw error;
    }
    throw err;
  }
}

// Generic helpers
export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// Games
export function apiGetGames(): Promise<CompletedGame[]> {
  return request<CompletedGame[]>('/api/games');
}

export function apiSaveGame(game: CompletedGame): Promise<{ success: boolean }> {
  const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  return request('/api/games', {
    method: 'POST',
    body: JSON.stringify({ ...game, tgId }),
  });
}

export function apiDeleteGame(id: string): Promise<{ success: boolean }> {
  const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  return request(`/api/games/${id}?tgId=${tgId}`, { method: 'DELETE' });
}

export function apiClearAllGames(): Promise<{ success: boolean }> {
  const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  return request(`/api/games?tgId=${tgId}`, { method: 'DELETE' });
}

// Presets
export function apiGetPresets(): Promise<ChipPreset[]> {
  return request<ChipPreset[]>('/api/presets');
}

export function apiSavePreset(preset: ChipPreset): Promise<{ success: boolean }> {
  const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  return request('/api/presets', {
    method: 'POST',
    body: JSON.stringify({ ...preset, tgId }),
  });
}

export function apiDeletePreset(id: string): Promise<{ success: boolean }> {
  const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  return request(`/api/presets/${id}?tgId=${tgId}`, { method: 'DELETE' });
}

// Scheduled Games
export function apiGetScheduled(): Promise<ScheduledGame[]> {
  return request<ScheduledGame[]>('/api/scheduled');
}

export function apiSaveScheduled(game: ScheduledGame): Promise<{ success: boolean }> {
  const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  return request('/api/scheduled', {
    method: 'POST',
    body: JSON.stringify({ ...game, tgId }),
  });
}

export function apiDeleteScheduled(id: string): Promise<{ success: boolean }> {
  const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  return request(`/api/scheduled/${id}?tgId=${tgId}`, { method: 'DELETE' });
}

// Venues
export function apiGetVenues(): Promise<string[]> {
  return request<string[]>('/api/venues');
}

export function apiSaveVenue(name: string): Promise<{ success: boolean }> {
  return request('/api/venues', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function apiDeleteVenue(name: string): Promise<{ success: boolean }> {
  return request(`/api/venues/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

// Health check
export function apiHealthCheck(): Promise<{ status: string }> {
  return request('/api/health');
}

// Users
export function apiDeleteUser(tgId: string): Promise<{ success: boolean }> {
  return request(`/api/users/${tgId}`, { method: 'DELETE' });
}
