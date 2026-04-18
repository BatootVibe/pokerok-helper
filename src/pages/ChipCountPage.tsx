import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { loadPresets } from '../utils/storage';
import { ChipPreset, CHIP_COLOR_MAP, GameResult } from '../types';
import { HeaderBack } from '../components/HeaderBack';
import { CHIP_INPUTS_KEY } from '../utils/constants';
import { apiUpdateActiveGameChips, apiGetMyActiveGame } from '../utils/api';
import { useActiveGamePolling } from '../utils/hooks';

export default function ChipCountPage() {
  const navigate = useNavigate();
  const { currentGame, selectedPresetId, isOwner, myPlayerId } = useGame();

  const [presets, setPresets] = useState<ChipPreset[]>([]);
  const [chipInputs, setChipInputs] = useState<Record<string, Record<number, number>>>({});
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const apiChipsTimerRef = useRef<number | null>(null);
  const dirtyPlayersRef = useRef<Set<string>>(new Set());

  const { setNavigate } = useActiveGamePolling(3000);
  useEffect(() => { setNavigate(navigate); }, [navigate, setNavigate]);

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

  useEffect(() => {
    if (!currentGame) return;

    const poll = async () => {
      try {
        const result = await apiGetMyActiveGame();
        if (result?.chipInputs && Object.keys(result.chipInputs).length > 0) {
          setChipInputs(prev => {
            const merged = { ...prev };
            for (const [pid, chips] of Object.entries(result.chipInputs)) {
              if (!dirtyPlayersRef.current.has(pid)) {
                merged[pid] = chips;
              }
            }
            return merged;
          });
        }
      } catch {}
    };

    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [currentGame]);

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
    dirtyPlayersRef.current.add(playerId);
    setChipInputs(prev => {
      const updated = {
        ...prev,
        [playerId]: {
          ...(prev[playerId] || {}),
          [chipIndex]: num,
        },
      };

      if (apiChipsTimerRef.current) clearTimeout(apiChipsTimerRef.current);
      apiChipsTimerRef.current = window.setTimeout(() => {
        apiUpdateActiveGameChips(currentGame.id, playerId, updated[playerId])
          .then(() => dirtyPlayersRef.current.delete(playerId))
          .catch(() => {});
        apiChipsTimerRef.current = null;
      }, 500);

      return updated;
    });
  }, [currentGame]);

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

  const getPlayerTotalChips = (playerId: string): number => {
    const inputs = chipInputs[playerId] || {};
    let total = 0;
    selectedPreset.chips.forEach((chip, index) => {
      total += (inputs[index] || 0) * chip.nominal;
    });
    return total;
  };

  const isPlayerFilled = (playerId: string): boolean => {
    return playerId in chipInputs;
  };

  const canEditPlayer = (playerId: string): boolean => {
    if (isOwner) return true;
    return playerId === myPlayerId;
  };

  const openAccordion = (playerId: string) => {
    if (expandedPlayerId === playerId) {
      setExpandedPlayerId(null);
    } else {
      setExpandedPlayerId(playerId);
      if (!(playerId in chipInputs)) {
        setChipInputs(prev => ({ ...prev, [playerId]: {} }));
      }
    }
  };

  return (
    <div className="page">
      <HeaderBack title="Подсчёт фишек" />

      {currentGame.players.map(player => {
        const isExpanded = expandedPlayerId === player.id;
        const filled = isPlayerFilled(player.id);
        const totalChips = getPlayerTotalChips(player.id);
        const wasChips = currentGame.startingChips * (1 + player.rebuyQty);
        const editable = canEditPlayer(player.id);

        return (
          <div key={player.id} className={`card chip-accordion ${isExpanded ? 'chip-accordion-expanded' : ''} ${filled ? 'chip-accordion-filled' : ''}`}>
            <div className="chip-accordion-header" onClick={() => openAccordion(player.id)}>
              <div className="chip-accordion-info">
                <span className={player.userId ? 'verified-player' : ''}>{player.name}</span>
                <span className="text-muted text-sm">
                  Было: <b>{wasChips} pts</b>
                </span>
              </div>
              <div className="chip-accordion-right">
                {filled && (
                  <span className={totalChips >= wasChips ? 'result-positive' : 'result-negative'}>
                    {totalChips} pts
                  </span>
                )}
                {!filled && <span className="chip-accordion-unfilled">ввести</span>}
                <span className={`expand-arrow ${isExpanded ? 'rotated' : ''}`}>▼</span>
              </div>
            </div>

            {isExpanded && (
              <div className="chip-accordion-body">
                <div className="chip-grid">
                  {selectedPreset.chips
                    .map((chip, i) => ({ chip, origIndex: i }))
                    .sort((a, b) => a.chip.nominal - b.chip.nominal)
                    .map(({ chip, origIndex }) => (
                      <ChipRow
                        key={chip.color + chip.nominal}
                        chip={chip}
                        value={chipInputs[player.id]?.[origIndex] || 0}
                        onChange={editable ? (value => handleChipChange(player.id, origIndex, value)) : undefined}
                      />
                    ))}
                </div>
                {editable && (
                  <button
                    className="btn btn-primary btn-small chip-accordion-done"
                    onClick={() => setExpandedPlayerId(null)}
                  >
                    ✓ Готово
                  </button>
                )}
                {!editable && (
                  <p className="text-muted text-sm" style={{ textAlign: 'center', padding: '8px 0' }}>
                    Только просмотр
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

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
  onChange?: (value: string) => void;
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
      {onChange ? (
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
      ) : (
        <span className="chip-row-input chip-row-input-lg chip-row-readonly">
          {value || '—'}
        </span>
      )}
    </div>
  );
}

function isLightColor(color: string): boolean {
  return ['white', 'yellow', 'pink'].includes(color);
}
