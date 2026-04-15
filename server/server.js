import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'poker.db'));

// Включаем WAL mode для лучшей конкурентности
db.pragma('journal_mode = WAL');

// === Настройка БД ===

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_id TEXT NOT NULL UNIQUE,
    player_name TEXT
  );

  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    finished_at TEXT NOT NULL DEFAULT '',
    venue TEXT NOT NULL DEFAULT '',
    owner_user_id INTEGER,
    starting_chips INTEGER NOT NULL,
    buy_in_rubles REAL NOT NULL,
    chip_price_rubles REAL NOT NULL,
    FOREIGN KEY (owner_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS game_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    player_name TEXT NOT NULL,
    user_id INTEGER,
    buy_in_qty INTEGER NOT NULL DEFAULT 1,
    rebuy_qty INTEGER NOT NULL DEFAULT 0,
    was_chips INTEGER NOT NULL,
    became_chips INTEGER NOT NULL,
    rubles REAL NOT NULL,
    spent_rubles REAL NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    chips TEXT NOT NULL,
    owner_user_id INTEGER,
    FOREIGN KEY (owner_user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_results_game ON game_results(game_id);
  CREATE INDEX IF NOT EXISTS idx_results_user ON game_results(user_id);
  CREATE INDEX IF NOT EXISTS idx_games_owner ON games(owner_user_id);

  CREATE TABLE IF NOT EXISTS scheduled_games (
    id TEXT PRIMARY KEY,
    venue TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    players TEXT NOT NULL,
    created_at TEXT NOT NULL,
    owner_user_id INTEGER,
    FOREIGN KEY (owner_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS venues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );
`);

// Миграции для старых БД
try { db.exec('ALTER TABLE games ADD COLUMN owner_user_id INTEGER;'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE presets ADD COLUMN owner_user_id INTEGER;'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE scheduled_games ADD COLUMN owner_user_id INTEGER;'); } catch { /* already exists */ }
try { db.exec('ALTER TABLE game_results ADD COLUMN user_id INTEGER;'); } catch { /* already exists */ }
try { db.exec('CREATE INDEX IF NOT EXISTS idx_results_user ON game_results(user_id);'); } catch { /* already exists */ }

const app = express();

// === CORS: localhost + продакшен домены из окружения ===
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  ...(process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS blocked'));
    }
  },
}));

app.use(express.json({ limit: '1mb' }));

// === Rate Limiting ===

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 120, // макс 120 запросов в минуту
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов. Подождите минуту.' },
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20, // для мутаций — строже
  message: { error: 'Слишком много запросов. Подождите минуту.' },
});

app.use('/api/', apiLimiter);

// === Telegram WebApp Signature Verification ===

/**
 * Проверяет подпись initData от Telegram WebApp.
 * Возвращает распарсенные данные или null если подпись невалидна.
 * Использует constant-time сравнение для защиты от timing-атак.
 */
function verifyTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  params.delete('hash');

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  // Constant-time comparison для защиты от timing-атак
  const hashBuf = Buffer.from(hash, 'hex');
  const calcBuf = Buffer.from(calculatedHash, 'hex');
  if (hashBuf.length !== calcBuf.length || !crypto.timingSafeEqual(hashBuf, calcBuf)) {
    return null;
  }

  const data = {};
  for (const [key, value] of params) {
    try {
      data[key] = JSON.parse(value);
    } catch {
      data[key] = value;
    }
  }
  return data;
}

/**
 * Middleware: проверяет подпись Telegram WebApp и извлекает user_id.
 * Без TELEGRAM_BOT_TOKEN — все запросы заблокированы (500).
 * tgId из body/query НИКОГДА не принимается.
 */
function requireTelegramAuth(req, res, next) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return res.status(500).json({
      error: 'Сервер не настроен. Обратитесь к администратору (TELEGRAM_BOT_TOKEN не установлен).',
    });
  }

  const initData = req.headers['x-telegram-init-data'] || req.body?._initData;
  const verified = verifyTelegramInitData(initData, botToken);

  if (!verified || !verified.user?.id) {
    return res.status(401).json({ error: 'Невалидная подпись Telegram. Обновите приложение.' });
  }

  const tgId = String(verified.user.id);

  // Находим или создаём пользователя, получаем внутренний user_id
  let userRow = db.prepare('SELECT id, tg_id, player_name FROM users WHERE tg_id = ?').get(tgId);
  if (!userRow) {
    // Новый пользователь — создаём запись
    const defaultName = verified.user.username
      || verified.user.first_name
      || `user_${tgId.slice(-6)}`;
    try {
      const result = db.prepare('INSERT INTO users (tg_id, player_name) VALUES (?, ?)').run(tgId, defaultName);
      userRow = { id: result.lastInsertRowid, tg_id: tgId, player_name: defaultName };
    } catch (err) {
      // Race condition: другой запрос уже создал пользователя
      if (err.message.includes('UNIQUE')) {
        userRow = db.prepare('SELECT id, tg_id, player_name FROM users WHERE tg_id = ?').get(tgId);
      } else {
        return res.status(500).json({ error: 'Ошибка создания профиля' });
      }
    }
  }

  req.userId = userRow.id;
  req.tgId = userRow.tg_id;
  req.playerName = userRow.player_name;

  // Убираем служебные поля из body
  if (req.body) {
    const { _initData, tgId: _, ...rest } = req.body;
    req.body = rest;
  }

  next();
}

/**
 * Middleware: проверяет, что пользователь привязан (заполнил имя).
 */
function requireBound(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: 'Требуется авторизация' });

  const user = db.prepare('SELECT id, player_name FROM users WHERE id = ?').get(req.userId);
  if (!user || !user.player_name) {
    return res.status(403).json({ error: 'Привяжите аккаунт в настройках, чтобы выполнять это действие' });
  }

  next();
}

/**
 * Middleware: проверяет, что привязанный игрок участвовал в игре.
 * Разрешает удаление игры только участникам.
 */
function requireGameParticipant(req, res, next) {
  const userId = req.userId;
  const gameId = req.params.id;

  const participant = db.prepare(
    'SELECT 1 FROM game_results WHERE game_id = ? AND user_id = ? LIMIT 1'
  ).get(gameId, userId);

  if (!participant) return res.status(403).json({ error: 'Только участник игры может выполнять это действие' });
  next();
}

// === Validation helpers ===

function validateString(val, name, minLen = 1, maxLen = 100) {
  if (typeof val !== 'string' || val.trim().length < minLen || val.trim().length > maxLen) {
    return `Invalid or missing '${name}'`;
  }
  return null;
}

function validateNumber(val, name, min = 0) {
  if (typeof val !== 'number' || val < min || !Number.isFinite(val)) {
    return `Invalid or missing '${name}'`;
  }
  return null;
}

function validateArray(val, name) {
  if (!Array.isArray(val)) {
    return `'${name}' must be an array`;
  }
  return null;
}

// ===== ИГРЫ =====

app.get('/api/games', (req, res) => {
  const games = db.prepare(`
    SELECT g.*, json_group_array(
      json_object(
        'playerId', r.player_id,
        'playerName', r.player_name,
        'tgId', r.tg_id,
        'buyInQty', r.buy_in_qty,
        'rebuyQty', r.rebuy_qty,
        'wasChips', r.was_chips,
        'becameChips', r.became_chips,
        'rubles', r.rubles,
        'spentRubles', r.spent_rubles
      )
    ) as players
    FROM games g
    JOIN game_results r ON g.id = r.game_id
    GROUP BY g.id
    ORDER BY g.finished_at DESC
  `).all();

  const result = games.map(g => {
    let players;
    try {
      players = JSON.parse(g.players);
    } catch {
      players = [];
    }
    return {
      id: g.id,
      date: g.date,
      finishedAt: g.finished_at,
      venue: g.venue || '',
      startingChips: g.starting_chips,
      buyInRubles: g.buy_in_rubles,
      chipPriceRubles: g.chip_price_rubles,
      players,
    };
  });

  res.json(result);
});

app.post('/api/games', requireTelegramAuth, requireBound, strictLimiter, (req, res) => {
  const { id, date, players, startingChips, buyInRubles, chipPriceRubles, finishedAt, venue } = req.body;
  const ownerUserId = req.userId;

  const err = validateString(id, 'id')
    || validateString(date, 'date')
    || validateArray(players, 'players')
    || validateNumber(startingChips, 'startingChips', 1)
    || validateNumber(buyInRubles, 'buyInRubles', 0)
    || validateNumber(chipPriceRubles, 'chipPriceRubles', 0);

  if (err) return res.status(400).json({ error: err });

  for (const p of players) {
    const playerErr = validateString(p.playerId, 'playerId')
      || validateString(p.playerName, 'playerName')
      || validateNumber(p.buyInQty, 'buyInQty', 0)
      || validateNumber(p.rebuyQty, 'rebuyQty', 0)
      || validateNumber(p.wasChips, 'wasChips', 0)
      || validateNumber(p.becameChips, 'becameChips', 0)
      || validateNumber(p.rubles, 'rubles')
      || validateNumber(p.spentRubles, 'spentRubles', 0);
    if (playerErr) return res.status(400).json({ error: playerErr });
  }

  const insertGame = db.prepare(
    'INSERT OR REPLACE INTO games (id, date, finished_at, venue, owner_user_id, starting_chips, buy_in_rubles, chip_price_rubles) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const insertResult = db.prepare(
    'INSERT INTO game_results (game_id, player_id, player_name, user_id, buy_in_qty, rebuy_qty, was_chips, became_chips, rubles, spent_rubles) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  try {
    const tx = db.transaction(() => {
      insertGame.run(id, date, finishedAt || new Date().toISOString(), venue || '', ownerUserId, startingChips, buyInRubles, chipPriceRubles);
      for (const p of players) {
        insertResult.run(id, p.playerId, p.playerName, p.userId || null, p.buyInQty, p.rebuyQty, p.wasChips, p.becameChips, p.rubles, p.spentRubles);
      }
    });
    tx();
    res.json({ success: true });
  } catch (dbErr) {
    console.error('Failed to save game:', dbErr.message);
    res.status(500).json({ error: 'Ошибка сохранения игры' });
  }
});

app.delete('/api/games/:id', requireTelegramAuth, requireBound, strictLimiter, requireGameParticipant, (req, res) => {
  const { id } = req.params;
  try {
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM game_results WHERE game_id = ?').run(id);
      db.prepare('DELETE FROM games WHERE id = ?').run(id);
    });
    tx();
    res.json({ success: true });
  } catch (dbErr) {
    console.error('Failed to delete game:', dbErr.message);
    res.status(500).json({ error: 'Ошибка удаления игры' });
  }
});

app.delete('/api/games', requireTelegramAuth, requireBound, strictLimiter, (req, res) => {
  const ownerUserId = req.userId;
  try {
    const tx = db.transaction(() => {
      const gameIds = db.prepare('SELECT id FROM games WHERE owner_user_id = ?').all(ownerUserId).map(g => g.id);
      if (gameIds.length > 0) {
        const placeholders = gameIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM game_results WHERE game_id IN (${placeholders})`).run(...gameIds);
        db.prepare(`DELETE FROM games WHERE id IN (${placeholders})`).run(...gameIds);
      }
    });
    tx();
    res.json({ success: true });
  } catch (dbErr) {
    console.error('Failed to clear games:', dbErr.message);
    res.status(500).json({ error: 'Ошибка очистки истории' });
  }
});

