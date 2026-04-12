import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { loadPresets, loadVenues, saveVenue, deleteVenue, loadGameHistory, findNearbyScheduledGame, deleteScheduledGame } from '../utils/storage';
import { HeaderBack } from '../components/HeaderBack';
import { ChipPreset } from '../types';
import { useNameList } from '../utils/hooks';

export function CreateGamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { createGame } = useGame();

  const { names: players, add: addPlayer, remove: removePlayer, setNames: setPlayers } = useNameList();
  const [newPlayerName, setNewPlayerName] = useState('');
  const [startingChips, setStartingChips] = useState('500');
  const [buyInRubles, setBuyInRubles] = useState('250');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [presets, setPresets] = useState<ChipPreset[]>([]);
  const appliedPresetRef = useRef<string | null>(null);
  const [venues, setVenues] = useState<string[]>([]);
  const [selectedVenue, setSelectedVenue] = useState('');
  const [newVenueName, setNewVenueName] = useState('');
  const [showVenueInput, setShowVenueInput] = useState(false);
  const [lastGamePlayers, setLastGamePlayers] = useState<string[]>([]);
  const [nearbyGame, setNearbyGame] = useState<{ id: string; venue: string; players: string[] } | null>(null);
  const [showNearbyPrompt, setShowNearbyPrompt] = useState(false);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showPresetDropdown) return;
    const handler = () => setShowPresetDropdown(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showPresetDropdown]);

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

  // Auto-select preset when returning from preset creation
  useEffect(() => {
    // Проверяем sessionStorage (от navigate(-1)) и location.state (fallback)
    const presetId = sessionStorage.getItem('pendingPresetId') || location.state?.selectedPresetId;
    if (presetId && appliedPresetRef.current !== presetId) {
      setSelectedPresetId(presetId);
      appliedPresetRef.current = presetId;
      sessionStorage.removeItem('pendingPresetId');
    }
  }, [location.state]);

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

  const dismissPrompt = useCallback(() => {
    setShowNearbyPrompt(false);
  }, []);

  const skipAndDelete = useCallback(async () => {
    if (nearbyGame) {
      await deleteScheduledGame(nearbyGame.id);
    }
    setShowNearbyPrompt(false);
  }, [nearbyGame]);

  const handleAddPlayer = useCallback(() => {
    const name = newPlayerName.trim();
    if (name && !players.includes(name) && players.length < 10) {
      addPlayer(name);
      setNewPlayerName('');
    }
  }, [newPlayerName, players, addPlayer]);

  const handleAddLastPlayers = useCallback(() => {
    const newOnes = lastGamePlayers.filter(n => !players.includes(n));
    const available = 10 - players.length;
    if (available <= 0) return;
    const toAdd = newOnes.slice(0, available);
    if (toAdd.length > 0) {
      setPlayers([...players, ...toAdd]);
    }
  }, [lastGamePlayers, players, setPlayers]);

  const chipPrice = startingChips && buyInRubles
    ? (Number(buyInRubles) / Number(startingChips)).toFixed(2)
    : null;

  const handleCreate = useCallback(() => {
    if (players.length < 2 || !startingChips || !buyInRubles || !selectedPresetId) return;

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

      <div className="card card-preset-selector">
        <div className="preset-selector-row">
          <label className="preset-selector-label">Пресет</label>
          <div className="preset-dropdown">
            <button
              className="preset-dropdown-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowPresetDropdown(!showPresetDropdown);
              }}
            >
              {selectedPresetId
                ? presets.find(p => p.id === selectedPresetId)?.name || '—'
                : 'Выбрать'
              }
              <span className={`preset-dropdown-arrow ${showPresetDropdown ? 'open' : ''}`}>▾</span>
            </button>
            {showPresetDropdown && (
              <div className="preset-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                {presets.map(preset => (
                  <div
                    key={preset.id}
                    className={`preset-dropdown-item ${selectedPresetId === preset.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedPresetId(preset.id);
                      setShowPresetDropdown(false);
                    }}
                  >
                    {preset.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            className="btn btn-link btn-small"
            onClick={() => navigate('/presets', { state: { fromCreate: true } })}
          >
            Настроить
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header-centered">
          <h3>Игроки</h3>
          <span className="badge">{players.length}/10</span>
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
          <button className="btn btn-primary btn-small" onClick={handleAddPlayer} disabled={players.length >= 10}>+</button>
          {lastGamePlayers.length > 0 && (
            <button
              className="btn btn-secondary btn-small"
              onClick={handleAddLastPlayers}
              disabled={players.length >= 10}
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
        {players.length < 2 && (
          <p className="empty-text mt-8">Добавьте минимум 2 игроков</p>
        )}

        {showNearbyPrompt && nearbyGame && (
          <div className="nearby-inline">
            <div className="nearby-info">
              <span className="nearby-venue">{nearbyGame.venue}</span>
              <span className="nearby-sep">•</span>
              <span className="nearby-count">{nearbyGame.players.length} {nearbyGame.players.length === 1 ? 'игрок' : nearbyGame.players.length < 5 ? 'игрока' : 'игроков'}</span>
              <span className="nearby-sep">•</span>
              <span className="nearby-players-list">{nearbyGame.players.slice(0, 3).join(', ')}{nearbyGame.players.length > 3 ? '…' : ''}</span>
            </div>
            <div className="nearby-actions">
              <button className="btn btn-primary btn-small" onClick={useNearbyData}>
                Заполнить
              </button>
              <button className="btn btn-danger btn-small" onClick={skipAndDelete}>
                Пропустить
              </button>
              <button className="btn btn-ghost btn-small" onClick={dismissPrompt}>
                Скрыть
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="card-title-center">Настройки</h3>

        <VenueSection
          venues={venues}
          selectedVenue={selectedVenue}
          setSelectedVenue={setSelectedVenue}
          newVenueName={newVenueName}
          setNewVenueName={setNewVenueName}
          showVenueInput={showVenueInput}
          setShowVenueInput={setShowVenueInput}
          setVenues={setVenues}
        />

        <div className="settings-row">
          <div className="settings-field">
            <label className="form-label">Очки (pts)</label>
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

      <div className="fixed-actions">
        <button
          className="btn btn-primary"
          onClick={handleCreate}
          disabled={!selectedPresetId || players.length < 2 || !startingChips || !buyInRubles}
        >
          {!selectedPresetId
            ? 'Выберите пресет'
            : players.length < 2
              ? 'Минимум 2 игрока'
              : !startingChips || !buyInRubles
                ? 'Заполните все поля'
                : 'Продолжить'
          }
        </button>
      </div>
    </div>
  );
}

function VenueSection({ venues, selectedVenue, setSelectedVenue, newVenueName, setNewVenueName, showVenueInput, setShowVenueInput, setVenues }: {
  venues: string[];
  selectedVenue: string;
  setSelectedVenue: (v: string) => void;
  newVenueName: string;
  setNewVenueName: (v: string) => void;
  showVenueInput: boolean;
  setShowVenueInput: (v: boolean) => void;
  setVenues: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  if (venues.length === 0 || showVenueInput) {
    return (
      <div className="form-group">
        <label className="form-label form-label-center">Локация</label>
        <input
          className="input"
          type="text"
          placeholder="Где играем?"
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
      <label className="form-label form-label-center">Локация</label>
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
                setVenues(prev => prev.filter(x => x !== v));
                if (selectedVenue === v) setSelectedVenue('');
              }}
            >×</span>
          </div>
        ))}
      </div>
      <button className="btn btn-secondary btn-small btn-center" onClick={() => setShowVenueInput(true)}>
        + Новое
      </button>
    </div>
  );
}
