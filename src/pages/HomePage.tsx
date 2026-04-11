import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';

export function HomePage() {
  const navigate = useNavigate();
  const { currentGame } = useGame();

  return (
    <div className="page">
      <h1 className="page-title" style={{ fontSize: 28, textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
        😈 PokerOK Helper 😈
      </h1>

      <div className="home-menu">
        {/* Ряд 1: Новая игра */}
        {currentGame ? (
          <button className="home-btn" onClick={() => navigate('/table')}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <span style={{ fontSize: 17, fontWeight: 600 }}>🃏 Продолжить игру 🃏</span>
              <span style={{ fontSize: 12, opacity: 0.6, fontWeight: 400, marginTop: 2 }}>{currentGame.players.length} игроков</span>
            </div>
          </button>
        ) : (
          <button className="home-btn" onClick={() => navigate('/create')}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <span style={{ fontSize: 17, fontWeight: 600 }}>🎰 Новая игра 🎰</span>
              <span style={{ fontSize: 12, opacity: 0.6, fontWeight: 400, marginTop: 2 }}>Создать стол и начать</span>
            </div>
          </button>
        )}

        {/* Ряд 2: Запланированные */}
        <button className="home-btn" onClick={() => navigate('/scheduled')}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <span style={{ fontSize: 17, fontWeight: 600 }}>📅 Запланированные 📅</span>
            <span style={{ fontSize: 12, opacity: 0.6, fontWeight: 400, marginTop: 2 }}>Управление расписанием</span>
          </div>
        </button>

        {/* Ряд 3: История + Настройки */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <button className="home-btn" onClick={() => navigate('/history')} style={{ padding: 16, flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ textAlign: 'center' }}>🏆 История 🏆</span>
          </button>
          <button className="home-btn" onClick={() => navigate('/settings')} style={{ padding: 16, flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ textAlign: 'center' }}>⚙️ Настройки ⚙️</span>
          </button>
        </div>
      </div>
    </div>
  );
}
