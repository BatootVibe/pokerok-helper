import { useState, useEffect, useCallback, useRef } from 'react';
import { ScheduledGame } from '../types';
import { loadScheduledGames, saveScheduledGame, deleteScheduledGame, loadVenues } from '../utils/storage';
import { generateId } from '../utils/id';
import { HeaderBack } from '../components/HeaderBack';
import { formatDate, formatTime, isPast } from '../utils/date';
import { NEARBY_GAME_MARGIN, HOLD_INTERVAL } from '../utils/constants';

// === Types ===

interface Player {
  name: string;
  tgId?: string;
}

// === Main Page ===

export function ScheduledGamesPage() {
  const [scheduled, setScheduled] = useState<ScheduledGame[]>([]);
  const [venues, setVenues] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingGame, setEditingGame] = useState<ScheduledGame | null>(null);

  // Form state
  const [venue, setVenue] = useState('');
  const [newVenue, setNewVenue] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);

  // Loading state
  const [loading, setLoading] = useState(true);

  // ---- Data loading ----

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [games, v] = await Promise.all([loadScheduledGames(), loadVenues()]);
      setScheduled(games);
      setVenues(v);
    } catch (err) {
      console.error('Failed to load scheduled games:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---- Form handlers ----

  const openNewGameForm = () => {
    setEditingGame(null);
    setVenue('');
    setNewVenue('');
    setDateTime('');
    setPlayers([]);
    setShowForm(true);
  };

  const closeForm = () => {
    setEditingGame(null);
    setVenue('');
    setNewVenue('');
    setDateTime('');
    setPlayers([]);
    setShowForm(false);
  };

  const openEditForm = useCallback((game: ScheduledGame) => {
    setEditingGame(game);
    setVenue(game.venue || '');
    setNewVenue('');
    setDateTime(game.scheduledAt || '');
    setPlayers((game.players || []).map(name => ({ name })));
    setShowForm(true);
  }, []);

  const handleSave = useCallback(async () => {
    const finalVenue = newVenue.trim() || venue;
    if (!finalVenue || !dateTime || players.length < 2) return;

    const game: ScheduledGame = {
      id: editingGame?.id || generateId(),
      venue: finalVenue,
      scheduledAt: dateTime,
      players: players.map(p => p.name),
      createdAt: editingGame?.createdAt || new Date().toISOString(),
    };

    try {
      await saveScheduledGame(game);
      // Сбрасываем форму вручную
      setEditingGame(null);
      setVenue('');
      setNewVenue('');
      setDateTime('');
      setPlayers([]);
      setShowForm(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save scheduled game:', err);
      alert('Не удалось сохранить игру на сервер. Попробуйте ещё раз.');
    }
  }, [newVenue, venue, dateTime, players, editingGame, loadData]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteScheduledGame(id);
      // Сброс формы вручную, без resetForm
      setEditingGame(null);
      setVenue('');
      setNewVenue('');
      setDateTime('');
      setPlayers([]);
      setShowForm(false);
      await loadData();
    } catch (err) {
      console.error('Failed to delete scheduled game:', err);
      alert('Не удалось удалить игру с сервера.');
    }
  }, [loadData]);

  const handleAddPlayer = useCallback((player: Player) => {
    if (!player || !player.name) return;
    setPlayers(prev => {
      if (prev.length >= 10) return prev;
      if (prev.some(p => p.name.toLowerCase() === player.name.toLowerCase())) return prev;
      return [...prev, player];
    });
  }, []);

  const handleRemovePlayer = useCallback((index: number) => {
    setPlayers(prev => prev.filter((_, i) => i !== index));
  }, []);

  // ---- Render ----

  const sorted = [...scheduled].sort((a, b) => {
    const ta = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity;
    const tb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity;
    return ta - tb;
  });

  return (
    <div className="page">
      <HeaderBack title="Расписание" />

      {loading ? (
        <div className="empty-state">Загрузка...</div>
      ) : showForm ? (
        <ScheduleForm
          key={editingGame?.id || 'new-game'}
          venues={venues}
          venue={venue}
          setVenue={setVenue}
          newVenue={newVenue}
          setNewVenue={setNewVenue}
          dateTime={dateTime}
          setDateTime={setDateTime}
          players={players}
          onAddPlayer={handleAddPlayer}
          onRemovePlayer={handleRemovePlayer}
          editingGame={editingGame}
          onSave={handleSave}
          onDelete={editingGame ? () => handleDelete(editingGame.id) : undefined}
          onCancel={closeForm}
        />
      ) : sorted.length > 0 ? (
        <div className="mt-16">
          {sorted.map(game => (
            <ScheduledEntry key={game.id} game={game} onEdit={() => openEditForm(game)} />
          ))}
          <p className="page-hint text-center">Удерживайте карточку 2 сек для редактирования</p>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          Пока нет запланированных игр
        </div>
      )}

      <div className="fixed-actions">
        {!showForm && (
          <button className="btn btn-secondary" onClick={openNewGameForm}>
            + Запланировать игру
          </button>
        )}
      </div>
    </div>
  );
}

