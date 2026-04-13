import { useState, useCallback, useEffect } from 'react';
import { apiGet } from './api';

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
 * Загружает только с API (из БД). Если API недоступен — пустая Map.
 */
export function useVerifiedPlayers() {
  const [verifiedMap, setVerifiedMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
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
        // API недоступен — пустая Map, галочки не показываются
        setVerifiedMap(new Map());
      });
  }, []);

  const isVerified = useCallback((name: string): boolean => {
    return verifiedMap.has(name.toLowerCase());
  }, [verifiedMap]);

  return { isVerified, verifiedMap };
}
