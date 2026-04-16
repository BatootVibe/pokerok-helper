import { CompletedGame, ChipPreset, ScheduledGame } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';
const API_TIMEOUT = 30000; // 30 секунд

/**
 * Получает initData от Telegram WebApp.
 * Возвращает строку для отправки в заголовке x-telegram-init-data.
 */
function getInitData(): string | undefined {
  return window.Telegram?.WebApp?.initData || undefined;
}

interface ApiError extends Error {
  status?: number;
  body?: unknown;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  const initData = getInitData();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (initData) {
    headers['x-telegram-init-data'] = initData;
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers,
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

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  return request<T>(path, options);
}

// Games
export function apiGetGames(): Promise<CompletedGame[]> {
  return request<CompletedGame[]>('/api/games');
}

export function apiSaveGame(game: CompletedGame): Promise<{ success: boolean }> {
  return request('/api/games', {
    method: 'POST',
    body: JSON.stringify(game),
  });
}

export function apiDeleteGame(id: string): Promise<{ success: boolean }> {
  return request(`/api/games/${id}`, { method: 'DELETE' });
}

export function apiClearAllGames(): Promise<{ success: boolean }> {
  return request('/api/games', { method: 'DELETE' });
}

// Presets
export function apiGetPresets(): Promise<ChipPreset[]> {
  return request<ChipPreset[]>('/api/presets');
}

export function apiSavePreset(preset: ChipPreset): Promise<{ success: boolean }> {
  return request('/api/presets', {
    method: 'POST',
    body: JSON.stringify(preset),
  });
}

export function apiDeletePreset(id: string): Promise<{ success: boolean }> {
  return request(`/api/presets/${id}`, { method: 'DELETE' });
}

// Scheduled Games
export function apiGetScheduled(): Promise<ScheduledGame[]> {
  return request<ScheduledGame[]>('/api/scheduled');
}

export function apiSaveScheduled(game: ScheduledGame): Promise<{ success: boolean }> {
  return request('/api/scheduled', {
    method: 'POST',
    body: JSON.stringify(game),
  });
}

export function apiDeleteScheduled(id: string): Promise<{ success: boolean }> {
  return request(`/api/scheduled/${id}`, { method: 'DELETE' });
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

// Admin
export function apiAdminStats(): Promise<{ games: number; users: number; presets: number; venues: number; scheduled: number }> {
  return request('/api/admin/stats');
}

export function apiAdminClearAllGames(): Promise<{ success: boolean }> {
  return request('/api/admin/games', { method: 'DELETE' });
}

export function apiAdminDeleteGame(id: string): Promise<{ success: boolean }> {
  return request(`/api/admin/games/${id}`, { method: 'DELETE' });
}

export function apiAdminDeleteUser(id: number): Promise<{ success: boolean }> {
  return request(`/api/admin/users/${id}`, { method: 'DELETE' });
}

export function apiAdminDeletePreset(id: string): Promise<{ success: boolean }> {
  return request(`/api/admin/presets/${id}`, { method: 'DELETE' });
}

export function apiAdminDeleteVenue(name: string): Promise<{ success: boolean }> {
  return request(`/api/admin/venues/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

export function apiAdminDeleteScheduled(id: string): Promise<{ success: boolean }> {
  return request(`/api/admin/scheduled/${id}`, { method: 'DELETE' });
}

export function apiAdminRenameUser(id: number, name: string): Promise<{ success: boolean }> {
  return request(`/api/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}
