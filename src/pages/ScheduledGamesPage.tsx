import { useState, useEffect, useCallback, useRef } from 'react';
import { ScheduledGame } from '../types';
import { loadScheduledGames, saveScheduledGame, deleteScheduledGame, loadVenues } from '../utils/storage';
import { generateId } from '../utils/id';
import { HeaderBack } from '../components/HeaderBack';
import { formatDate, formatTime, isPast } from '../utils/date';
import { useNameList } from '../utils/hooks';
import { NEARBY_GAME_MARGIN, HOLD_INTERVAL } from '../utils/constants';

export function ScheduledGamesPage() {
  const [scheduled, setScheduled] = useState<ScheduledGame[]>([]);
  const [venues, setVenues] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingGame, setEditingGame] = useState<ScheduledGame | null>(null);
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
    if (!finalVenue || !dateTime || players.length < 2) return;

    // Храним время как "wall clock" без таймзоны — YYYY-MM-DDTHH:mm
    const game: ScheduledGame = {
      id: editingGame?.id || generateId(),
      venue: finalVenue,
      scheduledAt: dateTime, // без конвертации в UTC
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

  const handleDeleteFromForm = useCallback(async (id: string) => {
    await deleteScheduledGame(id);
    await loadScheduled();
    setShowForm(false);
    setEditingGame(null);
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
          onDelete={editingGame ? () => handleDeleteFromForm(editingGame.id) : undefined}
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
                onEdit={() => {
                  setEditingGame(game);
                  setVenue(game.venue);
                  setNewVenue('');
                  // Загружаем время как есть — это уже wall clock time
                  setDateTime(game.scheduledAt);
                  clearPlayers();
                  game.players.forEach(p => addPlayer(p));
                  setShowForm(true);
                }}
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

      {scheduled.length > 0 && (
        <p className="page-hint text-center">Удерживайте карточку 2 сек для редактирования</p>
      )}

      <div className="fixed-actions">
        {!showForm && (
          <button className="btn btn-secondary" onClick={() => setShowForm(true)}>
            + Запланировать игру
          </button>
        )}
      </div>
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
      <h3 className="mb-16">{editingGame ? 'Редактировать' : 'Новая запись'}</h3>
      <div className="card-header">
        <label className="form-label" style={{ marginBottom: 0 }}>Игроки <span className="badge">{players.length}/10</span></label>
      </div>

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
        <label className="form-label">Игроки</label>
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
        {players.length < 2 && (
          <p className="empty-text mt-8">Минимум 2 игрока</p>
        )}
      </div>

      <div className="form-actions">
        <button
          className="btn btn-primary btn-small"
          style={{ flex: 1 }}
          onClick={onSave}
          disabled={players.length < 2}
        >
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
          onClick={() => { setNewVenue(''); }}
        >
          ← Выбрать
        </button>
      )}
    </div>
  );
}

function ScheduledEntry({ game, onEdit }: {
  game: ScheduledGame;
  onEdit: () => void;
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

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    };
  }, []);

  return (
    <div className={`card scheduled-entry ${past ? 'past' : ''}`}>
      <div
        className="scheduled-header"
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
            {game.players.join(', ')}
          </div>
          {holdProgress > 0 && (
            <svg width="28" height="28" viewBox="0 0 24 24" className="hold-spinner-corner" style={{ transform: 'rotate(-90deg)' }}>
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
      </div>
    </div>
  );
}
