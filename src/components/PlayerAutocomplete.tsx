import { useState, useEffect, useRef, useCallback } from 'react';
import { getAllPlayers } from '../utils/storage';

export interface Player {
  name: string;
  tgId?: string;
}

interface PlayerAutocompleteProps {
  players: Player[];
  onAddPlayer: (player: Player) => void;
  onRemovePlayer: (index: number) => void;
  maxPlayers?: number;
}

export function PlayerAutocomplete({ players, onAddPlayer, onRemovePlayer, maxPlayers = 10 }: PlayerAutocompleteProps) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<Player[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Загружаем всех привязанных пользователей при монтировании
  useEffect(() => {
    getAllPlayers().then(list => setAllPlayers(list.map(p => ({ ...p, tgId: p.tgId || undefined }))));
  }, []);

  // Закрытие при клике снаружи
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Фильтрация предложений
  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const query = input.toLowerCase();
    const existingNames = players.map(p => p.name.toLowerCase());

    // 1. Ищем привязанных пользователей
    const matches = allPlayers.filter(p => 
      p.name.toLowerCase().includes(query) && !existingNames.includes(p.name.toLowerCase())
    );

    // 2. Добавляем опцию "Добавить как гостя", если точного совпадения нет
    const hasExactMatch = allPlayers.some(p => p.name.toLowerCase() === query);
    const guestOption: Player = { name: input.trim() };

    setSuggestions([
      ...matches.slice(0, 4), // Максимум 4 подсказки
      ...(input.trim().length > 0 && !hasExactMatch ? [guestOption] : [])
    ]);
    setIsOpen(suggestions.length > 0 || input.trim().length > 0);
  }, [input, allPlayers, players, suggestions.length]);

  const handleSelect = useCallback((selected: Player) => {
    if (players.length >= maxPlayers) return;
    onAddPlayer(selected);
    setInput('');
    setSuggestions([]);
  }, [players.length, maxPlayers, onAddPlayer]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      // Если есть точное совпадение в подсказках — выбираем его, иначе создаем гостя
      const exact = suggestions.find(s => s.name.toLowerCase() === input.trim().toLowerCase());
      handleSelect(exact || { name: input.trim() });
    }
  };

  return (
    <div className="player-autocomplete-wrapper" ref={wrapperRef}>
      {/* Список уже добавленных игроков */}
      {players.length > 0 && (
        <div className="player-tags">
          {players.map((p, i) => (
            <span key={`${p.name}-${i}`} className="player-tag">
              {p.tgId && <span className="tg-icon">✈️</span>}
              {p.name}
              <span className="player-tag-remove" onClick={() => onRemovePlayer(i)}>×</span>
            </span>
          ))}
        </div>
      )}

      {/* Поле ввода */}
      <div className="autocomplete-input-row">
        <input
          className="input"
          type="text"
          placeholder={players.length >= maxPlayers ? 'Лимит игроков' : 'Имя игрока'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={players.length >= maxPlayers}
        />
        
        {/* Выпадающий список */}
        {isOpen && input.trim() && (
          <ul className="autocomplete-list">
            {suggestions.map((s, idx) => {
              const isLinked = !!s.tgId;
              return (
                <li 
                  key={idx} 
                  className={`autocomplete-item ${isLinked ? 'linked' : ''}`}
                  onClick={() => handleSelect(s)}
                >
                  <span>{s.name}</span>
                  {isLinked && <span className="tg-badge">TG</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
