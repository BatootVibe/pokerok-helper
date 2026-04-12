import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearGameHistory } from '../utils/storage';
import { HeaderBack } from '../components/HeaderBack';

export function SettingsPage() {
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClear = useCallback(async () => {
    await clearGameHistory();
    setShowConfirm(false);
  }, []);

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

      <div className="fixed-actions">
        <button className="btn btn-danger" onClick={() => setShowConfirm(true)}>
          🗑️ Очистить историю
        </button>
      </div>

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