// ===== ПРЕСЕТЫ =====

app.get('/api/presets', (req, res) => {
  const presets = db.prepare('SELECT id, name, chips FROM presets').all();
  const result = presets.map(p => {
    try {
      return { id: p.id, name: p.name, chips: JSON.parse(p.chips) };
    } catch {
      return { id: p.id, name: p.name, chips: [] };
    }
  });
  res.json(result);
});

app.post('/api/presets', requireTelegramAuth, requireBound, strictLimiter, (req, res) => {
  const { id, name, chips } = req.body;
  const ownerUserId = req.userId;

  const err = validateString(id, 'id') || validateString(name, 'name', 1, 50) || validateArray(chips, 'chips');
  if (err) return res.status(400).json({ error: err });

  for (const chip of chips) {
    const chipErr = validateString(chip.color, 'color') || validateNumber(chip.nominal, 'nominal', 0);
    if (chipErr) return res.status(400).json({ error: chipErr });
  }

  try {
    db.prepare('INSERT OR REPLACE INTO presets (id, name, chips, owner_user_id) VALUES (?, ?, ?, ?)')
      .run(id, name, JSON.stringify(chips), ownerUserId);
    res.json({ success: true });
  } catch (dbErr) {
    console.error('Failed to save preset:', dbErr.message);
    res.status(500).json({ error: 'Ошибка сохранения пресета' });
  }
});

