import { useState, useEffect, useCallback, useRef } from 'react';
import { ScheduledGame } from '../types';
import { loadScheduledGames, saveScheduledGame, deleteScheduledGame, generateId, loadVenues } from '../utils/storage';
import { HeaderBack } from '../components/HeaderBack';
import { formatDate, formatTime, isPast } from '../utils/date';
import { useNameList } from '../utils/hooks';
import { NEARBY_GAME_MARGIN, HOLD_INTERVAL } from '../utils/constants';

export function ScheduledGamesPage() {
  const [scheduled, setScheduled] = useState<ScheduledGame[]>([]);
  const [venues, setVenues] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingGame, setEditingGame] = useState<ScheduledGame | null>(null);
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const { names: players, add: addPlayer, remove: removePlayer, clear: clearPlayers } = useNameList();

  // Форма
  const [venue, setVenue] = useState('');
  const [newVenue, setNewVenue] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [playerInput, setPlayerInput] = useState('');

  const loadScheduled = useCallback(async () => {
    const games = await loadScheduledGames();
    setScheduled(games);
  }, []);

  useEffect(() => {
    loadScheduled();
    setVenues(loadVenues());
  }, [loadScheduled]);

  const handleSave = useCallback(async () => {
    const finalVenue = newVenue.trim() || venue;
    if (!finalVenue || !dateTime || players.length === 0) return;

    // Сохраняем дату в том же локальном времени, без сдвига в UTC
    const localDate = new Date(dateTime);
    const utcAdjusted = new Date(localDate.getTime() - localDate.getTimezoneOffset() * 60000);

    const game: ScheduledGame = {
      id: editingGame?.id || generateId(),
      venue: finalVenue,
      scheduledAt: utcAdjusted.toISOString(),
      players,
      createdAt: editingGame?.createdAt || new Date().toISOString(),
    };

    await saveScheduledGame(game);
    await loadScheduled();
    setShowForm(false);
    setEditingGame(null);
    setVenue('');
    setNewVenue('');
    setDateTime('');
    clearPlayers();
  }, [newVenue, venue, dateTime, players, loadScheduled, clearPlayers, editingGame]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteScheduledGame(id);
    await loadScheduled();
    setEditingGame(null);
    setShowForm(false);
  }, [loadScheduled]);

  const handleDeleteFromList = useCallback(async (id: string) => {
    await deleteScheduledGame(id);
    await loadScheduled();
  }, [loadScheduled]);

  return (
    <div className="page">
      <HeaderBack title="Расписание" />

      {showForm ? (
        <ScheduleForm
          venues={venues}
          venue={venue}
          setVenue={setVenue}
          newVenue={newVenue}
          setNewVenue={setNewVenue}
          dateTime={dateTime}
          setDateTime={setDateTime}
          playerInput={playerInput}
          setPlayerInput={setPlayerInput}
          players={players}
          addPlayer={addPlayer}
          removePlayer={removePlayer}
          editingGame={editingGame}
          onSave={handleSave}
          onDelete={editingGame ? () => handleDelete(editingGame.id) : undefined}
          onCancel={() => {
            setShowForm(false);
            setEditingGame(null);
          }}
        />
      ) : (
        scheduled.length > 0 ? (
          <div className="mt-16">
            {scheduled.map(game => (
              <ScheduledEntry
                key={game.id}
                game={game}
                isExpanded={expandedGameId === game.id}
                onToggleExpand={() => setExpandedGameId(prev => prev === game.id ? null : game.id)}
                onEdit={() => {
                  setEditingGame(game);
                  setVenue(game.venue);
                  setNewVenue('');
                  setDateTime(game.scheduledAt.slice(0, 16));
                  clearPlayers();
                  game.players.forEach(p => addPlayer(p));
                  setShowForm(true);
                  setExpandedGameId(null);
                }}
                onDelete={handleDeleteFromList}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📅</div>
            Пока нет запланированных игр
          </div>
        )
      )}

      <div className="spacer" />

      {!showForm && (
        <button className="btn btn-secondary" onClick={() => setShowForm(true)}>
          + Запланировать игру
        </button>
      )}
    </div>
  );
}

// === Sub-components ===

function ScheduleForm({
  venues, venue, setVenue, newVenue, setNewVenue,
  dateTime, setDateTime, playerInput, setPlayerInput,
  players, addPlayer, removePlayer, editingGame,
  onSave, onDelete, onCancel,
}: {
  venues: string[];
  venue: string; setVenue: (v: string) => void;
  newVenue: string; setNewVenue: (v: string) => void;
  dateTime: string; setDateTime: (v: string) => void;
  playerInput: string; setPlayerInput: (v: string) => void;
  players: string[];
  addPlayer: (name: string) => void;
  removePlayer: (idx: number) => void;
  editingGame: ScheduledGame | null;
  onSave: () => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const handleAddPlayer = () => {
    if (players.length >= 10) return;
    addPlayer(playerInput);
    setPlayerInput('');
  };

  return (
    <div className="card">
      <h3 className="mb-16">{editingGame ? '✏️ Редактировать' : '📅 Новая запись'}</h3>
      <div className="card-header">
        <label className="form-label" style={{ marginBottom: 0 }}>👥 Игроки <span className="badge">{players.length}/10</span></label>
      </div>

      <VenueSelector
        venues={venues}
        venue={venue}
        setVenue={setVenue}
        newVenue={newVenue}
        setNewVenue={setNewVenue}
      />

      <div className="form-group">
        <label className="form-label">🕐 Дата и время</label>
        <input
          className="input"
          type="datetime-local"
          value={dateTime}
          onChange={e => setDateTime(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">👥 Игроки</label>
        <div className="add-player-form">
          <input
            className="input"
            type="text"
            placeholder="Имя игрока"
            value={playerInput}
            onChange={e => setPlayerInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddPlayer()}
          />
          <button className="btn btn-primary btn-small" onClick={handleAddPlayer} disabled={players.length >= 10}>+</button>
        </div>
        {players.length > 0 && (
          <div className="player-tags">
            {players.map((name, i) => (
              <span key={i} className="player-tag">
                {name}
                <span onClick={() => removePlayer(i)}>×</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="form-actions">
        <button className="btn btn-primary btn-small" style={{ flex: 1 }} onClick={onSave}>
          💾 Сохранить
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

function VenueSelector({
  venues, venue, setVenue, newVenue, setNewVenue,
}: {
  venues: string[];
  venue: string; setVenue: (v: string) => void;
  newVenue: string; setNewVenue: (v: string) => void;
}) {
  const showInput = venues.length === 0 || newVenue !== '';

  if (!showInput) {
    return (
      <div className="form-group">
        <label className="form-label">📍 Место</label>
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
        <button className="btn btn-secondary btn-small" onClick={() => setNewVenue(' ')}>
          + Новое
        </button>
      </div>
    );
  }

  return (
    <div className="form-group">
      <label className="form-label">📍 Место</label>
      <input
        className="input"
        type="text"
        placeholder="Название места"
        value={newVenue}
        onChange={e => setNewVenue(e.target.value)}
      />
      {venues.length > 0 && (
        <button
          className="btn btn-secondary btn-small mt-8"
          onClick={() => { setNewVenue(''); }}
        >
          ← Выбрать
        </button>
      )}
    </div>
  );
}

function ScheduledEntry({ game, isExpanded, onToggleExpand, onEdit, onDelete }: {
  game: ScheduledGame;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
}) {
  const past = isPast(game.scheduledAt, NEARBY_GAME_MARGIN);
  const holdTimerRef = useRef<number | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);

  const EDIT_HOLD_DURATION = 3000;
  const EDIT_HOLD_DELAY = 1500;

  const startHold = () => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      // Кольцо появляется только после EDIT_HOLD_DELAY
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

  const circumference = 2 * Math.PI * 8;
  // Ring fills from 0 to full: dashoffset goes from circumference to 0
  const dashOffset = circumference * (1 - holdProgress);

  return (
    <div className={`card scheduled-entry ${past ? 'past' : ''}`}>
      <div
        className="scheduled-header"
        onClick={onToggleExpand}
        onMouseDown={startHold}
        onMouseUp={releaseHold}
        onMouseLeave={releaseHold}
        onTouchStart={startHold}
        onTouchEnd={releaseHold}
        onTouchCancel={releaseHold}
      >
        <div className="scheduled-info">
          <div className="scheduled-venue font-bold">{game.venue}</div>
          <div className="scheduled-time text-muted">
            {formatDate(game.scheduledAt)} в {formatTime(game.scheduledAt)}
          </div>
          <div className="scheduled-players text-muted">
            👥 {game.players.join(', ')}
          </div>
        </div>
        {holdProgress > 0 && (
          <svg width="28" height="28" viewBox="0 0 24 24" className="hold-spinner" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
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
      {isExpanded && (
        <div className="scheduled-details">
          <div className="detail-row">
            <span className="detail-label">Создано:</span>
            <span>{formatDate(game.createdAt)} в {formatTime(game.createdAt)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Время до встречи:</span>
            <span>{formatTimeTo(game.scheduledAt)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Игроков:</span>
            <span>{game.players.length}</span>
          </div>
          <div className="scheduled-detail-actions">
            <button className="btn btn-danger btn-small" onClick={(e) => { e.stopPropagation(); onDelete(game.id); }}>
              🗑️ Удалить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTimeTo(iso: string): string {
  const now = new Date();
  const target = new Date(iso);
  const diff = target.getTime() - now.getTime();

  if (diff < 0) return 'Прошла';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days} дн. ${hours} ч.`;
  if (hours > 0) return `${hours} ч. ${mins} мин.`;
  return `${mins} мин.`;
}
