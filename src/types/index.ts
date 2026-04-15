export type ChipColor =
  | 'white'
  | 'red'
  | 'blue'
  | 'green'
  | 'black'
  | 'purple'
  | 'yellow'
  | 'pink'
  | 'gray';

export const CHIP_COLOR_MAP: Record<ChipColor, string> = {
  white: '#ffffff',
  red: '#e74c3c',
  blue: '#3498db',
  green: '#2ecc71',
  black: '#2c3e50',
  purple: '#9b59b6',
  yellow: '#f1c40f',
  pink: '#e91e8a',
  gray: '#95a5a6',
};

export const CHIP_COLOR_LABELS: Record<ChipColor, string> = {
  white: 'Белый',
  red: 'Красный',
  blue: 'Синий',
  green: 'Зелёный',
  black: 'Чёрный',
  purple: 'Фиолетовый',
  yellow: 'Жёлтый',
  pink: 'Розовый',
  gray: 'Серый',
};

export interface ChipEntry {
  color: ChipColor;
  nominal: number;
}

export interface ChipPreset {
  id: string;
  name: string;
  chips: ChipEntry[];
}

export interface GamePlayer {
  id: string;
  name: string;
  userId?: number; // внутренний ID пользователя
  rebuyQty: number; // количество ребай
}

export interface Game {
  id: string;
  date: string;
  players: GamePlayer[];
  startingChips: number; // стартовые очки
  buyInRubles: number; // Buy-in в рублях
  chipPriceRubles: number; // цена 1 очка в рублях
  chipPresetId: string | null; // выбранный пресет фишек
  venue: string; // место проведения
  finishedAt?: string;
  results?: GameResult[];
}

export interface GameResult {
  playerId: string;
  playerName: string;
  userId?: number; // внутренний ID пользователя на момент сохранения результата
  buyInQty: number; // количество бай-инов (всегда 1)
  rebuyQty: number; // количество ребай
  wasChips: number; // Было: стартовые × (buyInQty + rebuyQty)
  becameChips: number; // Стало: Σ(фишки × номинал)
  rubles: number; // Стало × цена_очка
  spentRubles: number; // Buy-in × (buyInQty + rebuyQty)
}

export interface CompletedGame {
  id: string;
  date: string;
  finishedAt: string;
  venue: string;
  players: GameResult[];
  startingChips: number;
  buyInRubles: number;
  chipPriceRubles: number;
}

export interface FinishedPlayerChips {
  playerId: string;
  white: number;
  red: number;
  blue: number;
  green: number;
  black: number;
}

export interface ScheduledGame {
  id: string;
  venue: string;
  scheduledAt: string; // ISO дата/время
  players: string[]; // имена игроков
  createdAt: string;
}
