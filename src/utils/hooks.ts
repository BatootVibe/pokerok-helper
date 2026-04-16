import { useState, useCallback, useEffect } from 'react';
import { apiGet } from './api';
import { LOCAL_USER_PROFILE_KEY } from './constants';

/**
 * Хук для получения Set ID привязанных игроков.
 * Загружает с API (из БД). Если API недоступен — fallback на localStorage.
 */
export function useVerifiedPlayers() {
  const [verifiedIds, setVerifiedIds] = useState<Set<number>>(new Set());
  const [verifiedNames, setVerifiedNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiGet<{ name: string; id: number }[]>('/api/players')
      .then(players => {
        const ids = new Set<number>();
        const names = new Set<string>();
        for (const p of players) {
          if (p.id) ids.add(p.id);
          if (p.name) names.add(p.name);
        }
        setVerifiedIds(ids);
        setVerifiedNames(names);
      })
      .catch(() => {
        const ids = new Set<number>();
        const names = new Set<string>();
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(LOCAL_USER_PROFILE_KEY)) {
            try {
              const profile = JSON.parse(localStorage.getItem(key) || '');
              if (profile && profile.userId) ids.add(profile.userId);
              if (profile && profile.name) names.add(profile.name);
            } catch {
              // ignore
            }
          }
        }
        setVerifiedIds(ids);
        setVerifiedNames(names);
      });
  }, []);

  const isVerified = useCallback((userId?: number): boolean => {
    return !!userId && verifiedIds.has(userId);
  }, [verifiedIds]);

  return { isVerified, verifiedIds, verifiedNames };
}
