import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { HeaderHome } from '../components/HeaderBack';
import { ConfirmModal } from '../components/ConfirmModal';
import { PlayerAutocomplete, Player } from '../components/PlayerAutocomplete';

export function GameTablePage() {
  const navigate = useNavigate();
  const { currentGame, addPlayer, incrementRebuy, finishGame } = useGame();
  const [players, setPlayers] = useState<Player[]>([]);
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

  const handleAddPlayer = (player: Player) => {
    const isDuplicate = currentGame.players.some(p => p.name.toLowerCase() === player.name.toLowerCase());
    if (!isDuplicate && currentGame.players.length < 10) {
      addPlayer(player);
      setPlayers([]);
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
                <span className={player.userId ? 'player-name verified-player' : 'player-name'}>
                  {player.name}
                </span>
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
        <PlayerAutocomplete
          players={players}
          onAddPlayer={handleAddPlayer}
          onRemovePlayer={() => {}}
          showHistoryBtn={false}
        />
      </div>

      <div className="fixed-actions">
        <div className="form-actions">
          <button
            className="btn btn-secondary"
            onClick={() => setShowConfirm(true)}
          >
            Отмена
          </button>
          <button
            className="btn btn-success"
            onClick={() => navigate('/chips-count')}
          >
            Подсчёт
          </button>
        </div>
      </div>

      {/* Модальное окно подтверждения */}
      {showConfirm && (
        <ConfirmModal
          title="⚠️ Завершить игру?"
          description="Результаты не будут сохранены в историю."
          danger
          onConfirm={handleEmergencyFinish}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
