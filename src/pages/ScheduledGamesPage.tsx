import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScheduledGame } from '../types';
import { loadScheduledGames, saveScheduledGame, deleteScheduledGame, generateId, loadVenues } from '../utils/storage';

export function ScheduledGamesPage() {
  const navigate = useNavigate();
  const [scheduled, setScheduled] = useState<ScheduledGame[]>([]);
  const [venues, setVenues] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);

  // Форма
  const [venue, setVenue] = useState('');
  const [newVenue, setNewVenue] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [playerInput, setPlayerInput] = useState('');
  const [players, setPlayers] = useState<string[]>([]);

  useEffect(() => {
    loadScheduledGames().then(setScheduled);
    setVenues(loadVenues());
  }, []);

  const addPlayer = () => {
    const name = playerInput.trim();
    if (name && !players.includes(name)) {
      setPlayers([...players, name]);
      setPlayerInput('');
    }
  };

  const removePlayer = (idx: number) => {
    setPlayers(players.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
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
    setScheduled(await loadScheduledGames());
    setShowForm(false);
    setVenue('');
    setNewVenue('');
    setDateTime('');
    setPlayers([]);
  };

  const handleDelete = async (id: string) => {
    await deleteScheduledGame(id);
    setScheduled(await loadScheduledGames());
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const isPast = (iso: string) => {
    return new Date(iso).getTime() < Date.now() - 30 * 60 * 1000;
  };

  return (
    <div className="page">
      <h1 className="page-title">📅 Запланированные</h1>

      {showForm ? (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Новая запись</h3>

          {/* Место */}
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">📍 Место</label>
            {venues.length > 0 && !newVenue ? (
              <div>
                <div className="preset-selector" style={{ marginBottom: 8 }}>
                  {venues.map(v => (
                    <div
                      key={v}
                      className={`preset-chip ${venue === v ? 'active' : ''}`}
                      onClick={() => setVenue(v)}
                      style={{ padding: '6px 12px', fontSize: 13 }}
                    >
                      {v}
                    </div>
                  ))}
                </div>
                <button className="btn btn-secondary btn-small" onClick={() => setNewVenue(' ')} style={{ fontSize: 12, padding: '6px 12px' }}>
                  + Новое
                </button>
              </div>
            ) : (
              <input
                className="input"
                type="text"
                placeholder="Название места"
                value={newVenue}
                onChange={e => setNewVenue(e.target.value)}
                style={{ fontSize: 14, padding: '10px 14px' }}
              />
            )}
          </div>

          {/* Дата и время */}
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">🕐 Дата и время</label>
            <input
              className="input"
              type="datetime-local"
              value={dateTime}
              onChange={e => setDateTime(e.target.value)}
              style={{ fontSize: 14, padding: '10px 14px' }}
            />
          </div>

          {/* Игроки */}
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">👥 Игроки</label>
            <div className="add-player-form" style={{ marginBottom: 8 }}>
              <input
                className="input"
                type="text"
                placeholder="Имя игрока"
                value={playerInput}
                onChange={e => setPlayerInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPlayer()}
              />
              <button className="btn btn-primary btn-small" onClick={addPlayer}>+</button>
            </div>
            {players.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {players.map((name, i) => (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', background: 'rgba(255,255,255,0.06)',
                    borderRadius: 12, fontSize: 13,
                  }}>
                    {name}
                    <span style={{ cursor: 'pointer', opacity: 0.5 }} onClick={() => removePlayer(i)}>×</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-small" style={{ flex: 1 }} onClick={handleSave}>
              💾 Сохранить
            </button>
            <button className="btn btn-secondary btn-small" style={{ flex: 1 }} onClick={() => setShowForm(false)}>
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-secondary" onClick={() => setShowForm(true)}>
          + Запланировать игру
        </button>
      )}

      {/* Список запланированных */}
      {scheduled.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {scheduled.map(game => (
            <div key={game.id} className="card" style={{
              opacity: isPast(game.scheduledAt) ? 0.5 : 1,
              position: 'relative',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{game.venue}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {formatDate(game.scheduledAt)} в {formatTime(game.scheduledAt)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, opacity: 0.7 }}>
                    👥 {game.players.join(', ')}
                  </div>
                </div>
                <button
                  className="btn btn-danger btn-icon btn-small"
                  style={{ width: 28, height: 28, fontSize: 14 }}
                  onClick={() => handleDelete(game.id)}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {scheduled.length === 0 && !showForm && (
        <div className="card" style={{ textAlign: 'center', padding: 40, marginTop: 16 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📅</div>
          <p style={{ color: 'var(--text-secondary)' }}>Нет запланированных игр</p>
        </div>
      )}

      <div className="spacer" />
      <button className="btn btn-secondary mt-16" onClick={() => navigate('/')}>
        На главную
      </button>
    </div>
  );
}
