import { ChipCalculatorPage } from './ChipCalculatorPage';
import { HeaderBack } from '../components/HeaderBack';

export function SettingsPage() {
  return (
    <div className="page">
      <HeaderBack title="Настройки" />

      <div className="card">
        <h3 className="mb-4">🎯 Пресеты фишек</h3>
        <p className="text-muted text-sm mb-12">
          Настройте цвета и номиналы фишек для игр
        </p>
      </div>

      <ChipCalculatorPage embedded />

      <div className="spacer" />
    </div>
  );
}
