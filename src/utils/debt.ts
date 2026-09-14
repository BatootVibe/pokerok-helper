/**
 * Алгоритм расчёта переводов между игроками.
 * Жадный алгоритм: должники платят кредиторам минимально возможными суммами.
 */

export interface DebtTransfer {
  from: string;
  to: string;
  amount: number;
}

interface Balance {
  name: string;
  amount: number;
}

/**
 * Рассчитывает оптимальные переводы для урегулирования долгов.
 * @param players Массив игроков с полями rubles и spentRubles
 * @returns Массив переводов { from, to, amount }
 */
export function calculateDebts(
  players: { playerName: string; rubles: number; spentRubles: number }[]
): DebtTransfer[] {
  const balances: Balance[] = players
    .map(p => ({ name: p.playerName, amount: Math.round(p.rubles - p.spentRubles) }))
    .filter(b => b.amount !== 0);

  const debtors = balances
    .filter(b => b.amount < 0)
    .map(b => ({ name: b.name, amount: -b.amount }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = balances
    .filter(b => b.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const transfers: DebtTransfer[] = [];
  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    if (amount > 0) {
      transfers.push({ from: debtors[i].name, to: creditors[j].name, amount });
    }
    debtors[i].amount -= amount;
    creditors[j].amount -= amount;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }

  return transfers;
}
