import { ChipCalculatorPage } from './ChipCalculatorPage';
import { HeaderBack } from '../components/HeaderBack';

export function SettingsPage() {
  return (
    <div className="page">
      <HeaderBack title="Настройки" />

      {/* Пресеты фишек */}
      <div className="card">
        <h3 style={{ marginBottom: 4 }}>🎯 Пресеты фишек</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Настройте цвета и номиналы фишек для игр
        </p>
      </div>

      <ChipCalculatorPage embedded />

      <div className="spacer" />
    </div>
  );
}
