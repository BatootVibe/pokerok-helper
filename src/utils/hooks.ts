import { useState, useCallback, useEffect } from 'react';
import { apiGet } from './api';

/**
 * Хук для получения Map привязанных игроков (имя → userId).
 * Загружает с API (из БД). Если API недоступен — fallback на localStorage.
 */
export function useVerifiedPlayers() {
  const [verifiedMap, setVerifiedMap] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    // 1. Сначала пробуем API
    apiGet<{ name: string; id: number }[]>('/api/players')
      .then(players => {
        const map = new Map<string, number>();
        for (const p of players) {
          if (p.id) {
            map.set(p.name.toLowerCase(), p.id);
          }
        }
        setVerifiedMap(map);
      })
      .catch(() => {
        // 2. Fallback: загружаем из localStorage
        const map = new Map<string, number>();
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(LOCAL_USER_PROFILE_KEY)) {
            try {
              const profile = JSON.parse(localStorage.getItem(key) || '');
              if (profile && profile.name && profile.userId) {
                map.set(profile.name.toLowerCase(), profile.userId);
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
