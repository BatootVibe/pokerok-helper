import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { HeaderHome } from '../components/HeaderBack';

export function GameTablePage() {
  const navigate = useNavigate();
  const { currentGame, addPlayer, incrementRebuy, finishGame } = useGame();
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
    finishGame();
    navigate('/');
  };

  return (
    <div className="page">
      <HeaderHome title="Игровой стол" />

      {/* Игроки */}
      <div className="card">
        <div className="card-header">
          <h3>Игроки</h3>
          <span className="badge">{currentGame.players.length}</span>
        </div>

        {currentGame.players.length > 0 ? (
          <div className="player-grid">
            {currentGame.players.map((player) => (
              <div key={player.id} className="player-card">
                <span className="player-name">{player.name}</span>
                <div className="player-stats-row">
                  <div className="stat-badge">
                    <span className="stat-label">BI</span>
                    <span className="stat-value">1</span>
                  </div>
                  <div className="stat-badge">
                    <span className="stat-label">RB</span>
                    <span className="stat-value">{player.rebuyQty}</span>
                  </div>
                </div>
                <button
                  className="btn btn-primary rebuy-btn"
                  onClick={() => incrementRebuy(player.id)}
                >
                  + Ребай
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-text">Пока нет игроков</p>
        )}
      </div>

      {/* Добавить игрока */}
      <div className="card card-dashed">
        <div className="add-player-form">
          <input
            className="input"
            type="text"
            placeholder="Имя нового игрока"
            value={newPlayerName}
            onChange={e => setNewPlayerName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddPlayer()}
          />
          <button className="btn btn-primary btn-small" onClick={handleAddPlayer}>+</button>
        </div>
      </div>

      <div className="spacer" />

      <button
        className="btn btn-success mt-16 btn-lg"
        onClick={() => navigate('/chips-count')}
      >
        💰 Считаемся
      </button>
      <button
        className="btn btn-danger mt-16 btn-sm"
        onClick={() => setShowConfirm(true)}
      >
        Завершить игру
      </button>

      {/* Модальное окно подтверждения */}
      {showConfirm && (
        <div className="modal-overlay">
          <div className="card card-modal">
            <h3 className="modal-title">⚠️ Завершить игру?</h3>
            <p className="modal-desc">
              Результаты не будут сохранены в историю.
            </p>
            <div className="modal-actions">
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
