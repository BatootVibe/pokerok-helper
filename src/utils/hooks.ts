import { useState, useCallback, useEffect } from 'react';
import { apiGet } from './api';
import { LOCAL_USER_PROFILE_KEY } from './constants';

/** Хук для управления списком имён (добавление/удаление) */
export function useNameList(initial: string[] = []) {
  const [names, setNames] = useState<string[]>(initial);

  const add = useCallback((name: string) => {
    setNames(prev => {
      const trimmed = name.trim();
      if (trimmed && !prev.includes(trimmed)) {
        return [...prev, trimmed];
      }
      return prev;
    });
  }, []);

  const remove = useCallback((index: number) => {
    setNames(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clear = useCallback(() => setNames([]), []);

  return { names, add, remove, clear, setNames };
}

/**
 * Хук для получения Map привязанных игроков (имя → tgId).
 * Загружает с API (из БД). Если API недоступен — fallback на localStorage.
 */
export function useVerifiedPlayers() {
  const [verifiedMap, setVerifiedMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    // 1. Сначала пробуем API
    apiGet<{ name: string; tgId: string | null }[]>('/api/players')
      .then(players => {
        const map = new Map<string, string>();
        for (const p of players) {
          if (p.tgId) {
            map.set(p.name.toLowerCase(), p.tgId);
          }
        }
        setVerifiedMap(map);
      })
      .catch(() => {
        // 2. Fallback: загружаем из localStorage
        const map = new Map<string, string>();
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(LOCAL_USER_PROFILE_KEY)) {
            try {
              const profile = JSON.parse(localStorage.getItem(key) || '');
              if (profile && profile.name && profile.tgId) {
                map.set(profile.name.toLowerCase(), profile.tgId);
              }
            } catch {
              // ignore
            }
          }
        }
        setVerifiedMap(map);
      });
  }, []);

  const isVerified = useCallback((name: string): boolean => {
    return verifiedMap.has(name.toLowerCase());
  }, [verifiedMap]);

  return { isVerified, verifiedMap };
}
