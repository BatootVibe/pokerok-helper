// Storage keys
export const GAMES_KEY = 'poker_games';
export const CURRENT_GAME_ID_KEY = 'poker_current_game_id';
export const LOCAL_HISTORY_KEY = 'poker_game_history';
export const LOCAL_PRESETS_KEY = 'poker_chip_presets';
export const LOCAL_VENUES_KEY = 'poker_venues';
export const LOCAL_SCHEDULED_KEY = 'poker_scheduled_games';
export const CHIP_INPUTS_KEY = 'poker_chip_inputs_';

// Time constants (ms)
export const HOLD_DURATION = 10_000; // 10 seconds for long-press delete
export const HOLD_INTERVAL = 30; // progress update interval
export const NEARBY_GAME_MARGIN = 30 * 60 * 1000; // ±30 minutes
export const API_AUTO_RESET_INTERVAL = 60_000; // auto-reset apiAvailable every 60s

// Game defaults
export const DEFAULT_STARTING_CHIPS = 500;
export const DEFAULT_BUY_IN_RUBLES = 250;
export const DEFAULT_VENUE = 'Не указано';

// Chip form defaults
export const DEFAULT_CHIP_ENTRIES = [
  { color: 'white' as const, nominal: 5 },
  { color: 'red' as const, nominal: 25 },
  { color: 'blue' as const, nominal: 50 },
];
