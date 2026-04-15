import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { loadPresets } from '../utils/storage';
import { ChipPreset, CHIP_COLOR_MAP, GameResult } from '../types';
import { HeaderBack } from '../components/HeaderBack';
import { CHIP_INPUTS_KEY } from '../utils/constants';

export function ChipCountPage() {
  const navigate = useNavigate();
  const { currentGame, selectedPresetId } = useGame();

  const [presets, setPresets] = useState<ChipPreset[]>([]);
  const [chipInputs, setChipInputs] = useState<Record<string, Record<number, number>>>({});

  // Restore saved inputs from localStorage
  useEffect(() => {
    loadPresets().then(p => setPresets(p));

    if (currentGame) {
      const saved = localStorage.getItem(CHIP_INPUTS_KEY + currentGame.id);
      if (saved) {
        try {
          setChipInputs(JSON.parse(saved));
        } catch {
          // ignore
        }
      }
    }
  }, [currentGame]);

  // Save inputs to localStorage on every change
  useEffect(() => {
    if (!currentGame || Object.keys(chipInputs).length === 0) return;
    localStorage.setItem(CHIP_INPUTS_KEY + currentGame.id, JSON.stringify(chipInputs));
  }, [chipInputs, currentGame]);

  const selectedPreset = presets.find(p =>
    p.id === selectedPresetId && Array.isArray(p.chips)
  ) || null;

  if (!currentGame) {
    return (
      <div className="page">
        <h1 className="page-title">Игра не найдена</h1>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          На главную
        </button>
      </div>
    );
  }

  const handleChipChange = useCallback((playerId: string, chipIndex: number, value: string) => {
    const num = Math.max(0, parseInt(value) || 0);
    setChipInputs(prev => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] || {}),
        [chipIndex]: num,
      },
    }));
  }, []);

  if (!selectedPreset) {
    return (
      <div className="page">
        <HeaderBack title="Подсчёт фишек" />
        <div className="card">
          <p className="empty-text">
            Не выбран пресет фишек. Вернитесь назад и выберите пресет при создании игры.
          </p>
        </div>
      </div>
    );
  }

  const calculateResults = (): GameResult[] => {
    return currentGame.players.map(player => {
      const buyInQty = 1;
      const rebuyQty = player.rebuyQty;
      const wasChips = currentGame.startingChips * (buyInQty + rebuyQty);

      const playerInputs = chipInputs[player.id] || {};
      let becameChips = 0;

      selectedPreset.chips.forEach((chip, index) => {
        const qty = playerInputs[index] || 0;
        becameChips += qty * chip.nominal;
      });

      const rubles = becameChips * currentGame.chipPriceRubles;
      const spentRubles = currentGame.buyInRubles * (buyInQty + rebuyQty);

      return {
        playerId: player.id,
        playerName: player.name,
        userId: player.userId,
        buyInQty,
        rebuyQty,
        wasChips,
        becameChips,
        rubles,
        spentRubles,
      };
    });
  };

  const goResults = () => {
    const results = calculateResults();
    navigate('/results', { state: { results } });
  };

  return (
    <div className="page">
      <HeaderBack title="Подсчёт фишек" />

      {currentGame.players.map(player => (
        <div key={player.id} className="card card-finish">
          <div className="card-header">
            <h3 className={player.userId ? 'verified-player' : ''}>
              {player.name}
            </h3>
            <span className="text-muted text-sm">
              Было: <b>{currentGame.startingChips * (1 + player.rebuyQty)} pts</b>
            </span>
          </div>
          <div className="chip-grid">
            {selectedPreset.chips
              .map((chip, i) => ({ chip, origIndex: i }))
              .sort((a, b) => a.chip.nominal - b.chip.nominal)
              .map(({ chip, origIndex }) => (
                <ChipRow
                  key={chip.color + chip.nominal}
                  chip={chip}
                  value={chipInputs[player.id]?.[origIndex] || 0}
                  onChange={value => handleChipChange(player.id, origIndex, value)}
                />
              ))}
          </div>
        </div>
      ))}

      <div className="fixed-actions">
        <button className="btn btn-success" onClick={goResults}>
          📊 Рассчитать
        </button>
      </div>
    </div>
  );
}

function ChipRow({ chip, value, onChange }: {
  chip: { color: ChipPreset['chips'][number]['color']; nominal: number };
  value: number;
  onChange: (value: string) => void;
}) {
  const textColor = isLightColor(chip.color) ? '#1a1a1a' : '#ffffff';

  return (
    <div className="chip-row">
      <div
        className="chip-rect"
        style={{ background: CHIP_COLOR_MAP[chip.color] }}
      >
        <span className="chip-rect-nominal" style={{ color: textColor }}>
          {chip.nominal}
        </span>
      </div>
      <input
        type="number"
        min="0"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder="0"
        className="chip-row-input chip-row-input-lg"
        onFocus={e => e.target.style.borderColor = 'var(--accent-gold)'}
        onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
      />
    </div>
  );
}

function isLightColor(color: string): boolean {
  return ['white', 'yellow', 'pink'].includes(color);
}
