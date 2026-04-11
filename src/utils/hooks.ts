import { useState, useCallback } from 'react';

/** Хук для управления списком имён (добавление/удаление) */
export function useNameList(initial: string[] = []) {
  const [names, setNames] = useState<string[]>(initial);

  const add = useCallback((name: string) => {
    const trimmed = name.trim();
    if (trimmed && !names.includes(trimmed)) {
      setNames(prev => [...prev, trimmed]);
    }
  }, [names]);

  const remove = useCallback((index: number) => {
    setNames(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clear = useCallback(() => setNames([]), []);

  return { names, add, remove, clear, setNames };
}
