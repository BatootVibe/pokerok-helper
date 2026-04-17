import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';

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
    </div>
  );
}
