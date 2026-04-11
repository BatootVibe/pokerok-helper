import { useNavigate } from 'react-router-dom';
import { ChipCalculatorPage } from './ChipCalculatorPage';

export function SettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <h1 className="page-title">⚙️ Настройки</h1>

      {/* Пресеты фишек */}
      <div className="card">
        <h3 style={{ marginBottom: 4 }}>🎯 Пресеты фишек</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Настройте цвета и номиналы фишек для игр
        </p>
      </div>

      <ChipCalculatorPage embedded />

      <div className="spacer" />
      <button className="btn btn-secondary mt-16" onClick={() => navigate('/')}>
        На главную
      </button>
    </div>
  );
}
