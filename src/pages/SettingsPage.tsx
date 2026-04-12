import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearGameHistory } from '../utils/storage';
import { HeaderBack } from '../components/HeaderBack';
import { HOLD_DURATION, HOLD_INTERVAL } from '../utils/constants';

export function SettingsPage() {
  const navigate = useNavigate();
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const startHold = useCallback(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / HOLD_DURATION, 1);
      setHoldProgress(progress);
      if (progress >= 1) {
        clearInterval(interval);
        holdTimerRef.current = null;
        setShowConfirm(true);
        setHoldProgress(0);
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

  const handleClear = useCallback(async () => {
    await clearGameHistory();
    setShowConfirm(false);
  }, []);

  const circumference = 2 * Math.PI * 10;
  const offset = circumference * (1 - holdProgress);
  const seconds = Math.max(0, Math.ceil((1 - holdProgress) * 10));

  return (
    <div className="page">
      <HeaderBack title="Настройки" />

      <div className="card settings-card" onClick={() => navigate('/presets')}>
        <h3 className="mb-4">🎯 Пресеты фишек</h3>
        <p className="text-muted text-sm mb-8">
          Настройте цвета и номиналы фишек для игр
        </p>
        <span className="settings-link-text">Открыть →</span>
      </div>

      <div className="card settings-card settings-telegram">
        <h3 className="mb-4">🔗 Привязка аккаунта Telegram</h3>
        <p className="text-muted text-sm mb-8">
          Привяжите Telegram для синхронизации данных
        </p>
        <span className="settings-link-text">Привязать →</span>
      </div>

      <div className="spacer" />

      <ClearHistoryCard
        startHold={startHold}
        releaseHold={releaseHold}
        holdProgress={holdProgress}
        circumference={circumference}
        offset={offset}
        seconds={seconds}
      />

      {showConfirm && (
        <div className="modal-overlay">
          <div className="card card-modal">
            <h3 className="modal-title">🗑️ Очистить историю?</h3>
            <p className="modal-desc">Все записи будут удалены безвозвратно.</p>
            <div className="modal-actions">
              <button className="btn btn-danger btn-small" style={{ flex: 1 }} onClick={handleClear}>
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

function ClearHistoryCard({ startHold, releaseHold, holdProgress, circumference, offset, seconds }: {
  startHold: () => void;
  releaseHold: () => void;
  holdProgress: number;
  circumference: number;
  offset: number;
  seconds: number;
}) {
  return (
    <div className="hold-to-delete">
      {holdProgress > 0 && (
        <div
          className="hold-progress-bar"
          style={{ width: `${holdProgress * 100}%` }}
        />
      )}
      <button
        className="btn btn-danger hold-btn"
        onMouseDown={startHold}
        onMouseUp={releaseHold}
        onMouseLeave={releaseHold}
        onTouchStart={startHold}
        onTouchEnd={releaseHold}
        onTouchCancel={releaseHold}
      >
        {holdProgress > 0 ? (
          <span className="hold-btn-content">
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
            <span className="font-bold">{seconds}</span>
            <span className="text-muted">сек</span>
          </span>
        ) : (
          <span className="hold-btn-content">🗑️ Очистить историю</span>
        )}
      </button>
    </div>
  );
}
