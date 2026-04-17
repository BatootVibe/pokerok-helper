import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadGameHistory, deleteCompletedGame, getUserProfile } from '../utils/storage';
import { CompletedGame } from '../types';
import { HeaderBack } from '../components/HeaderBack';
import { showToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { formatDate, formatTime, formatDuration } from '../utils/date';
import { useVerifiedPlayers } from '../utils/hooks';
import { calculateDebts } from '../utils/debt';

export function HistoryPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<CompletedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);

  // Auth state
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const currentTgId = tgUser ? String(tgUser.id) : null;
  const [isBound, setIsBound] = useState(false);

  useEffect(() => {
    if (currentTgId) {
      getUserProfile().then(profile => setIsBound(!!profile));
    }
  }, [currentTgId]);

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
    try {
      await deleteCompletedGame(id);
      setHistory(prev => prev.filter(g => g.id !== id));
    } catch (err) {
      console.error('Failed to delete game:', err);
      showToast('Не удалось удалить игру с сервера.');
    }
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
            onDelete={() => isBound && handleDeleteGame(game.id)}
            isVerified={isVerified}
            isBound={isBound}
            currentTgId={currentTgId}
          />
        ))
      )}

      {history.length > 0 && isBound && (
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

function GameEntry({ game, isExpanded, onToggle, onDelete, isVerified, isBound, currentTgId }: {
  game: CompletedGame;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  isVerified: (userId?: number) => boolean;
  isBound: boolean;
  currentTgId: string | null;
}) {
  const [activeTab, setActiveTab] = useState<'results' | 'debts'>('results');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const transfers = useMemo(() => calculateDebts(game.players), [game.players]);
  const verifiedNames = useMemo(() => new Set(game.players.filter(p => p.userId).map(p => p.playerName)), [game.players]);
  const isParticipant = currentTgId ? game.players.some(p => String(p.tgId) === currentTgId) : false;

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
            {game.finishedAt && game.date && (
              <> • ⏱ {formatDuration(new Date(game.finishedAt).getTime() - new Date(game.date).getTime())}</>
            )}
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
                <PlayerResult key={player.playerId} player={player} isVerified={isVerified(player.userId)} />
              ))}
            </div>
          )}

          {activeTab === 'debts' && (
            <div className="player-grid">
              {transfers.length > 0 ? (
                transfers.map((t, i) => (
                  <div key={i} className="player-result debt-card">
                    <div className="debt-players">
                      <span className={verifiedNames.has(t.from) ? 'verified-player' : ''}>{t.from}</span>
                      <span className="debt-arrow">→</span>
                      <span className={verifiedNames.has(t.to) ? 'verified-player' : ''}>{t.to}</span>
                    </div>
                    <div className="result-negative debt-amount">{t.amount} ₽</div>
                  </div>
                ))
              ) : (
                <p className="text-muted text-center" style={{ gridColumn: '1 / -1' }}>Никто никому не должен</p>
              )}
            </div>
          )}

          {isBound && isParticipant && (
            <div className="full-width">
              <button className="btn btn-danger btn-small" onClick={() => setShowDeleteConfirm(true)}>
                Удалить запись
              </button>
            </div>
          )}

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
  const diff = player.rubles - player.spentRubles;
  const rubleClass = diff > 0 ? 'result-positive' : diff < 0 ? 'result-negative' : '';

  return (
    <div className="player-result">
      <div className={isVerified ? 'player-result-name verified-player' : 'player-result-name'}>
        {player.playerName}
      </div>
      <div className={rubleClass}>
        {diff > 0 ? '+' : ''}{diff.toFixed(0)} ₽
      </div>
      <div className="player-result-meta">
        BI:{player.buyInQty} / RB:{player.rebuyQty}
      </div>
    </div>
  );
}
