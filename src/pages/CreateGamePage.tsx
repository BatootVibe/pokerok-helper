import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { loadPresets, loadVenues, saveVenue, deleteVenue, loadGameHistory, findNearbyScheduledGame, deleteScheduledGame } from '../utils/storage';
import { HeaderBack } from '../components/HeaderBack';
import { ChipPreset } from '../types';
import { useNameList } from '../utils/hooks';

export function CreateGamePage() {
  const navigate = useNavigate();
  const { createGame } = useGame();

  const { names: players, add: addPlayer, remove: removePlayer, setNames: setPlayers } = useNameList();
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
    loadGameHistory().then(games => {
      if (games.length > 0) {
        setLastGamePlayers(games[0].players.map(p => p.playerName));
      }
    });
    findNearbyScheduledGame().then(game => {
      if (game) {
        setNearbyGame({ id: game.id, venue: game.venue, players: game.players });
        setShowNearbyPrompt(true);
      }
    });
  }, []);

  const useNearbyData = useCallback(async () => {
    if (nearbyGame) {
      await deleteScheduledGame(nearbyGame.id);
      if (nearbyGame.venue) {
        const existingVenues = loadVenues();
        if (!existingVenues.includes(nearbyGame.venue)) {
          saveVenue(nearbyGame.venue);
          setVenues(prev => [nearbyGame!.venue, ...prev]);
        }
        setSelectedVenue(nearbyGame.venue);
      }
      setPlayers(nearbyGame.players);
    }
    setShowNearbyPrompt(false);
  }, [nearbyGame, setPlayers]);

  const handleAddPlayer = useCallback(() => {
    const name = newPlayerName.trim();
    if (name && !players.includes(name)) {
      addPlayer(name);
      setNewPlayerName('');
    }
  }, [newPlayerName, players, addPlayer]);

  const handleAddLastPlayers = useCallback(() => {
    const newOnes = lastGamePlayers.filter(n => !players.includes(n));
    if (newOnes.length > 0) {
      setPlayers([...players, ...newOnes]);
    }
  }, [lastGamePlayers, players, setPlayers]);

  const chipPrice = startingChips && buyInRubles
    ? (Number(buyInRubles) / Number(startingChips)).toFixed(2)
    : null;

  const handleCreate = useCallback(() => {
    if (players.length === 0 || !startingChips || !buyInRubles || !selectedPresetId) return;

    const venue = newVenueName.trim() || selectedVenue || 'Не указано';
    if (newVenueName.trim() && !venues.includes(newVenueName.trim())) {
      saveVenue(newVenueName.trim());
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
  }, [players, startingChips, buyInRubles, selectedPresetId, newVenueName, selectedVenue, venues, createGame, navigate]);

  return (
    <div className="page">
      <HeaderBack title="Новая игра" />

      {showNearbyPrompt && nearbyGame && (
        <NearbyPrompt venue={nearbyGame.venue} onAccept={useNearbyData} onSkip={() => setShowNearbyPrompt(false)} />
      )}

      <div className="card">
        <div className="card-header">
          <h3>Игроки</h3>
          <span className="badge">{players.length}</span>
        </div>
        <div className="add-player-form">
          <input
            className="input"
            type="text"
            placeholder="Имя игрока"
            value={newPlayerName}
            onChange={e => setNewPlayerName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddPlayer()}
          />
          <button className="btn btn-primary btn-small" onClick={handleAddPlayer}>+</button>
          {lastGamePlayers.length > 0 && (
            <button
              className="btn btn-secondary btn-small"
              onClick={handleAddLastPlayers}
              title="Добавить игроков из последней игры"
            >
              ↻
            </button>
          )}
        </div>
        {players.length > 0 && (
          <div className="player-name-grid">
            {players.map((name, i) => (
              <div key={i} className="player-row">
                <span className="player-name">{name}</span>
                <button
                  className="btn btn-danger btn-icon btn-small"
                  onClick={() => removePlayer(i)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {players.length === 0 && (
          <p className="empty-text mt-8">Добавьте хотя бы одного игрока</p>
        )}
      </div>

      <div className="card">
        <h3 className="mb-16">⚙️ Настройки</h3>

        <VenueSection
          venues={venues}
          selectedVenue={selectedVenue}
          setSelectedVenue={setSelectedVenue}
          newVenueName={newVenueName}
          setNewVenueName={setNewVenueName}
          showVenueInput={showVenueInput}
          setShowVenueInput={setShowVenueInput}
        />

        <div className="settings-row">
          <div className="settings-field">
            <label className="form-label">Стартовые очки</label>
            <input
              className="input input-center input-bold"
              type="number"
              value={startingChips}
              onChange={e => setStartingChips(e.target.value)}
              placeholder="500"
            />
          </div>
          <div className="settings-field">
            <label className="form-label">Buy-in (₽)</label>
            <input
              className="input input-center input-bold"
              type="number"
              value={buyInRubles}
              onChange={e => setBuyInRubles(e.target.value)}
              placeholder="250"
            />
          </div>
          {chipPrice && (
            <div className="settings-field">
              <label className="form-label">Цена 1 очка</label>
              <input
                className="input input-center input-bold chip-price-input"
                type="text"
                readOnly
                value={`${chipPrice} ₽`}
              />
            </div>
          )}
        </div>
      </div>

      {presets.length > 0 ? (
        <div className="card">
          <h3 className="mb-12">🪙 Пресет фишек</h3>
          <div className="preset-selector">
            {presets.map(preset => (
              <div
                key={preset.id}
                className={`preset-chip ${selectedPresetId === preset.id ? 'active' : ''}`}
                onClick={() => setSelectedPresetId(preset.id)}
              >
                {preset.name}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card text-center">
          <p className="text-muted mb-12">Нет сохранённых пресетов</p>
          <button className="btn btn-secondary btn-small" onClick={() => navigate('/chips')}>
            🎯 Создать пресет
          </button>
        </div>
      )}

      <div className="spacer" />

      <button
        className="btn btn-primary mt-16"
        onClick={handleCreate}
        disabled={players.length === 0 || !startingChips || !buyInRubles || !selectedPresetId}
      >
        {selectedPresetId ? 'Продолжить' : 'Выберите пресет фишек'}
      </button>
    </div>
  );
}

// === Sub-components ===

function NearbyPrompt({ venue, onAccept, onSkip }: {
  venue: string;
  onAccept: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="card card-warning">
      <div className="card-header">
        <span className="font-semibold">📅 Запланированная игра</span>
        <button className="btn-icon" onClick={onSkip}>×</button>
      </div>
      <p className="text-muted text-sm mb-12">
        Найдена запись: <b>{venue}</b> с игроками
      </p>
      <div className="form-actions">
        <button className="btn btn-primary btn-small" style={{ flex: 1 }} onClick={onAccept}>
          ✅ Заполнить автоматически
        </button>
        <button className="btn btn-secondary btn-small" style={{ flex: 1 }} onClick={onSkip}>
          Пропустить
        </button>
      </div>
    </div>
  );
}

function VenueSection({ venues, selectedVenue, setSelectedVenue, newVenueName, setNewVenueName, showVenueInput, setShowVenueInput }: {
  venues: string[];
  selectedVenue: string;
  setSelectedVenue: (v: string) => void;
  newVenueName: string;
  setNewVenueName: (v: string) => void;
  showVenueInput: boolean;
  setShowVenueInput: (v: boolean) => void;
}) {
  if (venues.length === 0 || showVenueInput) {
    return (
      <div className="form-group">
        <label className="form-label">📍 Место</label>
        <input
          className="input"
          type="text"
          placeholder="Название места"
          value={newVenueName}
          onChange={e => setNewVenueName(e.target.value)}
        />
        {venues.length > 0 && (
          <button
            className="btn btn-secondary btn-small mt-8"
            onClick={() => { setShowVenueInput(false); setNewVenueName(''); }}
          >
            ← Выбрать
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="form-group">
      <label className="form-label">📍 Место</label>
      <div className="preset-selector mb-8">
        {venues.map(v => (
          <div
            key={v}
            className={`preset-chip ${selectedVenue === v ? 'active' : ''}`}
            onClick={() => { setSelectedVenue(v); setNewVenueName(''); }}
          >
            {v}
            <span
              className="preset-delete-x"
              onClick={e => {
                e.stopPropagation();
                deleteVenue(v);
                if (selectedVenue === v) setSelectedVenue('');
              }}
            >×</span>
          </div>
        ))}
      </div>
      <button className="btn btn-secondary btn-small" onClick={() => setShowVenueInput(true)}>
        + Новое
      </button>
    </div>
  );
}
