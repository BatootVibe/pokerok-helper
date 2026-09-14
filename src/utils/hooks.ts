import { useState, useCallback, useEffect, useRef } from 'react';
import { apiGet } from './api';
import { LOCAL_USER_PROFILE_KEY } from './constants';
import { useGame } from '../context/GameContext';
import { getUserProfile } from './storage';

export function useBoundStatus() {
  const [isBound, setIsBound] = useState(false);

  useEffect(() => {
    getUserProfile().then(profile => {
      const guest = localStorage.getItem('poker_guest_mode') === 'true';
      setIsBound(!!(profile?.name) && !guest);
    }).catch(() => setIsBound(false));
  }, []);

  return { isBound };
}

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

export function useActiveGamePolling(intervalMs = 3000) {
  const { currentGame, isOwner, syncFromServer } = useGame();
  const syncRef = useRef(syncFromServer);
  syncRef.current = syncFromServer;

  const navigateRef = useRef<((path: string) => void) | null>(null);

  const setNavigate = useCallback((nav: (path: string) => void) => {
    navigateRef.current = nav;
  }, []);

  useEffect(() => {
    if (!currentGame || isOwner) return;

    const id = setInterval(async () => {
      await syncRef.current();
      // If game was deleted, syncFromServer sets currentGame to null,
      // which triggers this effect's cleanup and stops the interval.
      // Navigate to home if we're still on a game page.
      // The component using this hook will re-render with null currentGame
      // and its own "game not found" guard will redirect.
    }, intervalMs);

    return () => clearInterval(id);
  }, [currentGame, isOwner, intervalMs]);

  return { setNavigate };
}
