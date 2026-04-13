import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Загружаем всех привязанных пользователей при монтировании
  useEffect(() => {
    getAllPlayers().then(list => setAllPlayers(list.map(p => ({ ...p, tgId: p.tgId || undefined }))));
  }, []);

  // Закрытие при клике снаружи
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Позиционирование выпадающего списка (fixed, чтобы вырваться из stacking context карточки)
  useEffect(() => {
    if (!showSuggestions || !wrapperRef.current) {
      setDropdownStyle({});
      return;
    }
    const updatePosition = () => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed' as const,
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    };
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showSuggestions, suggestions]);

  // Фильтрация предложений — только имена, НАЧИНАЮЩИЕСЯ с запроса
  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const query = input.trim().toLowerCase();
    const existingNames = players.map(p => p.name.toLowerCase());

    // Только имена, начинающиеся с запроса
    const matches = allPlayers.filter(p =>
      p.name.toLowerCase().startsWith(query) && !existingNames.includes(p.name.toLowerCase())
    );

    // Показываем только если есть совпадения
    if (matches.length > 0) {
      setSuggestions(matches.slice(0, 5));
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [input, allPlayers, players]);

  const handleSelect = useCallback((selected: Player) => {
    if (players.length >= maxPlayers) return;
    onAddPlayer(selected);
    setInput('');
    setSuggestions([]);
    setShowSuggestions(false);
  }, [players.length, maxPlayers, onAddPlayer]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      const existingNames = players.map(p => p.name.toLowerCase());
      // Если есть точное совпадение — выбираем его
      const exact = suggestions.find(s => s.name.toLowerCase() === input.trim().toLowerCase());
      if (exact) {
        handleSelect(exact);
      } else if (!existingNames.includes(input.trim().toLowerCase())) {
        // Иначе добавляем как гостя
        handleSelect({ name: input.trim() });
      }
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

      {/* Поле ввода + кнопки */}
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
        <button
          className="btn btn-primary btn-small autocomplete-add-btn"
          onClick={() => {
            if (input.trim() && !players.some(p => p.name.toLowerCase() === input.trim().toLowerCase()) && players.length < maxPlayers) {
              const exact = suggestions.find(s => s.name.toLowerCase() === input.trim().toLowerCase());
              handleSelect(exact || { name: input.trim() });
            }
          }}
          disabled={players.length >= maxPlayers || !input.trim()}
        >
          +
        </button>
        {/* Кнопка добавить из последней игры (иконка только) */}
        {(window as any).lastGamePlayers?.length > 0 && (
          <button
            className="btn btn-secondary btn-small autocomplete-history-btn"
            onClick={() => {
              const lastPlayers = (window as any).lastGamePlayers as Player[];
              const existingNames = new Set(players.map(p => p.name.toLowerCase()));
              const newOnes = lastPlayers.filter(p => !existingNames.has(p.name.toLowerCase()));
              const availableSlots = maxPlayers - players.length;
              newOnes.slice(0, availableSlots).forEach(p => onAddPlayer(p));
            }}
            disabled={players.length >= maxPlayers}
            title="Добавить из последней игры"
          >
            ↻
          </button>
        )}
      </div>

      {/* Выпадающий список через портал (на уровне body, вне stacking context карточки) */}
      {showSuggestions && suggestions.length > 0 && createPortal(
        <ul className="autocomplete-list autocomplete-list-portal" style={dropdownStyle}>
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
        </ul>,
        document.body
      )}
    </div>
  );
}
