import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearGameHistory, getUserProfile, saveUserProfile } from '../utils/storage';
import { HeaderBack } from '../components/HeaderBack';
import { ConfirmModal } from '../components/ConfirmModal';

export function SettingsPage() {
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showBindModal, setShowBindModal] = useState(false);
  const [bindName, setBindName] = useState('');
  const [bindError, setBindError] = useState('');
  const [userProfile, setUserProfile] = useState<{ name: string; tgId: string } | null>(null);

  // Получаем Telegram ID
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const currentTgId = tgUser ? String(tgUser.id) : null;

  // Загружаем профиль при входе
  useEffect(() => {
    if (currentTgId) {
      getUserProfile(currentTgId).then(profile => setUserProfile(profile));
    }
  }, [currentTgId]);

  const handleBind = async () => {
    if (!bindName.trim() || !currentTgId) return;

    setBindError('');
    const result = await saveUserProfile({ name: bindName.trim(), tgId: currentTgId });

    if (result.success) {
      setUserProfile({ name: bindName.trim(), tgId: currentTgId });
      setBindName('');
      setShowBindModal(false);
    } else {
      setBindError(result.error || 'Ошибка при привязке');
    }
  };

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

      <div className="card settings-card settings-telegram" onClick={() => !userProfile && currentTgId && setShowBindModal(true)}>
        {userProfile ? (
          <>
            <h3 className="mb-4">👤 Профиль</h3>
            <div className="profile-info">
              <span className="profile-name">{userProfile.name}</span>
              <span className="profile-id">ID: {userProfile.tgId.slice(-6)}</span>
            </div>
          </>
        ) : (
          <>
            <h3 className="mb-4">🔗 Привязка аккаунта Telegram</h3>
            <p className="text-muted text-sm mb-8">
              {currentTgId ? 'Привяжите аккаунт для синхронизации' : 'Откройте приложение в Telegram'}
            </p>
            <span className="settings-link-text">{currentTgId ? 'Привязать →' : 'Недоступно'}</span>
          </>
        )}
      </div>

      <div className="fixed-actions">
        <button className="btn btn-danger" onClick={() => setShowConfirm(true)}>
          🗑️ Очистить историю
        </button>
      </div>

      {showConfirm && (
        <ConfirmModal
          title="🗑️ Очистить историю?"
          description="Все записи будут удалены безвозвратно."
          danger
          onConfirm={handleClear}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {showBindModal && (
        <div className="modal-overlay">
          <div className="card card-modal">
            <h3 className="modal-title">🔗 Привязка аккаунта</h3>
            <p className="modal-desc">Введите имя, которое будут видеть другие игроки</p>
            {bindError && <p className="error-text">{bindError}</p>}
            <input
              className="input"
              type="text"
              placeholder="Ваше имя (например, Саня)"
              value={bindName}
              onChange={e => { setBindName(e.target.value); setBindError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleBind()}
              autoFocus
            />
            <div className="modal-actions mt-16">
              <button className="btn btn-primary btn-small" style={{ flex: 1 }} onClick={handleBind} disabled={!bindName.trim()}>
                Привязать
              </button>
              <button className="btn btn-secondary btn-small" style={{ flex: 1 }} onClick={() => setShowBindModal(false)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
