import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadGameHistory, getUserProfile } from '../utils/storage';
import { CompletedGame } from '../types';
import { HeaderBack } from '../components/HeaderBack';
import { useVerifiedPlayers } from '../utils/hooks';

interface PlayerStat {
  name: string;
  games: number;
  wins: number;
  losses: number;
  profit: number;
  bestGame: number;
  worstGame: number;
}

export function AnalyticsPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<CompletedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const { isVerified } = useVerifiedPlayers();

  // Auth check
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const currentTgId = tgUser ? String(tgUser.id) : null;
  const [isBound, setIsBound] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (currentTgId) {
      getUserProfile().then(profile => {
        setIsBound(!!profile);
        setAuthChecked(true);
      });
    } else {
      setAuthChecked(true);
    }
  }, [currentTgId]);

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

    let bestSession = { name: '-', amount: 0 };
    let worstSession = { name: '-', amount: 0 };
    const playerMap = new Map<string, PlayerStat>();

    history.forEach(game => {
      game.players.forEach(p => {
        const profit = p.rubles - p.spentRubles;

        if (!playerMap.has(p.playerName)) {
          playerMap.set(p.playerName, { 
            name: p.playerName, 
            games: 0, 
            wins: 0, 
            losses: 0, 
            profit: 0, 
            bestGame: 0, 
            worstGame: 0 
          });
        }
        const ps = playerMap.get(p.playerName)!;
        ps.games++;
        ps.profit += profit;
        if (profit > 0) ps.wins++;
        if (profit < 0) ps.losses++;
        
        if (profit > ps.bestGame) ps.bestGame = profit;
        if (profit < ps.worstGame) ps.worstGame = profit;

        if (profit > bestSession.amount) {
          bestSession = { name: p.playerName, amount: profit };
        }
        if (profit < worstSession.amount) {
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
                <div className="stat-value result-positive">+{stats.bestSession.amount} ₽</div>
                <div className="stat-label">Лучшая ({stats.bestSession.name})</div>
              </div>
              <div className="stat-card">
                <div className="stat-value result-negative">{stats.worstSession.amount} ₽</div>
                <div className="stat-label">Худшая ({stats.worstSession.name})</div>
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
                        <span className={isVerified(p.name) ? 'verified-player' : ''}>{p.name}</span>
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
