import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';

export function HomePage() {
  const navigate = useNavigate();
  const { currentGame } = useGame();

  const cards = [
    currentGame
      ? { icon: '🃏', title: 'Продолжить', sub: `${currentGame.players.length} игроков`, path: '/table', color: '#e2b714' }
      : { icon: '🎰', title: 'Новая игра', sub: 'Создать стол и начать', path: '/create', color: '#e2b714' },
    { icon: '📅', title: 'Расписание', sub: 'Запланированные игры', path: '/scheduled', color: '#3498db' },
    { icon: '🏆', title: 'История', sub: 'Результаты прошлых игр', path: '/history', color: '#2ecc71' },
    { icon: '⚙️', title: 'Настройки', sub: 'Пресеты фишек', path: '/settings', color: '#9b59b6' },
  ];

  return (
    <div className="page" style={{ justifyContent: 'center', gap: 20 }}>
      <h1 style={{
        textAlign: 'center',
        fontSize: 32,
        fontWeight: 800,
        color: 'var(--accent-gold)',
        textShadow: '0 4px 20px rgba(0,0,0,0.6)',
        marginBottom: 20,
        letterSpacing: '-1px',
      }}>
        😈 PokerOK 😈
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, width: '100%' }}>
        {cards.map((card, i) => (
          <button
            key={card.path}
            onClick={() => navigate(card.path)}
            style={{
              background: i === 0 && currentGame
                ? 'linear-gradient(135deg, rgba(226, 183, 20, 0.2), rgba(226, 183, 20, 0.05))'
                : 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: i === 0 && currentGame
                ? '1px solid rgba(226, 183, 20, 0.4)'
                : '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 20,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              minHeight: 130,
              boxShadow: i === 0 && currentGame
                ? '0 4px 20px rgba(226, 183, 20, 0.2)'
                : 'none',
            }}
          >
            <span style={{ fontSize: 36 }}>{card.icon}</span>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                {card.title}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.2 }}>
                {card.sub}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
