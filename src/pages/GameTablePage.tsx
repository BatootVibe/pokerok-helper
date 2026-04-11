import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';

export function GameTablePage() {
  const navigate = useNavigate();
  const { currentGame, addPlayer, incrementRebuy, removePlayer, finishGame } = useGame();
  const [newPlayerName, setNewPlayerName] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  if (!currentGame) {
    return (
      <div className="page">
        <h1 className="page-title">Игра не найдена</h1>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          На главную
        </button>
      </div>
    );
  }

  const handleAddPlayer = () => {
    const name = newPlayerName.trim();
    if (name) {
      addPlayer(name);
      setNewPlayerName('');
    }
  };

  const handleEmergencyFinish = () => {
    if (!currentGame) return;
    const games = JSON.parse(localStorage.getItem('poker_games') || '{}');
    delete games[currentGame.id];
    localStorage.setItem('poker_games', JSON.stringify(games));
    localStorage.removeItem('poker_current_game_id');
    finishGame();
    navigate('/');
  };

  return (
    <div className="page">
      <h1 className="page-title">🃏 Игровой стол</h1>

      {/* Игроки */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3>Игроки</h3>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.1)', padding: '2px 10px', borderRadius: 12 }}>
            {currentGame.players.length}
          </span>
        </div>

        {currentGame.players.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {currentGame.players.map((player) => (
              <div key={player.id} className="player-row" style={{
                flexDirection: 'column',
                alignItems: 'stretch',
                padding: '10px 12px',
                margin: 0,
                gap: 6,
              }}>
                <span className="player-name" style={{ fontSize: 14 }}>{player.name}</span>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>BI</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>1</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>RB</span>
                    <span style={{ fontSize: 14, fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{player.rebuyQty}</span>
                    <button
                      className="btn btn-primary btn-icon btn-small"
                      style={{ width: 26, height: 26, fontSize: 16 }}
                      onClick={() => incrementRebuy(player.id)}
                    >
                      +
                    </button>
                  </div>
                  <button
                    className="btn btn-danger btn-icon btn-small"
                    style={{ width: 26, height: 26, fontSize: 14 }}
                    onClick={() => removePlayer(player.id)}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, marginTop: 8 }}>
            Пока нет игроков
          </p>
        )}
      </div>

      {/* Добавить игрока */}
      <div className="card" style={{ background: 'rgba(255, 255, 255, 0.03)', borderStyle: 'dashed', opacity: 0.8 }}>
        <div className="add-player-form" style={{ marginBottom: 0 }}>
          <input
            className="input"
            type="text"
            placeholder="Имя нового игрока"
            value={newPlayerName}
            onChange={e => setNewPlayerName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddPlayer()}
          />
          <button className="btn btn-primary btn-small" onClick={handleAddPlayer}>
            +
          </button>
        </div>
      </div>

      <div className="spacer" />

      <button
        className="btn btn-success mt-16"
        onClick={() => navigate('/finish')}
        style={{ fontSize: 17, padding: '16px 24px' }}
      >
        💰 Считаемся
      </button>
      <button
        className="btn btn-secondary mt-16"
        onClick={() => navigate('/')}
      >
        На главную
      </button>
      <button
        className="btn btn-danger mt-16"
        style={{ fontSize: 13, padding: '12px 24px', opacity: 0.8 }}
        onClick={() => setShowConfirm(true)}
      >
        Завершить игру
      </button>

      {/* Модальное окно подтверждения */}
      {showConfirm && (
        <div className="modal-overlay">
          <div className="card" style={{ maxWidth: 360, width: '100%', animation: 'slideUp 0.3s ease' }}>
            <h3 style={{ marginBottom: 12, textAlign: 'center' }}>⚠️ Завершить игру?</h3>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: 20 }}>
              Результаты не будут сохранены в историю.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-danger btn-small" style={{ flex: 1 }} onClick={handleEmergencyFinish}>
                Завершить
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
