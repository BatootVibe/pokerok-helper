import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';

interface HomeCard {
  icon: string;
  title: string;
  sub: string;
  path: string;
  highlight?: boolean;
}

export function HomePage() {
  const navigate = useNavigate();
  const { currentGame } = useGame();

  const cards: HomeCard[] = currentGame
    ? [
        { icon: '🃏', title: 'Продолжить', sub: `${currentGame.players.length} игроков`, path: '/table', highlight: true },
        { icon: '📅', title: 'Расписание', sub: 'Запланированные игры', path: '/scheduled' },
        { icon: '🏆', title: 'История', sub: '', path: '/history' },
        { icon: '⚙️', title: 'Настройки', sub: '', path: '/settings' },
      ]
    : [
        { icon: '🎰', title: 'Новая игра', sub: 'Создать стол и начать', path: '/create', highlight: true },
        { icon: '📅', title: 'Расписание', sub: 'Запланированные игры', path: '/scheduled' },
        { icon: '🏆', title: 'История', sub: '', path: '/history' },
        { icon: '⚙️', title: 'Настройки', sub: '', path: '/settings' },
      ];

  return (
    <div className="page page-center">
      <h1 className="app-title">😈 PokerOK 😈</h1>

      <div className="home-grid">
        {cards.map(card => (
          <button
            key={card.path}
            className={`home-card ${card.highlight ? 'highlighted' : ''}`}
            onClick={() => navigate(card.path)}
          >
            <span className="home-card-icon">{card.icon}</span>
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
