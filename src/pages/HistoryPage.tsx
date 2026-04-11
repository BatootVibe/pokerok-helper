import { useState, useEffect, useRef, useCallback } from 'react';
import { loadGameHistory, clearGameHistory, deleteCompletedGame } from '../utils/storage';
import { CompletedGame } from '../types';
import { HeaderBack } from '../components/HeaderBack';
import { formatDate, formatTime } from '../utils/date';
import { HOLD_DURATION, HOLD_INTERVAL } from '../utils/constants';

export function HistoryPage() {
  const [history, setHistory] = useState<CompletedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<number | null>(null);

  const loadHistory = useCallback(() => {
    loadGameHistory()
      .then(games => setHistory(games))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    };
  }, []);

  const startHold = useCallback(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / HOLD_DURATION, 1);
      setHoldProgress(progress);
      if (progress >= 1) {
        clearInterval(interval);
        setShowConfirm(true);
        setHoldProgress(0);
        holdTimerRef.current = null;
      }
    }, HOLD_INTERVAL);
    holdTimerRef.current = interval;
  }, []);

  const releaseHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setHoldProgress(0);
  }, []);

  const handleClearHistory = useCallback(async () => {
    await clearGameHistory();
    setHistory([]);
    setShowConfirm(false);
  }, []);

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
        <HoldToDelete
          startHold={startHold}
          releaseHold={releaseHold}
          holdProgress={holdProgress}
        />
      )}

      {showConfirm && (
        <ConfirmModal
          title="🗑️ Очистить историю?"
          desc="Все записи будут удалены безвозвратно."
          onConfirm={handleClearHistory}
          onCancel={() => setShowConfirm(false)}
        />
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

function HoldToDelete({
  startHold,
  releaseHold,
  holdProgress,
}: {
  startHold: () => void;
  releaseHold: () => void;
  holdProgress: number;
}) {
  const circumference = 2 * Math.PI * 10;
  const offset = circumference * (1 - holdProgress);

  return (
    <div className="hold-to-delete">
      {holdProgress > 0 && (
        <div
          className="hold-progress-bar"
          style={{ width: `${holdProgress * 100}%` }}
        />
      )}
      <button
        className="btn btn-danger"
        onMouseDown={startHold}
        onMouseUp={releaseHold}
        onMouseLeave={releaseHold}
        onTouchStart={startHold}
        onTouchEnd={releaseHold}
        onTouchCancel={releaseHold}
      >
        {holdProgress > 0 ? (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" className="hold-spinner">
              <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" />
              <circle
                cx="12" cy="12" r="10"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="hold-spinner-progress"
              />
            </svg>
            <span className="font-bold">{Math.max(0, Math.ceil((1 - holdProgress) * 10))}</span>
            <span className="text-muted">сек</span>
          </>
        ) : (
          '🗑️ Очистить историю'
        )}
      </button>
    </div>
  );
}

function ConfirmModal({ title, desc, onConfirm, onCancel }: {
  title: string;
  desc: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-overlay">
      <div className="card card-modal">
        <h3 className="modal-title">{title}</h3>
        <p className="modal-desc">{desc}</p>
        <div className="modal-actions">
          <button className="btn btn-danger btn-small" style={{ flex: 1 }} onClick={onConfirm}>
            Удалить
          </button>
          <button className="btn btn-secondary btn-small" style={{ flex: 1 }} onClick={onCancel}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
