import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadGameHistory, deleteCompletedGame } from '../utils/storage';
import { CompletedGame } from '../types';
import { HeaderBack } from '../components/HeaderBack';
import { ConfirmModal } from '../components/ConfirmModal';
import { formatDate, formatTime } from '../utils/date';
import { useVerifiedPlayers } from '../utils/hooks';
import { calculateDebts } from '../utils/debt';

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

  // Загружаем верификацию один раз на уровне страницы
  const { isVerified } = useVerifiedPlayers();

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
            isVerified={isVerified}
          />
        ))
      )}

      {history.length > 0 && (
        <div className="fixed-actions">
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/analytics')}
          >
            📊 Аналитика
          </button>
        </div>
      )}
    </div>
  );
}

// === Sub-components ===

function GameEntry({ game, isExpanded, onToggle, onDelete, isVerified }: {
  game: CompletedGame;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  isVerified: (name: string) => boolean;
}) {
  const [activeTab, setActiveTab] = useState<'results' | 'debts'>('results');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const transfers = useMemo(() => calculateDebts(game.players), [game.players]);

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
          <div className="result-tabs">
            <button
              className={`result-tab ${activeTab === 'results' ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setActiveTab('results'); }}
            >
              📊 Результаты
            </button>
            <button
              className={`result-tab ${activeTab === 'debts' ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setActiveTab('debts'); }}
            >
              💸 Расчёт
            </button>
          </div>

          {activeTab === 'results' && (
            <div className="player-grid">
              {game.players.map(player => (
                <PlayerResult key={player.playerId} player={player} isVerified={isVerified(player.playerName)} />
              ))}
            </div>
          )}

          {activeTab === 'debts' && (
            <div className="player-grid">
              {transfers.length > 0 ? (
                transfers.map((t, i) => (
                  <div key={i} className="player-result debt-card">
                    <div className="debt-players">
                      <span className={isVerified(t.from) ? 'verified-player' : ''}>{t.from}</span>
                      <span className="debt-arrow">→</span>
                      <span className={isVerified(t.to) ? 'verified-player' : ''}>{t.to}</span>
                    </div>
                    <div className="result-negative debt-amount">{t.amount} ₽</div>
                  </div>
                ))
              ) : (
                <p className="text-muted text-center" style={{ gridColumn: '1 / -1' }}>Никто никому не должен</p>
              )}
            </div>
          )}

          <div className="full-width">
            <button className="btn btn-danger btn-small" onClick={() => setShowDeleteConfirm(true)}>
              Удалить запись
            </button>
          </div>

          {showDeleteConfirm && (
            <ConfirmModal
              title="🗑️ Удалить запись?"
              description={`${formatDate(game.date)} • ${game.venue || 'Не указано'}`}
              danger
              onConfirm={() => { onDelete(); setShowDeleteConfirm(false); }}
              onCancel={() => setShowDeleteConfirm(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function PlayerResult({ player, isVerified }: { player: CompletedGame['players'][number]; isVerified: boolean }) {
  const isZero = player.becameChips === 0;
  const displayRubles = isZero ? -player.spentRubles : player.rubles;
  const isPositive = player.rubles > player.spentRubles;
  const diff = player.rubles - player.spentRubles;
  const rubleClass = isPositive ? 'result-positive' : 'result-negative';

  return (
    <div className="player-result">
      <div className={isVerified ? 'player-result-name verified-player' : 'player-result-name'}>
        {player.playerName}
      </div>
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