app.delete('/api/presets/:id', requireTelegramAuth, requireBound, strictLimiter, (req, res) => {
  try {
    db.prepare('DELETE FROM presets WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (dbErr) {
    console.error('Failed to delete preset:', dbErr.message);
    res.status(500).json({ error: 'Ошибка удаления пресета' });
  }
});

// ===== USERS =====

// Профиль текущего пользователя (определяется из подписи)
app.get('/api/users/me', requireTelegramAuth, (req, res) => {
  try {
    const user = db.prepare('SELECT player_name as name FROM users WHERE id = ?').get(req.userId);
    res.json(user || null);
  } catch {
    res.json(null);
  }
});

// Привязка: сервер сам определяет tgId из подписи, клиент НЕ передаёт tgId
app.post('/api/users', requireTelegramAuth, strictLimiter, (req, res) => {
  const userId = req.userId;
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 50) {
    return res.status(400).json({ error: 'Имя должно быть от 1 до 50 символов' });
  }
  const sanitizedName = name.trim();

  const existingUser = db.prepare('SELECT id FROM users WHERE player_name = ? AND id != ?').get(sanitizedName, userId);
  if (existingUser) {
    return res.status(409).json({ error: 'Это имя уже занято другим игроком' });
  }

  try {
    db.prepare('UPDATE users SET player_name = ? WHERE id = ?').run(sanitizedName, userId);
    res.json({ name: sanitizedName });
  } catch (err) {
    console.error('Failed to save user:', err.message);
    res.status(400).json({ error: 'Ошибка сохранения профиля' });
  }
});

