import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getAllPlayers } from '../utils/storage';

export interface Player {
  name: string;
  userId?: number;
}

interface PlayerAutocompleteProps {
  players: Player[];
  onAddPlayer: (player: Player) => void;
  onRemovePlayer: (index: number) => void;
  maxPlayers?: number;
  showHistoryBtn?: boolean;
}

export function PlayerAutocomplete({ players, onAddPlayer, onRemovePlayer, maxPlayers = 10, showHistoryBtn = true }: PlayerAutocompleteProps) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<Player[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Загружаем всех привязанных пользователей при монтировании
  useEffect(() => {
    getAllPlayers().then(list => setAllPlayers(list.map(p => ({ name: p.name, userId: p.id }))));
  }, []);

  // Закрытие при клике снаружи (mousedown)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Не закрываем, если клик был по выпадающему списку
      if (listRef.current && listRef.current.contains(target)) return;
      if (wrapperRef.current && !wrapperRef.current.contains(target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback((selected: Player) => {
    if (players.length >= maxPlayers) return;
    onAddPlayer(selected);
    setInput('');
    setSuggestions([]);
    setShowSuggestions(false);
  }, [players.length, maxPlayers, onAddPlayer]);

  // Позиционирование выпадающего списка — вынесено через useRef чтобы не было утечки
  const dropdownPositionRef = useRef<(() => void) | null>(null);

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

    // Сохраняем ссылку для cleanup
    dropdownPositionRef.current = updatePosition;

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      dropdownPositionRef.current = null;
    };
  }, [showSuggestions]);

  // Фильтрация предложений — только имена, НАЧИНАЮЩИЕСЯ с запроса
  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const query = input.trim().toLowerCase();
    // Защита: фильтруем только валидные объекты с name
    const validAll = allPlayers.filter((p): p is { name: string; userId?: number } => p && typeof p.name === 'string');
    const validPlayers = players.filter((p): p is Player => p && typeof p.name === 'string');
    const existingNames = validPlayers.map(p => p.name.toLowerCase());

    // Только имена, начинающиеся с запроса
    const matches = validAll.filter(p =>
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      const validPlayers = players.filter(p => p && typeof p.name === 'string');
      const existingNames = validPlayers.map(p => p.name.toLowerCase());
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
      {players.filter(p => p && p.name).length > 0 && (
        <div className="player-tags">
          {players.filter(p => p && p.name).map((p, i) => (
            <span key={`${p.name}-${i}`} className="player-tag">
              <span className={p.userId ? 'verified-player' : ''}>{p.name}</span>
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
            const validPlayers = players.filter(p => p && typeof p.name === 'string');
            if (input.trim() && !validPlayers.some(p => p.name.toLowerCase() === input.trim().toLowerCase()) && validPlayers.length < maxPlayers) {
              const exact = suggestions.find(s => s.name.toLowerCase() === input.trim().toLowerCase());
              handleSelect(exact || { name: input.trim() });
            }
          }}
          disabled={players.length >= maxPlayers || !input.trim()}
        >
          +
        </button>
        {/* Кнопка добавить из последней игры (иконка только) */}
        {showHistoryBtn && (window.lastGamePlayers?.length ?? 0) > 0 && (
          <button
            className="btn btn-secondary btn-small autocomplete-history-btn"
            onClick={() => {
              const lastPlayers = window.lastGamePlayers!;
              const validPlayers = players.filter(p => p && typeof p.name === 'string');
              const validAll = allPlayers.filter(p => p && typeof p.name === 'string');
              const existingNames = new Set(validPlayers.map(p => p.name.toLowerCase()));
              const availableSlots = maxPlayers - validPlayers.length;
              let added = 0;
              for (const lp of lastPlayers) {
                if (added >= availableSlots) break;
                if (existingNames.has(lp.name.toLowerCase())) continue;
                // Ищем в allPlayers привязку
                const linked = validAll.find(p => p.name.toLowerCase() === lp.name.toLowerCase());
                onAddPlayer(linked || lp);
                added++;
              }
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
        <ul className="autocomplete-list autocomplete-list-portal" style={dropdownStyle} ref={listRef}>
          {suggestions.map((s, idx) => {
            const isLinked = !!s.userId;
            return (
              <li
                key={idx}
                className={`autocomplete-item ${isLinked ? 'linked' : ''}`}
                onClick={() => handleSelect(s)}
              >
                <span className={isLinked ? 'verified-player' : ''}>{s.name}</span>
              </li>
            );
          })}
        </ul>,
        document.body
      )}
    </div>
  );
}
