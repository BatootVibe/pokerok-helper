import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { getUserProfile, saveUserProfile } from '../utils/storage';

interface HomeCard {
  iconImg: string;
  title: string;
  sub: string;
  path: string;
  highlight?: boolean;
}

export function HomePage() {
  const navigate = useNavigate();
  const { currentGame, isOwner } = useGame();
  const [showBindModal, setShowBindModal] = useState(false);
  const [bindName, setBindName] = useState('');
  const [bindError, setBindError] = useState('');

  useEffect(() => {
    getUserProfile().then(profile => {
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
      setBindName('');
      setShowBindModal(false);
    } else {
      setBindError(result.error || 'Ошибка при привязке');
    }
  };

  const continueSub = currentGame
    ? isOwner
      ? `${currentGame.players.length} игроков`
      : `Участник · ${currentGame.players.length} игроков`
    : '';

  const cards: HomeCard[] = currentGame
    ? [
        { iconImg: 'continue.png', title: 'Продолжить', sub: continueSub, path: '/table', highlight: true },
        { iconImg: 'schedule.png', title: 'Расписание', sub: 'Запланированные игры', path: '/scheduled' },
        { iconImg: 'history.png', title: 'История', sub: '', path: '/history' },
        { iconImg: 'settings.png', title: 'Настройки', sub: '', path: '/settings' },
      ]
    : [
        { iconImg: 'new-game.png', title: 'Новая игра', sub: 'Создать стол и начать', path: '/create', highlight: true },
        { iconImg: 'schedule.png', title: 'Расписание', sub: 'Запланированные игры', path: '/scheduled' },
        { iconImg: 'history.png', title: 'История', sub: '', path: '/history' },
        { iconImg: 'settings.png', title: 'Настройки', sub: '', path: '/settings' },
      ];

  return (
    <div className="page page-center">
      <h1 className="app-title">
        <img src="/logo.png" alt="Logo" className="app-logo" />
        PokerOK Helper
        <img src="/logo.png" alt="Logo" className="app-logo app-logo-flipped" />
      </h1>

      <div className="home-grid">
        {cards.map(card => (
          <button
            key={card.path}
            className={`home-card ${card.highlight ? 'highlighted' : ''}`}
            onClick={() => navigate(card.path)}
          >
            <img src={`/${card.iconImg}`} alt={card.title} className="home-card-icon-img" />
            <div className="home-card-text">
              <div className="home-card-title">{card.title}</div>
              {card.sub && <div className="home-card-sub">{card.sub}</div>}
            </div>
          </button>
        ))}
      </div>

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
    </div>
  );
}
