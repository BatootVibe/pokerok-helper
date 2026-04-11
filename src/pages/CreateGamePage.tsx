import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { loadPresets, loadVenues, saveVenue, deleteVenue, loadGameHistory, findNearbyScheduledGame, deleteScheduledGame } from '../utils/storage';
import { HeaderBack } from '../components/HeaderBack';
import { ChipPreset } from '../types';

export function CreateGamePage() {
  const navigate = useNavigate();
  const { createGame } = useGame();

  const [players, setPlayers] = useState<string[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [startingChips, setStartingChips] = useState('500');
  const [buyInRubles, setBuyInRubles] = useState('250');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [presets, setPresets] = useState<ChipPreset[]>([]);
  const [venues, setVenues] = useState<string[]>([]);
  const [selectedVenue, setSelectedVenue] = useState('');
  const [newVenueName, setNewVenueName] = useState('');
  const [showVenueInput, setShowVenueInput] = useState(false);
  const [lastGamePlayers, setLastGamePlayers] = useState<string[]>([]);
  const [nearbyGame, setNearbyGame] = useState<{ id: string; venue: string; players: string[] } | null>(null);
  const [showNearbyPrompt, setShowNearbyPrompt] = useState(false);

  useEffect(() => {
    loadPresets().then(p => setPresets(p.filter(x => Array.isArray(x.chips))));
    setVenues(loadVenues());
    // Загружаем игроков из последней игры
    loadGameHistory().then(games => {
      if (games.length > 0) {
        const names = games[0].players.map(p => p.playerName);
        setLastGamePlayers(names);
      }
    });
    // Проверяем ближайшую запланированную игру
    findNearbyScheduledGame().then(game => {
      if (game) {
        setNearbyGame({ id: game.id, venue: game.venue, players: game.players });
        setShowNearbyPrompt(true);
      }
    });
  }, []);

  const useNearbyData = async () => {
    if (nearbyGame) {
      // Удаляем запланированную игру
      await deleteScheduledGame(nearbyGame.id);
      // Добавляем место
      if (nearbyGame.venue) {
        const existingVenues = loadVenues();
        if (!existingVenues.includes(nearbyGame.venue)) {
          setVenues(prev => [nearbyGame!.venue, ...prev]);
        }
        setSelectedVenue(nearbyGame.venue);
      }
      // Добавляем игроков
      setPlayers(nearbyGame.players);
    }
    setShowNearbyPrompt(false);
  };
  
  const chipPrice = startingChips && buyInRubles 
    ? (Number(buyInRubles) / Number(startingChips)).toFixed(2)
    : null;

  const addPlayer = () => {
    const name = newPlayerName.trim();
    if (name && !players.includes(name)) {
      setPlayers([...players, name]);
      setNewPlayerName('');
    }
  };

  const addLastPlayers = () => {
    const newOnes = lastGamePlayers.filter(n => !players.includes(n));
    if (newOnes.length > 0) {
      setPlayers([...players, ...newOnes]);
    }
  };

  const removePlayer = (index: number) => {
    setPlayers(players.filter((_, i) => i !== index));
  };

  const handleCreate = () => {
    if (players.length === 0) return;
    if (!startingChips || !buyInRubles) return;
    if (!selectedPresetId) return;

    // Сохраняем новое место, если введено
    const venue = newVenueName.trim() || selectedVenue || 'Не указано';
    if (newVenueName.trim() && !venues.includes(newVenueName.trim())) {
      saveVenue(newVenueName.trim());
      setVenues(prev => [newVenueName.trim(), ...prev]);
    } else if (selectedVenue) {
      saveVenue(selectedVenue);
    }

    createGame(
      players,
      Number(startingChips),
      Number(buyInRubles),
      selectedPresetId,
      venue
    );
    navigate('/table');
  };

  return (
    <div className="page">
      <HeaderBack title="Новая игра" />

      {/* Промпт: есть ближайшая запланированная */}
      {showNearbyPrompt && nearbyGame && (
        <div className="card" style={{ background: 'rgba(255, 200, 50, 0.08)', borderColor: 'rgba(255, 200, 50, 0.2)', borderStyle: 'solid', borderWidth: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>📅 Запланированная игра</span>
            <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 18 }} onClick={() => setShowNearbyPrompt(false)}>×</button>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Найдена запись: <b>{nearbyGame.venue}</b> с игроками
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-small" style={{ flex: 1, fontSize: 13, padding: '10px 12px' }} onClick={useNearbyData}>
              ✅ Заполнить автоматически
            </button>
            <button className="btn btn-secondary btn-small" style={{ flex: 1, fontSize: 13, padding: '10px 12px' }} onClick={async () => {
              if (nearbyGame) await deleteScheduledGame(nearbyGame.id);
              setShowNearbyPrompt(false);
            }}>
              Пропустить
            </button>
          </div>
        </div>
      )}

      {/* Игроки */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3>Игроки</h3>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.1)', padding: '2px 10px', borderRadius: 12 }}>
            {players.length}
          </span>
        </div>
        <div className="add-player-form">
          <input
            className="input"
            type="text"
            placeholder="Имя игрока"
            value={newPlayerName}
            onChange={e => setNewPlayerName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addPlayer()}
          />
          <button className="btn btn-primary btn-small" onClick={addPlayer} style={{ minWidth: 44, minHeight: 44, fontSize: 22 }}>
            +
          </button>
          {lastGamePlayers.length > 0 && (
            <button
              className="btn btn-secondary btn-small"
              onClick={addLastPlayers}
              title="Добавить игроков из последней игры"
              style={{ fontSize: 24, minWidth: 44, minHeight: 44 }}
            >
              ↻
            </button>
          )}
        </div>
        {players.length > 0 && (
          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {players.map((name, i) => (
              <div key={i} className="player-row" style={{ margin: 0, padding: '10px 12px' }}>
                <span className="player-name" style={{ fontSize: 14 }}>{name}</span>
                <button
                  className="btn btn-danger btn-icon btn-small"
                  style={{ width: 44, height: 44, fontSize: 22 }}
                  onClick={() => removePlayer(i)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {players.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, marginTop: 8 }}>
            Добавьте хотя бы одного игрока
          </p>
        )}
      </div>

      {/* Настройки: место, очки, бай-ин */}
      <div className="card">
        <h3 style={{ marginBottom: 16 }}>⚙️ Настройки</h3>

        {/* Место */}
        <div style={{ marginBottom: 16 }}>
          <label className="form-label">📍 Место</label>
          {venues.length > 0 && !showVenueInput ? (
            <div>
              <div className="preset-selector" style={{ marginBottom: 8 }}>
                {venues.map(v => (
                  <div
                    key={v}
                    className={`preset-chip ${selectedVenue === v ? 'active' : ''}`}
                    onClick={() => { setSelectedVenue(v); setNewVenueName(''); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', fontSize: 13 }}
                  >
                    {v}
                    <span
                      style={{ marginLeft: 2, opacity: 0.5, cursor: 'pointer' }}
                      onClick={e => {
                        e.stopPropagation();
                        deleteVenue(v);
                        setVenues(prev => prev.filter(x => x !== v));
                        if (selectedVenue === v) setSelectedVenue('');
                      }}
                    >×</span>
                  </div>
                ))}
              </div>
              <button
                className="btn btn-secondary btn-small"
                onClick={() => setShowVenueInput(true)}
                style={{ fontSize: 12, padding: '6px 12px' }}
              >
                + Новое
              </button>
            </div>
          ) : (
            <div>
              <input
                className="input"
                type="text"
                placeholder="Название места"
                value={newVenueName}
                onChange={e => setNewVenueName(e.target.value)}
                style={{ fontSize: 14, padding: '10px 14px' }}
              />
              {venues.length > 0 && (
                <button
                  className="btn btn-secondary btn-small"
                  style={{ marginTop: 8, fontSize: 12, padding: '6px 12px' }}
                  onClick={() => { setShowVenueInput(false); setNewVenueName(''); }}
                >
                  ← Выбрать
                </button>
              )}
            </div>
          )}
        </div>

        {/* Очки и бай-ин в строку */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">Стартовые очки</label>
            <input
              className="input"
              type="number"
              value={startingChips}
              onChange={e => setStartingChips(e.target.value)}
              placeholder="500"
              style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', padding: '12px 8px' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="form-label">Buy-in (₽)</label>
            <input
              className="input"
              type="number"
              value={buyInRubles}
              onChange={e => setBuyInRubles(e.target.value)}
              placeholder="250"
              style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', padding: '12px 8px' }}
            />
          </div>
          {chipPrice && (
            <div style={{ flex: 1 }}>
              <label className="form-label">Цена 1 очка</label>
              <input
                className="input"
                type="text"
                readOnly
                value={`${chipPrice} ₽`}
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  textAlign: 'center',
                  padding: '12px 8px',
                  color: 'var(--accent-gold)',
                  background: 'rgba(245, 200, 66, 0.08)',
                  borderColor: 'rgba(245, 200, 66, 0.3)',
                  cursor: 'default',
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Пресет фишек */}
      {presets.length > 0 ? (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>🪙 Пресет фишек</h3>
          <div className="preset-selector">
            {presets.map(preset => (
              <div
                key={preset.id}
                className={`preset-chip ${selectedPresetId === preset.id ? 'active' : ''}`}
                onClick={() => setSelectedPresetId(preset.id)}
                style={{ padding: '8px 12px', fontSize: 13 }}
              >
                {preset.name}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 12 }}>
            Нет сохранённых пресетов
          </p>
          <button
            className="btn btn-secondary btn-small"
            onClick={() => navigate('/chips')}
          >
            🎯 Создать пресет
          </button>
        </div>
      )}

      <div className="spacer" />

      <button
        className="btn btn-primary mt-16"
        onClick={handleCreate}
        disabled={players.length === 0 || !startingChips || !buyInRubles || !selectedPresetId}
        style={{
          opacity: players.length === 0 || !selectedPresetId ? 0.5 : 1,
          display: selectedPresetId ? undefined : 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {selectedPresetId ? (
          'Продолжить'
        ) : (
          <>
            <span>Продолжить</span>
            <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 400, textTransform: 'none' }}>
              Выберите пресет фишек
            </span>
          </>
        )}
      </button>
    </div>
  );
}
