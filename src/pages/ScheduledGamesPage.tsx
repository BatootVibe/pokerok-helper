import { useState, useEffect, useCallback } from 'react';
import { ScheduledGame } from '../types';
import { loadScheduledGames, saveScheduledGame, deleteScheduledGame, generateId, loadVenues } from '../utils/storage';
import { HeaderBack } from '../components/HeaderBack';
import { formatDate, formatTime, isPast } from '../utils/date';
import { useNameList } from '../utils/hooks';
import { NEARBY_GAME_MARGIN } from '../utils/constants';

export function ScheduledGamesPage() {
  const [scheduled, setScheduled] = useState<ScheduledGame[]>([]);
  const [venues, setVenues] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
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

    const game: ScheduledGame = {
      id: generateId(),
      venue: finalVenue,
      scheduledAt: new Date(dateTime).toISOString(),
      players,
      createdAt: new Date().toISOString(),
    };

    await saveScheduledGame(game);
    await loadScheduled();
    setShowForm(false);
    setVenue('');
    setNewVenue('');
    setDateTime('');
    clearPlayers();
  }, [newVenue, venue, dateTime, players, loadScheduled, clearPlayers]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteScheduledGame(id);
    await loadScheduled();
  }, [loadScheduled]);

  return (
    <div className="page">
      <HeaderBack title="Запланированные" />

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
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <button className="btn btn-secondary" onClick={() => setShowForm(true)}>
          + Запланировать игру
        </button>
      )}

      {scheduled.length > 0 && (
        <div className="mt-16">
          {scheduled.map(game => (
            <ScheduledEntry
              key={game.id}
              game={game}
              onDelete={() => handleDelete(game.id)}
            />
          ))}
        </div>
      )}

      {scheduled.length === 0 && !showForm && (
        <div className="card text-center empty-state">
          <div className="empty-state-icon">📅</div>
          <p className="text-muted">Нет запланированных игр</p>
        </div>
      )}

      <div className="spacer" />
    </div>
  );
}

// === Sub-components ===

function ScheduleForm({
  venues, venue, setVenue, newVenue, setNewVenue,
  dateTime, setDateTime, playerInput, setPlayerInput,
  players, addPlayer, removePlayer,
  onSave, onCancel,
}: {
  venues: string[];
  venue: string; setVenue: (v: string) => void;
  newVenue: string; setNewVenue: (v: string) => void;
  dateTime: string; setDateTime: (v: string) => void;
  playerInput: string; setPlayerInput: (v: string) => void;
  players: string[];
  addPlayer: (name: string) => void;
  removePlayer: (idx: number) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const handleAddPlayer = () => {
    addPlayer(playerInput);
    setPlayerInput('');
  };

  return (
    <div className="card">
      <h3 className="mb-16">Новая запись</h3>

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
          <button className="btn btn-primary btn-small" onClick={() => addPlayer(playerInput)}>+</button>
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

function ScheduledEntry({ game, onDelete }: {
  game: ScheduledGame;
  onDelete: () => void;
}) {
  const past = isPast(game.scheduledAt, NEARBY_GAME_MARGIN);

  return (
    <div className={`card scheduled-entry ${past ? 'past' : ''}`}>
      <div className="scheduled-header">
        <div>
          <div className="scheduled-venue font-bold">{game.venue}</div>
          <div className="scheduled-time text-muted">
            {formatDate(game.scheduledAt)} в {formatTime(game.scheduledAt)}
          </div>
          <div className="scheduled-players text-muted">
            👥 {game.players.join(', ')}
          </div>
        </div>
        <button
          className="btn btn-danger btn-icon btn-small"
          onClick={onDelete}
        >
          ×
        </button>
      </div>
    </div>
  );
}
