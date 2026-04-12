import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadGameHistory, deleteCompletedGame } from '../utils/storage';
import { CompletedGame } from '../types';
import { HeaderBack } from '../components/HeaderBack';
import { formatDate, formatTime } from '../utils/date';

export function HistoryPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<CompletedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);

  const loadHistory = useCallback(() => {
    loadGameHistory()
      .then(games => setHistory(games))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleDeleteGame = useCallback(async (id: string) => {
    await deleteCompletedGame(id);
    setHistory(prev => prev.filter(g => g.id !== id));
  }, []);

  const toggleGame = useCallback((id: string) => {
    setExpandedGameId(prev => prev === id ? null : id);
  }, []);

  return (
    <div className="page">
      <HeaderBack title="История" />

      {loading ? (
        <div className="loading-text">Загрузка...</div>
      ) : history.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎰</div>
          Пока нет завершённых игр
        </div>
      ) : (
        history.map(game => (
          <GameEntry
            key={game.id}
            game={game}
            isExpanded={expandedGameId === game.id}
            onToggle={() => toggleGame(game.id)}
            onDelete={() => handleDeleteGame(game.id)}
          />
        ))
      )}

      <div className="spacer" />

      {history.length > 0 && (
        <button
          className="btn btn-secondary"
          onClick={() => navigate('/analytics')}
        >
          📊 Аналитика
        </button>
      )}
    </div>
  );
}

// === Sub-components ===

function GameEntry({ game, isExpanded, onToggle, onDelete }: {
  game: CompletedGame;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="history-entry">
      <div
        className={`history-header ${isExpanded ? 'expanded' : ''}`}
        onClick={onToggle}
      >
        <div>
          <div className="history-date">{formatDate(game.date)}</div>
          <div className="history-time text-muted">
            {formatTime(game.date)} → {formatTime(game.finishedAt)}
            {game.venue && ` • 📍 ${game.venue}`}
          </div>
        </div>
        <span className={`expand-arrow ${isExpanded ? 'rotated' : ''}`}>▼</span>
      </div>
      {isExpanded && (
        <div className="history-details">
          {game.players.map(player => (
            <PlayerResult key={player.playerId} player={player} />
          ))}
          <button className="btn btn-danger btn-small mt-8" onClick={onDelete}>
            Удалить запись
          </button>
        </div>
      )}
    </div>
  );
}

function PlayerResult({ player }: { player: CompletedGame['players'][number] }) {
  const isZero = player.becameChips === 0;
  const displayRubles = isZero ? -player.spentRubles : player.rubles;
  const isPositive = player.rubles > player.spentRubles;
  const diff = player.rubles - player.spentRubles;
  const rubleClass = isPositive ? 'result-positive' : 'result-negative';

  return (
    <div className="player-result">
      <div className="player-result-name">{player.playerName}</div>
      <div className={rubleClass}>
        {displayRubles.toFixed(0)} ₽
        {!isZero && <span> ({diff > 0 ? '+' : ''}{diff.toFixed(0)} ₽)</span>}
      </div>
      <div className="player-result-meta">
        BI:{player.buyInQty} / RB:{player.rebuyQty}
      </div>
    </div>
  );
}
