import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserProfile, saveUserProfile, updateUserProfile } from '../utils/storage';
import { HeaderBack } from '../components/HeaderBack';

export function SettingsPage() {
  const navigate = useNavigate();
  const [showBindModal, setShowBindModal] = useState(false);
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [bindName, setBindName] = useState('');
  const [bindError, setBindError] = useState('');
  const [userProfile, setUserProfile] = useState<{ name: string; isAdmin?: boolean } | null>(null);

  useEffect(() => {
    getUserProfile().then(profile => {
      setUserProfile(profile);
      if (!profile || !profile.name) {
        setShowBindModal(true);
      }
    });
  }, []);

  const handleBind = async () => {
    if (!bindName.trim()) return;
    setBindError('');
    const result = await saveUserProfile({ name: bindName.trim() });
    if (result.success) {
      setUserProfile({ name: bindName.trim() });
      setBindName('');
      setShowBindModal(false);
    } else {
      setBindError(result.error || 'Ошибка при привязке');
    }
  };

  const handleUpdateName = async () => {
    if (!bindName.trim()) return;
    setBindError('');
    const result = await updateUserProfile({ name: bindName.trim() });
    if (result.success) {
      setUserProfile({ name: bindName.trim() });
      setBindName('');
      setShowEditNameModal(false);
    } else {
      setBindError(result.error || 'Ошибка при сохранении');
    }
  };

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

      <div
        className="card settings-card settings-telegram"
        onClick={() => !userProfile?.name && setShowBindModal(true)}
      >
        {userProfile?.name ? (
          <>
            <h3 className="mb-4">👤 Профиль</h3>
            <div className="profile-info">
              <span className="profile-name">{userProfile.name}</span>
            </div>
            <div className="mt-12">
              <button
                className="btn btn-secondary btn-small"
                style={{ width: '100%' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setBindName(userProfile.name);
                  setShowEditNameModal(true);
                }}
              >
                ✏️ Изменить имя
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="mb-4">👤 Профиль</h3>
            <p className="text-muted text-sm mb-8">
              Укажите имя, которое будут видеть другие игроки
            </p>
            <span className="settings-link-text">Указать имя →</span>
          </>
        )}
      </div>

      {userProfile?.isAdmin && (
        <div className="card settings-card" onClick={() => navigate('/admin')}>
          <h3 className="mb-4">🛡️ Админ-панель</h3>
          <p className="text-muted text-sm mb-8">
            Управление пользователями, играми, пресетами
          </p>
          <span className="settings-link-text">Открыть →</span>
        </div>
      )}

      {showBindModal && (
        <div className="modal-overlay">
          <div className="card card-modal">
            <h3 className="modal-title">👤 Укажите имя</h3>
            <p className="modal-desc">Это имя будут видеть другие игроки</p>
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
                Сохранить
              </button>
              <button className="btn btn-secondary btn-small" style={{ flex: 1 }} onClick={() => setShowBindModal(false)}>
                Играть как гость
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditNameModal && (
        <div className="modal-overlay">
          <div className="card card-modal">
            <h3 className="modal-title">✏️ Изменить имя</h3>
            <p className="modal-desc">Это изменит ваше имя во всех прошлых играх</p>
            {bindError && <p className="error-text">{bindError}</p>}
            <input
              className="input"
              type="text"
              placeholder="Ваше имя"
              value={bindName}
              onChange={e => { setBindName(e.target.value); setBindError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleUpdateName()}
              autoFocus
            />
            <div className="modal-actions mt-16">
              <button className="btn btn-primary btn-small" style={{ flex: 1 }} onClick={handleUpdateName} disabled={!bindName.trim()}>
                Сохранить
              </button>
              <button className="btn btn-secondary btn-small" style={{ flex: 1 }} onClick={() => setShowEditNameModal(false)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
