import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { loadPresets, loadVenues, saveVenue, deleteVenue, loadGameHistory, findNearbyScheduledGame, deleteScheduledGame } from '../utils/storage';
import { HeaderBack } from '../components/HeaderBack';
import { ChipPreset } from '../types';
import { PlayerAutocomplete, Player } from '../components/PlayerAutocomplete';

export function CreateGamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { createGame } = useGame();

  // Состояние игроков (теперь объекты)
  const [players, setPlayers] = useState<Player[]>([]);

  // Настройки игры
  const [startingChips, setStartingChips] = useState('500');
  const [buyInRubles, setBuyInRubles] = useState('250');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const appliedPresetRef = useRef<string | null>(null);

  // Локации
  const [venues, setVenues] = useState<string[]>([]);
  const [selectedVenue, setSelectedVenue] = useState('');
  const [newVenueName, setNewVenueName] = useState('');
  const [showVenueInput, setShowVenueInput] = useState(false);

  // Данные для подсказок (Nearby Game)
  const [nearbyGame, setNearbyGame] = useState<{ id: string; venue: string; players: string[] } | null>(null);
  const [showNearbyPrompt, setShowNearbyPrompt] = useState(false);
  const [presets, setPresets] = useState<ChipPreset[]>([]);

  // Закрытие dropdown при клике снаружи
  useEffect(() => {
    if (!showPresetDropdown) return;
    const handler = () => setShowPresetDropdown(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showPresetDropdown]);

  // Загрузка данных при старте
  useEffect(() => {
    loadPresets().then(p => setPresets(p.filter(x => Array.isArray(x.chips))));
    setVenues(loadVenues());

    // Загрузка последней игры для быстрого добавления игроков
    loadGameHistory().then(games => {
      if (games.length > 0) {
        window.lastGamePlayers = games[0].players.map(p => ({ name: p.playerName, tgId: (p as any).tgId }));
      }
    });

    // Проверка запланированных игр
    findNearbyScheduledGame().then(game => {
      if (game) {
        setNearbyGame({ id: game.id, venue: game.venue, players: game.players });
        setShowNearbyPrompt(true);
      }
    });
  }, []);

  // Авто-выбор пресета если вернулись со страницы создания пресета
  useEffect(() => {
    const presetId = sessionStorage.getItem('pendingPresetId') || location.state?.selectedPresetId;
    if (presetId && appliedPresetRef.current !== presetId) {
      setSelectedPresetId(presetId);
      appliedPresetRef.current = presetId;
      sessionStorage.removeItem('pendingPresetId');
    }
  }, [location.state]);

  const addPlayer = useCallback((player: Player) => {
    setPlayers(prev => {
      if (prev.length >= 10) return prev;
      // Проверка на дубликаты
      if (prev.some(p => p.name.toLowerCase() === player.name.toLowerCase())) return prev;
      return [...prev, player];
    });
  }, []);

  const removePlayer = useCallback((index: number) => {
    setPlayers(prev => prev.filter((_, i) => i !== index));
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
      // Преобразуем строки игроков в объекты
      setPlayers(nearbyGame.players.map(name => ({ name })));
    }
    setShowNearbyPrompt(false);
  }, [nearbyGame]);

  const dismissPrompt = useCallback(() => {
    setShowNearbyPrompt(false);
  }, []);

  const skipAndDelete = useCallback(async () => {
    if (nearbyGame) {
      await deleteScheduledGame(nearbyGame.id);
    }
    setShowNearbyPrompt(false);
  }, [nearbyGame]);

  const chipPrice = startingChips && buyInRubles && Number(startingChips) > 0
    ? (Number(buyInRubles) / Number(startingChips)).toFixed(2)
    : null;

  const handleCreate = useCallback(() => {
    if (players.length < 2 || Number(startingChips) <= 0 || Number(buyInRubles) < 0 || !selectedPresetId) return;

    const venue = newVenueName.trim() || selectedVenue || 'Не указано';
    if (newVenueName.trim() && !venues.includes(newVenueName.trim())) {
      saveVenue(newVenueName.trim());
    }

    // Создаем игру с объектами игроков
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

      {/* Выбор пресета (выпадающий список + кнопка Настроить) */}
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

      {/* Игроки с умным поиском */}
      <div className="card">
        <div className="card-header-centered">
          <h3>Игроки</h3>
          <span className="badge">{players.length}/10</span>
        </div>

        <PlayerAutocomplete
          players={players}
          onAddPlayer={addPlayer}
          onRemovePlayer={removePlayer}
        />

        {players.length < 2 && (
          <p className="empty-text mt-8">Добавьте минимум 2 игроков</p>
        )}

        {/* Запланированная игра */}
        {showNearbyPrompt && nearbyGame && (
          <div className="nearby-game-prompt">
            <div className="nearby-game-info">
              <span className="nearby-game-venue">📍 {nearbyGame.venue}</span>
              <span className="nearby-game-players">{nearbyGame.players.join(', ')}</span>
            </div>
            <div className="nearby-game-actions">
              <button className="btn btn-primary btn-small" onClick={useNearbyData}>Играть</button>
              <button className="btn btn-danger btn-small" onClick={skipAndDelete}>Удалить</button>
              <button className="btn btn-secondary btn-small btn-nearby-hide" onClick={dismissPrompt}>Скрыть</button>
            </div>
          </div>
        )}
      </div>

      {/* Настройки */}
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

      {/* Кнопки действий (фиксированные) */}
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

// Вспомогательный компонент для локаций (без изменений)
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
  const showInput = venues.length === 0 || showVenueInput;

  if (!showInput) {
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
          className="btn btn-secondary btn-small mt-8 btn-center"
          onClick={() => { setShowVenueInput(false); setNewVenueName(''); }}
        >
          ← Выбрать
        </button>
      )}
    </div>
  );
}