// Удаление: только свой профиль
app.delete('/api/users', requireTelegramAuth, requireBound, strictLimiter, (req, res) => {
  const userId = req.userId;
  try {
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    res.json({ success: true });
  } catch (dbErr) {
    console.error('Failed to delete user:', dbErr.message);
    res.status(500).json({ error: 'Ошибка удаления профиля' });
  }
});

// Обновление имени: только свой профиль
app.put('/api/users', requireTelegramAuth, requireBound, strictLimiter, (req, res) => {
  const userId = req.userId;
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 50) {
    return res.status(400).json({ error: 'Имя должно быть от 1 до 50 символов' });
  }
  const sanitizedName = name.trim();

  const existingUser = db.prepare('SELECT id FROM users WHERE player_name = ? AND id != ?').get(sanitizedName, userId);
  if (existingUser) {
    return res.status(409).json({ error: 'Это имя уже занято другим игроком' });
  }

  try {
    const tx = db.transaction(() => {
      db.prepare('UPDATE users SET player_name = ? WHERE id = ?').run(sanitizedName, userId);
      db.prepare('UPDATE game_results SET player_name = ? WHERE user_id = ?').run(sanitizedName, userId);
    });
    tx();
    res.json({ name: sanitizedName });
  } catch (err) {
    console.error('Failed to update user:', err.message);
    res.status(400).json({ error: 'Ошибка обновления профиля' });
  }
});

app.get('/api/players', (req, res) => {
  try {
    const players = db.prepare('SELECT id, player_name as name FROM users WHERE player_name IS NOT NULL').all();
    res.json(players);
  } catch {
    res.json([]);
  }
});

// ===== VENUES =====

app.get('/api/venues', (req, res) => {
  try {
    const venues = db.prepare('SELECT name FROM venues ORDER BY id DESC').all();
    res.json(venues.map(v => v.name));
  } catch {
    res.json([]);
  }
});

app.post('/api/venues', requireTelegramAuth, requireBound, strictLimiter, (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 100) {
    return res.status(400).json({ error: 'Некорректное название локации' });
  }
  try {
    db.prepare('INSERT INTO venues (name) VALUES (?)').run(name.trim());
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Локация уже существует' });
    }
    console.error('Failed to save venue:', err.message);
    res.status(500).json({ error: 'Ошибка сохранения локации' });
  }
});

app.delete('/api/venues/:name', requireTelegramAuth, requireBound, strictLimiter, (req, res) => {
  try {
    db.prepare('DELETE FROM venues WHERE name = ?').run(decodeURIComponent(req.params.name));
    res.json({ success: true });
  } catch (dbErr) {
    console.error('Failed to delete venue:', dbErr.message);
    res.status(500).json({ error: 'Ошибка удаления локации' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ===== SCHEDULED GAMES =====

app.get('/api/scheduled', (req, res) => {
  try {
    const games = db.prepare('SELECT * FROM scheduled_games ORDER BY scheduled_at DESC').all();
    res.json(games.map(g => {
      let players;
      try { players = JSON.parse(g.players); } catch { players = []; }
      return { id: g.id, venue: g.venue, scheduledAt: g.scheduled_at, players, createdAt: g.created_at };
    }));
  } catch {
    res.json([]);
  }
});

app.post('/api/scheduled', requireTelegramAuth, requireBound, strictLimiter, (req, res) => {
  const { id, venue, scheduledAt, players, createdAt } = req.body;
  const ownerUserId = req.userId;

  const err = validateString(id, 'id') || validateString(venue, 'venue', 1, 100)
    || validateString(scheduledAt, 'scheduledAt') || validateArray(players, 'players');
  if (err) return res.status(400).json({ error: err });

  try {
    db.prepare(
      'INSERT OR REPLACE INTO scheduled_games (id, venue, scheduled_at, players, created_at, owner_user_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, venue, scheduledAt, JSON.stringify(players), createdAt || new Date().toISOString(), ownerUserId);
    res.json({ success: true });
  } catch (dbErr) {
    console.error('Failed to save scheduled game:', dbErr.message);
    res.status(500).json({ error: 'Ошибка сохранения' });
  }
});

app.delete('/api/scheduled/:id', requireTelegramAuth, requireBound, strictLimiter, (req, res) => {
  try {
    db.prepare('DELETE FROM scheduled_games WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (dbErr) {
    console.error('Failed to delete scheduled game:', dbErr.message);
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

// ===== STATIC & SPA =====

app.use(express.static(path.join(__dirname, '..', 'dist')));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  if (err.message === 'CORS blocked') {
    return res.status(403).json({ error: 'CORS policy violation' });
  }
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
