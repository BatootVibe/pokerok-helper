import { useLocation, useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { addCompletedGame } from '../utils/storage';
import { CompletedGame, GameResult } from '../types';
import { HeaderBack } from '../components/HeaderBack';

export function ResultsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentGame, finishGame } = useGame();

  const results: GameResult[] = location.state?.results || [];

  if (!currentGame || results.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">Нет данных</h1>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          На главную
        </button>
      </div>
    );
  }

  const handleFinish = async () => {
    const completedGame: CompletedGame = {
      id: currentGame.id,
      date: currentGame.date,
      finishedAt: new Date().toISOString(),
      venue: currentGame.venue || 'Не указано',
      players: results,
      startingChips: currentGame.startingChips,
      buyInRubles: currentGame.buyInRubles,
      chipPriceRubles: currentGame.chipPriceRubles,
    };

    await addCompletedGame(completedGame);
    finishGame();
    navigate('/');
  };

  return (
    <div className="page">
      <HeaderBack title="Таблица игроков" />

      <div className="card">
        <h3 className="card-title-center">📊 Результаты</h3>
        <table className="result-table">
          <thead>
            <tr>
              <th>Игрок</th>
              <th>Было</th>
              <th>Стало</th>
              <th>Рубли</th>
            </tr>
          </thead>
          <tbody>
            {results.map(result => {
              const isPositive = result.rubles > result.spentRubles;
              const diff = result.rubles - result.spentRubles;
              const rubleClass = isPositive ? 'result-positive' : 'result-negative';

              return (
                <tr key={result.playerId}>
                  <td className="font-semibold">{result.playerName}</td>
                  <td>{result.wasChips}</td>
                  <td>{result.becameChips}</td>
                  <td className={rubleClass}>
                    {result.rubles.toFixed(0)} ₽
                    <span className="diff-text"> ({diff > 0 ? '+' : ''}{diff.toFixed(0)} ₽)</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button className="btn btn-success mt-16 btn-lg" onClick={handleFinish}>
        ✅ Завершить и сохранить
      </button>
    </div>
  );
}
