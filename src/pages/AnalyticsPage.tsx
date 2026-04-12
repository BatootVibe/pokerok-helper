import { useEffect, useState } from 'react';
import { loadGameHistory } from '../utils/storage';
import { CompletedGame } from '../types';
import { HeaderBack } from '../components/HeaderBack';

export function AnalyticsPage() {
  const [history, setHistory] = useState<CompletedGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGameHistory()
      .then(games => setHistory(games))
      .finally(() => setLoading(false));
  }, []);

  const totalGames = history.length;
  const totalPlayers = history.reduce((sum, g) => sum + g.players.length, 0);
  const avgPlayers = totalGames > 0 ? (totalPlayers / totalGames).toFixed(1) : '0';

  const allResults = history.flatMap(g => g.players);
  const totalRubles = allResults.reduce((sum, p) => sum + p.rubles - p.spentRubles, 0);

  const bestPlayer = allResults.length > 0
    ? allResults.reduce((best, p) => {
        const diff = p.rubles - p.spentRubles;
        const bestDiff = best.rubles - best.spentRubles;
        return diff > bestDiff ? p : best;
      })
    : null;

  const playerStats: Record<string, { name: string; games: number; profit: number }> = {};
  allResults.forEach(p => {
    if (!playerStats[p.playerId]) {
      playerStats[p.playerId] = { name: p.playerName, games: 0, profit: 0 };
    }
    playerStats[p.playerId].games++;
    playerStats[p.playerId].profit += p.rubles - p.spentRubles;
  });

  const topPlayers = Object.values(playerStats)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  return (
    <div className="page">
      <HeaderBack title="Аналитика" />

      {loading ? (
        <div className="loading-text">Загрузка...</div>
      ) : totalGames === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <p className="text-muted">Нет данных для аналитики</p>
        </div>
      ) : (
        <>
          <div className="card">
            <h3 className="card-title-center">📈 Общая статистика</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{totalGames}</div>
                <div className="stat-label">Игр</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{avgPlayers}</div>
                <div className="stat-label">Среднее игроков</div>
              </div>
              <div className="stat-card">
                <div className={`stat-value ${totalRubles >= 0 ? 'result-positive' : 'result-negative'}`}>
                  {totalRubles > 0 ? '+' : ''}{totalRubles.toFixed(0)} ₽
                </div>
                <div className="stat-label">Общий баланс</div>
              </div>
            </div>
          </div>

          {bestPlayer && (
            <div className="card">
              <h3 className="card-title-center">🏆 Лучший результат</h3>
              <div className="best-result">
                <span className="best-name">{bestPlayer.playerName}</span>
                <span className={`best-profit ${bestPlayer.rubles - bestPlayer.spentRubles >= 0 ? 'result-positive' : 'result-negative'}`}>
                  {bestPlayer.rubles - bestPlayer.spentRubles > 0 ? '+' : ''}
                  {(bestPlayer.rubles - bestPlayer.spentRubles).toFixed(0)} ₽
                </span>
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="card-title-center">👥 Топ игроков</h3>
            {topPlayers.map((p, i) => (
              <div key={`${p.name}-${i}`} className="top-player-row">
                <span className="top-player-rank">#{i + 1}</span>
                <span className="top-player-name">{p.name}</span>
                <span className={`top-player-profit ${p.profit >= 0 ? 'result-positive' : 'result-negative'}`}>
                  {p.profit > 0 ? '+' : ''}{p.profit.toFixed(0)} ₽
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="spacer" />
    </div>
  );
}