// === Schedule Form ===

function ScheduleForm({
  venues, venue, setVenue, newVenue, setNewVenue,
  dateTime, setDateTime,
  players, onAddPlayer, onRemovePlayer, editingGame,
  onSave, onDelete, onCancel,
}: {
  venues: string[];
  venue: string; setVenue: (v: string) => void;
  newVenue: string; setNewVenue: (v: string) => void;
  dateTime: string; setDateTime: (v: string) => void;
  players: Player[];
  onAddPlayer: (player: Player) => void;
  onRemovePlayer: (idx: number) => void;
  editingGame: ScheduledGame | null;
  onSave: () => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <h3 className="mb-16">{editingGame ? 'Редактировать' : 'Новая запись'}</h3>

      <VenueSelector
        venues={venues}
        venue={venue}
        setVenue={setVenue}
        newVenue={newVenue}
        setNewVenue={setNewVenue}
      />

      <div className="form-group">
        <label className="form-label">Дата и время</label>
        <input
          className="input"
          type="datetime-local"
          value={dateTime}
          onChange={e => setDateTime(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">
          Игроки <span className="badge">{players.length}/10</span>
        </label>
        <PlayerInput players={players} onAddPlayer={onAddPlayer} onRemovePlayer={onRemovePlayer} />
        {players.length < 2 && (
          <p className="empty-text mt-8">Минимум 2 игрока</p>
        )}
      </div>

      <div className="form-actions">
        <button
          className="btn btn-primary btn-small"
          style={{ flex: 1 }}
          onClick={handleSave}
          disabled={players.length < 2 || saving}
        >
          {saving ? '⏳' : '💾'} Сохранить
        </button>
        <button className="btn btn-secondary btn-small" style={{ flex: 1 }} onClick={onCancel}>
          Отмена
        </button>
        {onDelete && (
          <button className="btn btn-danger btn-small" onClick={onDelete}>
            🗑️
          </button>
        )}
      </div>
    </div>
  );
}

// === Venue Selector ===

function VenueSelector({
  venues, venue, setVenue, newVenue, setNewVenue,
}: {
  venues: string[];
  venue: string; setVenue: (v: string) => void;
  newVenue: string; setNewVenue: (v: string) => void;
}) {
  const showInput = venues.length === 0 || newVenue === '_new_';

  if (!showInput) {
    return (
      <div className="form-group">
        <label className="form-label">Локация</label>
        <div className="preset-selector mb-8">
          {venues.map(v => (
            <div
              key={v}
              className={`preset-chip ${venue === v ? 'active' : ''}`}
              onClick={() => setVenue(v)}
            >
              {v}
            </div>
          ))}
        </div>
        <button className="btn btn-secondary btn-small" onClick={() => setNewVenue('_new_')}>
          + Новое
        </button>
      </div>
    );
  }

  return (
    <div className="form-group">
      <label className="form-label">Локация</label>
      <input
        className="input"
        type="text"
        placeholder="Где играем?"
        value={newVenue}
        onChange={e => setNewVenue(e.target.value)}
      />
      {venues.length > 0 && (
        <button
          className="btn btn-secondary btn-small mt-8"
          onClick={() => {
            setNewVenue('');
            setVenue(venues[0] || '');
          }}
        >
          ← Выбрать
        </button>
      )}
    </div>
  );
}

// === Player Input (simplified, no autocomplete portal issues) ===

function PlayerInput({
  players, onAddPlayer, onRemovePlayer, maxPlayers = 10,
}: {
  players: Player[];
  onAddPlayer: (player: Player) => void;
  onRemovePlayer: (index: number) => void;
  maxPlayers?: number;
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const safePlayers = players.filter(p => p && typeof p.name === 'string' && p.name.trim());

  const addCurrentInput = () => {
    const name = input.trim();
    if (!name || safePlayers.length >= maxPlayers) return;
    if (safePlayers.some(p => p.name.toLowerCase() === name.toLowerCase())) return;
    onAddPlayer({ name });
    setInput('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCurrentInput();
    }
  };

  return (
    <div className="player-autocomplete-wrapper">
      {safePlayers.length > 0 && (
        <div className="player-tags">
          {safePlayers.map((p, i) => (
            <span key={`${p.name}-${i}`} className="player-tag">
              <span className={p.tgId ? 'verified-player' : ''}>{p.name}</span>
              <span className="player-tag-remove" onClick={() => onRemovePlayer(i)}>×</span>
            </span>
          ))}
        </div>
      )}
      <div className="autocomplete-input-row">
        <input
          ref={inputRef}
          className="input"
          type="text"
          placeholder={safePlayers.length >= maxPlayers ? 'Лимит игроков' : 'Имя игрока'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={safePlayers.length >= maxPlayers}
        />
        <button
          className="btn btn-primary btn-small autocomplete-add-btn"
          onClick={addCurrentInput}
          disabled={safePlayers.length >= maxPlayers || !input.trim()}
        >
          +
        </button>
      </div>
    </div>
  );
}

// === Scheduled Entry Card ===

function ScheduledEntry({ game, onEdit }: { game: ScheduledGame; onEdit: () => void }) {
  const holdTimerRef = useRef<number | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);

  const EDIT_HOLD_DURATION = 3000;
  const EDIT_HOLD_DELAY = 1500;

  const safeVenue = game.venue || 'Без локации';
  const safePlayers = Array.isArray(game.players) ? game.players : [];
  const safeScheduledAt = game.scheduledAt || '';
  const past = safeScheduledAt ? isPast(safeScheduledAt, NEARBY_GAME_MARGIN) : false;

  const startHold = () => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const ringProgress = elapsed < EDIT_HOLD_DELAY
        ? 0
        : Math.min((elapsed - EDIT_HOLD_DELAY) / (EDIT_HOLD_DURATION - EDIT_HOLD_DELAY), 1);
      setHoldProgress(ringProgress);
      if (elapsed >= EDIT_HOLD_DURATION) {
        clearInterval(interval);
        holdTimerRef.current = null;
        onEdit();
        setHoldProgress(0);
      }
    }, HOLD_INTERVAL);
    holdTimerRef.current = interval;
  };

  const releaseHold = () => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setHoldProgress(0);
  };

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    };
  }, []);

  const circumference = 2 * Math.PI * 8;
  const dashOffset = circumference * (1 - holdProgress);

  return (
    <div className={`card scheduled-entry ${past ? 'past' : ''}`}>
      <div
        className="scheduled-header"
        style={{ position: 'relative' }}
        onMouseDown={startHold}
        onMouseUp={releaseHold}
        onMouseLeave={releaseHold}
        onTouchStart={startHold}
        onTouchEnd={releaseHold}
        onTouchCancel={releaseHold}
      >
        <div className="scheduled-info">
          <div className="scheduled-venue font-bold">{safeVenue}</div>
          <div className="scheduled-time text-muted">
            {safeScheduledAt
              ? `${formatDate(safeScheduledAt)} в ${formatTime(safeScheduledAt)}`
              : 'Дата не указана'}
          </div>
          <div className="scheduled-players text-muted">
            {safePlayers.join(', ') || 'Нет игроков'}
          </div>
        </div>
        {holdProgress > 0 && (
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            className="hold-spinner-corner"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              transform: 'rotate(-90deg)',
              flexShrink: 0,
            }}
          >
            <circle
              cx="12" cy="12" r="10"
              fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2"
            />
            <circle
              cx="12" cy="12" r="10"
              fill="none"
              stroke="var(--accent-gold)"
              strokeWidth="2"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              className="hold-spinner-progress"
            />
          </svg>
        )}
      </div>
    </div>
  );
}
