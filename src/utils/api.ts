import { CompletedGame, ChipPreset, ScheduledGame } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface ApiError extends Error {
  status?: number;
  body?: unknown;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

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

// Health check
export function apiHealthCheck(): Promise<{ status: string }> {
  return request('/api/health');
}
