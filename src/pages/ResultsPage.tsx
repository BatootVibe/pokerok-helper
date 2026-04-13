import { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { addCompletedGame } from '../utils/storage';
import { CompletedGame, GameResult } from '../types';
import { HeaderBack } from '../components/HeaderBack';
import { useVerifiedPlayers } from '../utils/hooks';
import { calculateDebts } from '../utils/debt';

export function ResultsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentGame, finishGame } = useGame();

  const results = location.state?.results as GameResult[] | undefined;
  const [activeTab, setActiveTab] = useState<'results' | 'debts'>('results');
  const { isVerified } = useVerifiedPlayers();

  const transfers = useMemo(() => {
    if (!results || results.length === 0) return [];
    return calculateDebts(results);
  }, [results]);

  if (!currentGame || !results || results.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">Нет данных</h1>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          На главную
        </button>
      </div>
    );
  }

  const handleFinish = async () => {
    if (!results) return;
    try {
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
      navigate('/');
    } catch (err) {
      console.error('Failed to save game:', err);
      alert('Не удалось сохранить игру на сервер. Попробуйте ещё раз.');
    }
  };

  return (
    <div className="page">
      <HeaderBack title="Результат игры" />

      <div className="card">
        <div className="result-tabs">
          <button
            className={`result-tab ${activeTab === 'results' ? 'active' : ''}`}
            onClick={() => setActiveTab('results')}
          >
            📊 Результаты
          </button>
          <button
            className={`result-tab ${activeTab === 'debts' ? 'active' : ''}`}
            onClick={() => setActiveTab('debts')}
          >
            💸 Расчёт
          </button>
        </div>

        {activeTab === 'results' && (
          <>
            <table className="result-table">
              <thead>
                <tr>
                  <th>Игрок</th>
                  <th>Было <span className="text-muted">pts</span></th>
                  <th>Стало <span className="text-muted">pts</span></th>
                  <th>Рубли</th>
                </tr>
              </thead>
              <tbody>
                {results.map(result => {
                  const isPositive = result.rubles > result.spentRubles;
                  const diff = result.rubles - result.spentRubles;
                  const rubleClass = isPositive ? 'result-positive' : 'result-negative';

                  return (
                    <tr key={result.playerId}>
                      <td className="font-semibold">
                        <span className={isVerified(result.playerName) ? 'verified-player' : ''}>
                          {result.playerName}
                        </span>
                      </td>
                      <td>{result.wasChips} pts</td>
                      <td>{result.becameChips} pts</td>
                      <td className={rubleClass}>
                        {result.rubles.toFixed(0)} ₽
                        <span className="diff-text"> ({diff > 0 ? '+' : ''}{diff.toFixed(0)} ₽)</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="font-bold">Итого</td>
                  <td>{results.reduce((sum, r) => sum + r.wasChips, 0)} pts</td>
                  <td>{results.reduce((sum, r) => sum + r.becameChips, 0)} pts</td>
                  <td className={(() => {
                    const diff = results.reduce((sum, r) => sum + r.wasChips, 0) - results.reduce((sum, r) => sum + r.becameChips, 0);
                    return diff === 0 ? 'result-positive' : 'result-negative';
                  })()}>
                    {(() => {
                      const diff = results.reduce((sum, r) => sum + r.wasChips, 0) - results.reduce((sum, r) => sum + r.becameChips, 0);
                      const sign = diff > 0 ? '-' : diff < 0 ? '+' : '';
                      return `${sign}${Math.abs(diff)} pts`;
                    })()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </>
        )}

        {activeTab === 'debts' && (
          <>
            {transfers.length > 0 ? (
              <table className="result-table">
                <thead>
                  <tr>
                    <th>Кто платит</th>
                    <th>Кому</th>
                    <th>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t, i) => (
                    <tr key={i}>
                      <td>
                        <span className={isVerified(t.from) ? 'verified-player' : ''}>{t.from}</span>
                      </td>
                      <td>
                        <span className={isVerified(t.to) ? 'verified-player' : ''}>{t.to}</span>
                      </td>
                      <td className="result-negative">{t.amount} ₽</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">✅</div>
                Никто никому не должен
              </div>
            )}
          </>
        )}
      </div>

      <div className="fixed-actions">
        <button className="btn btn-success" onClick={handleFinish}>
          ✅ Завершить и сохранить
        </button>
      </div>
    </div>
  );
}
