import { useState, useCallback } from 'react';

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
