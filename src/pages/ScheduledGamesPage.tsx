import { useState, useEffect, useCallback, useRef } from 'react';
import { ScheduledGame } from '../types';
import { loadScheduledGames, saveScheduledGame, deleteScheduledGame, loadVenues, getUserProfile, getAllPlayers } from '../utils/storage';
import { generateId } from '../utils/id';
import { HeaderBack } from '../components/HeaderBack';
import { formatDate, formatTime, isPast } from '../utils/date';
import { NEARBY_GAME_MARGIN } from '../utils/constants';
import { PlayerAutocomplete, Player } from '../components/PlayerAutocomplete';

// === Main Page ===

export function ScheduledGamesPage() {
  const [scheduled, setScheduled] = useState<ScheduledGame[]>([]);
  const [venues, setVenues] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingGame, setEditingGame] = useState<ScheduledGame | null>(null);
  const [formKey, setFormKey] = useState(0);

  // Form state
  const [venue, setVenue] = useState('');
  const [newVenue, setNewVenue] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);

  // Loading state
  const [loading, setLoading] = useState(true);

  // Auth state
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const currentTgId = tgUser ? String(tgUser.id) : null;
  const [isBound, setIsBound] = useState(false);

  useEffect(() => {
    if (currentTgId) {
      getUserProfile(currentTgId).then(profile => setIsBound(!!profile));
    }
  }, [currentTgId]);

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
    setFormKey(k => k + 1);
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

  const openEditForm = useCallback(async (game: ScheduledGame) => {
    setEditingGame(game);
    setVenue(game.venue || '');
    setNewVenue('');
    setDateTime(game.scheduledAt || '');
    // Подставляем userId для привязанных игроков
    const allPlayers = await getAllPlayers();
    const playerMap = new Map(allPlayers.map(p => [p.name.toLowerCase(), { name: p.name, userId: p.id }]));
    setPlayers((game.players || []).map(name => {
      const linked = playerMap.get(name.toLowerCase());
      return linked || { name };
    }));
    setFormKey(k => k + 1);
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
      // Обновляем стейт напрямую
      await loadData();
      // Сбрасываем форму после успешного сохранения
      setEditingGame(null);
      setVenue('');
      setNewVenue('');
      setDateTime('');
      setPlayers([]);
      setShowForm(false);
    } catch (err) {
      console.error('Failed to save scheduled game:', err);
      alert('Не удалось сохранить игру на сервер. Попробуйте ещё раз.');
    }
  }, [newVenue, venue, dateTime, players, editingGame, loadData]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteScheduledGame(id);
      // Обновляем стейт напрямую, без перезагрузки из API/localStorage
      setScheduled(prev => prev.filter(g => g.id !== id));
      // Сбрасываем форму
      setEditingGame(null);
      setVenue('');
      setNewVenue('');
      setDateTime('');
      setPlayers([]);
      setFormKey(k => k + 1);
      setShowForm(false);
    } catch (err) {
      console.error('Failed to delete scheduled game:', err);
      alert('Не удалось удалить игру с сервера.');
    }
  }, []);

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
          key={formKey}
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
          onDelete={editingGame && isBound ? () => handleDelete(editingGame.id) : undefined}
          onCancel={closeForm}
          isBound={isBound}
        />
      ) : sorted.length > 0 ? (
        <div className="mt-16">
          {sorted.map(game => (
            <ScheduledEntry key={game.id} game={game} onEdit={() => isBound && openEditForm(game)} canEdit={isBound} />
          ))}
          {isBound && (
            <p className="page-hint text-center">Удерживайте карточку 2 сек для редактирования</p>
          )}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          Пока нет запланированных игр
        </div>
      )}

      <div className="fixed-actions">
        {!showForm && isBound && (
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
  onSave, onDelete, onCancel, isBound,
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
  isBound: boolean;
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
        <PlayerAutocomplete players={players} onAddPlayer={onAddPlayer} onRemovePlayer={onRemovePlayer} showHistoryBtn={false} />
        {players.length < 2 && (
          <p className="empty-text mt-8">Минимум 2 игрока</p>
        )}
      </div>

      <div className="form-actions">
        {isBound && (
          <button
            className="btn btn-primary btn-small"
            style={{ flex: 1 }}
            onClick={handleSave}
            disabled={players.length < 2 || saving}
          >
            {saving ? '⏳' : '💾'} Сохранить
          </button>
        )}
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

// === Scheduled Entry Card ===

function ScheduledEntry({ game, onEdit, canEdit }: { game: ScheduledGame; onEdit: () => void; canEdit: boolean }) {
  const holdTimerRef = useRef<number | null>(null);
  const [isHolding, setIsHolding] = useState(false);

  const EDIT_HOLD_DURATION = 3000;

  const safeVenue = game.venue || 'Без локации';
  const safePlayers = Array.isArray(game.players) ? game.players : [];
  const safeScheduledAt = game.scheduledAt || '';
  const past = safeScheduledAt ? isPast(safeScheduledAt, NEARBY_GAME_MARGIN) : false;

  const startHold = () => {
    if (!canEdit) return;
    setIsHolding(true);
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      setIsHolding(false);
      onEdit();
    }, EDIT_HOLD_DURATION);
  };

  const releaseHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setIsHolding(false);
  };

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  return (
    <div
      className={`card scheduled-entry ${past ? 'past' : ''} ${isHolding ? 'holding' : ''}`}
      onMouseDown={startHold}
      onMouseUp={releaseHold}
      onMouseLeave={releaseHold}
      onTouchStart={startHold}
      onTouchEnd={releaseHold}
      onTouchCancel={releaseHold}
    >
      <div className="scheduled-header">
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
      </div>
    </div>
  );
}
