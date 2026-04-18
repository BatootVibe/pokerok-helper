import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadGameHistory } from '../utils/storage';
import { CompletedGame } from '../types';
import { HeaderBack } from '../components/HeaderBack';
import { useBoundStatus } from '../utils/hooks';

interface PlayerStat {
  name: string;
  games: number;
  wins: number;
  losses: number;
  profit: number;
  bestGame: number;
  worstGame: number;
}

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<CompletedGame[]>([]);
  const [loading, setLoading] = useState(true);

  const { isBound } = useBoundStatus();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    setAuthChecked(true);
  }, [isBound]);

  useEffect(() => {
    if (!authChecked) return;
    if (!isBound) {
      navigate('/');
      return;
    }
    loadGameHistory()
      .then(games => setHistory(games))
      .finally(() => setLoading(false));
  }, [authChecked, isBound, navigate]);

  const stats = useMemo(() => {
    const totalGames = history.length;
    const totalMoney = history.reduce(
      (sum, g) => sum + g.players.reduce((s, p) => s + p.spentRubles, 0),
      0
    );

    let bestSession: { name: string; amount: number } | null = null;
    let worstSession: { name: string; amount: number } | null = null;
    const playerMap = new Map<string, PlayerStat>();

    history.forEach(game => {
      game.players.filter(p => p.userId).forEach(p => {
        const profit = p.rubles - p.spentRubles;

        if (!playerMap.has(p.playerName)) {
          playerMap.set(p.playerName, { 
            name: p.playerName, 
            games: 0, 
            wins: 0, 
            losses: 0, 
            profit: 0, 
            bestGame: profit, 
            worstGame: profit 
          });
        }
        const ps = playerMap.get(p.playerName)!;
        ps.games++;
        ps.profit += profit;
        if (profit > 0) ps.wins++;
        if (profit < 0) ps.losses++;
        
        if (profit > ps.bestGame) ps.bestGame = profit;
        if (profit < ps.worstGame) ps.worstGame = profit;

        if (!bestSession || profit > bestSession.amount) {
          bestSession = { name: p.playerName, amount: profit };
        }
        if (!worstSession || profit < worstSession.amount) {
          worstSession = { name: p.playerName, amount: profit };
        }
      });
    });

    const topPlayers = Array.from(playerMap.values()).sort((a, b) => b.profit - a.profit);

    return { totalGames, totalMoney, bestSession, worstSession, topPlayers };
  }, [history]);

  const formatMoney = (val: number) => (val > 0 ? '+' : '') + val.toFixed(0) + ' ₽';

  return (
    <div className="page">
      <HeaderBack title="Аналитика" />

      {loading ? (
        <div className="loading-text">Загрузка...</div>
      ) : history.length === 0 ? (
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
                <div className="stat-value">{stats.totalGames}</div>
                <div className="stat-label">Игр</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.totalMoney.toLocaleString()} ₽</div>
                <div className="stat-label">Объём</div>
              </div>
              <div className="stat-card">
                <div className="stat-value result-positive">{stats.bestSession ? `+${stats.bestSession.amount} ₽` : '—'}</div>
                <div className="stat-label">Лучшая ({stats.bestSession?.name ?? '—'})</div>
              </div>
              <div className="stat-card">
                <div className="stat-value result-negative">{stats.worstSession ? `${stats.worstSession.amount} ₽` : '—'}</div>
                <div className="stat-label">Худшая ({stats.worstSession?.name ?? '—'})</div>
              </div>
            </div>
          </div>

          <div className="card analytics-table-card">
            <h3 className="card-title-center">👥 Статистика игроков</h3>
            <div className="analytics-table-wrapper">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Имя</th>
                    <th>Игр</th>
                    <th>W/L</th>
                    <th>Макс</th>
                    <th>Мин</th>
                    <th>Итог</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topPlayers.map(p => (
                    <tr key={p.name}>
                      <td className="player-cell">
                        <span>{p.name}</span>
                      </td>
                      <td>{p.games}</td>
                      <td className="wl-cell">{p.wins}/{p.losses}</td>
                      <td className="result-positive">+{p.bestGame} ₽</td>
                      <td className="result-negative">{p.worstGame} ₽</td>
                      <td className={p.profit >= 0 ? 'result-positive' : 'result-negative'}>
                        {formatMoney(p.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="spacer" />
    </div>
  );
}
