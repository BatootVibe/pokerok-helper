import { useNavigate } from 'react-router-dom';
import { loadGameHistory, clearGameHistory } from '../utils/storage';
import { CompletedGame } from '../types';
import { useState, useEffect, useRef } from 'react';

export function HistoryPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<CompletedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<number | null>(null);
  const HOLD_DURATION = 10000; // 10 секунд

  useEffect(() => {
    loadGameHistory()
      .then(games => setHistory(games))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    };
  }, []);

  const startHold = () => {
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
    }, 30);
    holdTimerRef.current = interval;
  };

  const releaseHold = () => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setHoldProgress(0);
  };

  const formatTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const handleClearHistory = async () => {
    await clearGameHistory();
    setHistory([]);
    setShowConfirm(false);
  };

  const toggleGame = (id: string) => {
    setExpandedGameId(prev => prev === id ? null : id);
  };

  return (
    <div className="page">
      <h1 className="page-title" style={{ marginBottom: 16, fontSize: 20 }}>История</h1>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Загрузка...</div>
      ) : history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎰</div>
          Пока нет завершённых игр
        </div>
      ) : (
        history.map(game => {
          const isExpanded = expandedGameId === game.id;
          return (
            <div key={game.id} style={{ marginBottom: 8 }}>
              <div
                style={{
                  background: isExpanded ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                onClick={() => toggleGame(game.id)}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{formatDate(game.date)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.6, marginTop: 2 }}>
                    {formatTime(game.date)} → {formatTime(game.finishedAt)}
                    {game.venue && ` • 📍 ${game.venue}`}
                  </div>
                </div>
                <span style={{ fontSize: 16, opacity: 0.5, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                  ▼
                </span>
              </div>
              {isExpanded && (
                <div style={{
                  padding: '8px 4px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 6,
                }}>
                  {game.players.map(player => {
                    const isZero = player.becameChips === 0;
                    const displayRubles = isZero ? -player.spentRubles : player.rubles;
                    const isPositive = player.rubles > player.spentRubles;
                    const diff = player.rubles - player.spentRubles;
                    const rubleClass = isPositive ? 'result-positive' : 'result-negative';

                    return (
                      <div key={player.playerId} style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.04)',
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{player.playerName}</div>
                        <div className={rubleClass} style={{ fontSize: 15, fontWeight: 700 }}>
                          {displayRubles.toFixed(0)} ₽
                          {!isZero && <span> ({diff > 0 ? '+' : ''}{diff.toFixed(0)} ₽)</span>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.6, marginTop: 2 }}>
                          BI:{player.buyInQty} / RB:{player.rebuyQty}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

      <div className="spacer" />

      {history.length > 0 && (
        <div style={{ position: 'relative', overflow: 'hidden', marginTop: 24 }}>
          {holdProgress > 0 && (
            <div style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(to right, rgba(255,71,87,0.3) ${holdProgress * 100}%, transparent ${holdProgress * 100}%)`,
              pointerEvents: 'none',
            }} />
          )}
          <button
            className="btn btn-danger"
            style={{
              position: 'relative',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            onMouseDown={startHold}
            onMouseUp={releaseHold}
            onMouseLeave={releaseHold}
            onTouchStart={startHold}
            onTouchEnd={releaseHold}
            onTouchCancel={releaseHold}
          >
            {holdProgress > 0 ? (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" />
                  <circle
                    cx="12" cy="12" r="10"
                    fill="none"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeDasharray={`${2 * Math.PI * 10}`}
                    strokeDashoffset={`${2 * Math.PI * 10 * (1 - holdProgress)}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.03s linear' }}
                  />
                </svg>
                <span style={{ fontWeight: 700 }}>{Math.max(0, Math.ceil((1 - holdProgress) * 10))}</span>
                <span style={{ opacity: 0.7, fontSize: 13 }}>сек</span>
              </>
            ) : (
              '🗑️ Очистить историю'
            )}
          </button>
        </div>
      )}
      <button className="btn btn-secondary mt-16" onClick={() => navigate('/')}>
        На главную
      </button>

      {/* Модальное окно подтверждения */}
      {showConfirm && (
        <div className="modal-overlay">
          <div className="card" style={{ maxWidth: 360, width: '100%', animation: 'slideUp 0.3s ease' }}>
            <h3 style={{ marginBottom: 12, textAlign: 'center' }}>🗑️ Очистить историю?</h3>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: 20 }}>
              Все записи будут удалены безвозвратно.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-danger btn-small" style={{ flex: 1 }} onClick={handleClearHistory}>
                Удалить
              </button>
              <button className="btn btn-secondary btn-small" style={{ flex: 1 }} onClick={() => setShowConfirm(false)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
