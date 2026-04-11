import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { loadPresets, addCompletedGame } from '../utils/storage';
import { CompletedGame, GameResult, ChipPreset, CHIP_COLOR_MAP } from '../types';
import { HeaderBack } from '../components/HeaderBack';

export function FinishPage() {
  const navigate = useNavigate();
  const { currentGame, finishGame, selectedPresetId } = useGame();

  const [presets, setPresets] = useState<ChipPreset[]>([]);
  const [chipInputs, setChipInputs] = useState<Record<string, Record<number, number>>>({});
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    loadPresets().then(p => setPresets(p));
  }, []);

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

  const handleChipChange = (playerId: string, chipIndex: number, value: string) => {
    const num = parseInt(value) || 0;
    setChipInputs(prev => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] || {}),
        [chipIndex]: num,
      },
    }));
  };

  const calculateResults = (): GameResult[] => {
    if (!currentGame || !selectedPreset) return [];

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
        buyInQty,
        rebuyQty,
        wasChips,
        becameChips,
        rubles,
        spentRubles,
      };
    });
  };

  const handleFinish = async () => {
    if (!currentGame || !selectedPreset) return;

    const results = calculateResults();

    const completedGame: CompletedGame = {
      id: currentGame.id,
      date: currentGame.date,
      finishedAt: new Date().toISOString(),
      venue: currentGame.venue || 'Не указано',
      players: results,
      startingChips: currentGame.startingChips,
      buyInRubles: currentGame.buyInRubles,
      chipPriceRubles: currentGame.chipPriceRubles,
    };

    await addCompletedGame(completedGame);
    finishGame();
    navigate('/history');
  };

  const results = showResults ? calculateResults() : [];

  return (
    <div className="page">
      <HeaderBack title="Подсчёт" />

      {!selectedPreset ? (
        <div className="card">
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
            Не выбран пресет фишек. Вернитесь назад и выберите пресет при создании игры.
          </p>
          <button className="btn btn-secondary mt-16" onClick={() => navigate('/table')}>
            Назад к столу
          </button>
        </div>
      ) : (
        <>
          {/* Ввод фишек для каждого игрока */}
          {!showResults && currentGame.players.map(player => (
            <div key={player.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3>{player.name}</h3>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Было: <b>{currentGame.startingChips * (1 + player.rebuyQty)}</b>
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                {selectedPreset.chips.map((chip, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    borderRadius: 12,
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: CHIP_COLOR_MAP[chip.color],
                        border: '2px solid rgba(255, 255, 255, 0.3)',
                        flexShrink: 0,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                      }}
                    />
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, minWidth: 24 }}>
                      {chip.nominal}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>×</span>
                    <input
                      type="number"
                      min="0"
                      value={chipInputs[player.id]?.[index] || ''}
                      onChange={e => handleChipChange(player.id, index, e.target.value)}
                      placeholder="0"
                      style={{
                        width: 60,
                        padding: '6px 4px',
                        borderRadius: 8,
                        border: '1px solid var(--border-color)',
                        background: 'rgba(0, 0, 0, 0.3)',
                        color: 'var(--text-primary)',
                        fontSize: 16,
                        textAlign: 'center',
                        outline: 'none',
                        fontWeight: 700,
                      }}
                      onFocus={e => e.target.style.borderColor = 'var(--accent-gold)'}
                      onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Кнопки */}
          {!showResults && (
            <>
              <button
                className="btn btn-primary mt-16"
                onClick={() => setShowResults(true)}
                style={{ fontSize: 17, padding: '16px 24px' }}
              >
                📊 Рассчитать
              </button>
              <button
                className="btn btn-secondary mt-16"
                onClick={() => navigate('/table')}
              >
                Назад к столу
              </button>
            </>
          )}

          {/* Таблица результатов */}
          {showResults && (
            <>
              <div className="card">
                <h3 style={{ marginBottom: 16, textAlign: 'center' }}>📊 Результаты</h3>
                <table className="result-table">
                  <thead>
                    <tr>
                      <th>Игрок</th>
                      <th>Было</th>
                      <th>Стало</th>
                      <th>Рубли</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(result => {
                      const isZero = result.becameChips === 0;
                      const displayRubles = isZero ? -result.spentRubles : result.rubles;
                      const isPositive = result.rubles > result.spentRubles;
                      const diff = result.rubles - result.spentRubles;
                      const rubleClass = isPositive ? 'result-positive' : 'result-negative';

                      return (
                        <tr key={result.playerId}>
                          <td style={{ fontWeight: 600 }}>{result.playerName}</td>
                          <td>{result.wasChips}</td>
                          <td>{result.becameChips}</td>
                          <td className={rubleClass}>
                            {displayRubles.toFixed(0)} ₽
                            {!isZero && <span style={{ fontSize: 11, opacity: 0.7 }}> ({diff > 0 ? '+' : ''}{diff.toFixed(0)} ₽)</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button
                className="btn btn-success mt-16"
                onClick={handleFinish}
                style={{ fontSize: 17, padding: '16px 24px' }}
              >
                ✅ Завершить и сохранить
              </button>
              <button
                className="btn btn-secondary mt-16"
                onClick={() => setShowResults(false)}
              >
                Назад к вводу
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
