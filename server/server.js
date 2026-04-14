import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'poker.db'));

// Настройка БД
db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    finished_at TEXT NOT NULL DEFAULT '',
    venue TEXT NOT NULL DEFAULT '',
    starting_chips INTEGER NOT NULL,
    buy_in_rubles REAL NOT NULL,
    chip_price_rubles REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS game_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    player_name TEXT NOT NULL,
    buy_in_qty INTEGER NOT NULL DEFAULT 1,
    rebuy_qty INTEGER NOT NULL DEFAULT 0,
    was_chips INTEGER NOT NULL,
    became_chips INTEGER NOT NULL,
    rubles REAL NOT NULL,
    spent_rubles REAL NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    chips TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_results_game ON game_results(game_id);

  CREATE TABLE IF NOT EXISTS scheduled_games (
    id TEXT PRIMARY KEY,
    venue TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    players TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    tg_id TEXT PRIMARY KEY,
    player_name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS venues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );
`);

const app = express();

// CORS — ограничиваем localhost
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
}));
app.use(express.json());

// === Dev: create test user for local testing ===
if (process.env.NODE_ENV !== 'production') {
  try {
    db.prepare("INSERT OR IGNORE INTO users (tg_id, player_name) VALUES ('test123', 'Тест')").run();
    console.log('[DEV] Test user created: test123');
  } catch (e) {
    // ignore
  }
}

// === Auth Middleware ===

// Middleware: проверка, что tgId привязан к профилю
function requireBound(req, res, next) {
  // Для DELETE/GET tgId может быть в query, для POST — в body
  const tgId = req.body?.tgId || req.query?.tgId;
  console.log('[requireBound] tgId:', tgId, 'method:', req.method, 'path:', req.path);
  if (!tgId) return res.status(401).json({ error: 'Требуется привязка аккаунта' });
  const user = db.prepare('SELECT tg_id FROM users WHERE tg_id = ?').get(tgId);
  console.log('[requireBound] user found:', !!user);
  if (!user) return res.status(403).json({ error: 'Привяжите аккаунт в настройках, чтобы выполнять это действие' });
  // Убираем tgId из body, чтобы не мешать валидации
  if (req.body && req.body.tgId) {
    const { tgId: _, ...rest } = req.body;
    req.body = rest;
  }
  next();
}

// === Validation helpers ===

function validateString(val, name, minLen = 1) {
  if (typeof val !== 'string' || val.trim().length < minLen) {
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

// Получить все завершённые игры
app.get('/api/games', (req, res) => {
  const games = db.prepare(`
    SELECT g.*, json_group_array(
      json_object(
        'playerId', r.player_id,
        'playerName', r.player_name,
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

// Сохранить завершённую игру
app.post('/api/games', requireBound, (req, res) => {
  const { id, date, players, startingChips, buyInRubles, chipPriceRubles, finishedAt, venue } = req.body;

  const err = validateString(id, 'id')
    || validateString(date, 'date')
    || validateArray(players, 'players')
    || validateNumber(startingChips, 'startingChips', 1)
    || validateNumber(buyInRubles, 'buyInRubles', 0)
    || validateNumber(chipPriceRubles, 'chipPriceRubles', 0);

  if (err) {
    return res.status(400).json({ error: err });
  }

  for (const p of players) {
    const playerErr = validateString(p.playerId, 'playerId')
      || validateString(p.playerName, 'playerName')
      || validateNumber(p.buyInQty, 'buyInQty', 0)
      || validateNumber(p.rebuyQty, 'rebuyQty', 0)
      || validateNumber(p.wasChips, 'wasChips', 0)
      || validateNumber(p.becameChips, 'becameChips', 0)
      || validateNumber(p.rubles, 'rubles')
      || validateNumber(p.spentRubles, 'spentRubles', 0);
    if (playerErr) {
      return res.status(400).json({ error: playerErr });
    }
  }

  const insertGame = db.prepare(
    'INSERT OR REPLACE INTO games (id, date, finished_at, venue, starting_chips, buy_in_rubles, chip_price_rubles) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const insertResult = db.prepare(
    'INSERT INTO game_results (game_id, player_id, player_name, buy_in_qty, rebuy_qty, was_chips, became_chips, rubles, spent_rubles) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const tx = db.transaction(() => {
    insertGame.run(id, date, finishedAt || new Date().toISOString(), venue || '', startingChips, buyInRubles, chipPriceRubles);
    for (const p of players) {
      insertResult.run(
        id,
        p.playerId,
        p.playerName,
        p.buyInQty,
        p.rebuyQty,
        p.wasChips,
        p.becameChips,
        p.rubles,
        p.spentRubles
      );
    }
  });

  tx();
  res.json({ success: true });
});

// Удалить игру
app.delete('/api/games/:id', requireBound, (req, res) => {
  const { id } = req.params;
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM game_results WHERE game_id = ?').run(id);
    db.prepare('DELETE FROM games WHERE id = ?').run(id);
  });
  tx();
  res.json({ success: true });
});

// Очистить всю историю
app.delete('/api/games', requireBound, (req, res) => {
  db.exec('DELETE FROM game_results; DELETE FROM games;');
  res.json({ success: true });
});

// ===== ПРЕСЕТЫ =====

app.get('/api/presets', (req, res) => {
  const presets = db.prepare('SELECT id, name, chips FROM presets').all();
  const result = presets.map(p => ({
    id: p.id,
    name: p.name,
    chips: JSON.parse(p.chips),
  }));
  res.json(result);
});

app.post('/api/presets', requireBound, (req, res) => {
  const { id, name, chips } = req.body;

  const err = validateString(id, 'id')
    || validateString(name, 'name')
    || validateArray(chips, 'chips');

  if (err) {
    return res.status(400).json({ error: err });
  }

  for (const chip of chips) {
    const chipErr = validateString(chip.color, 'color')
      || validateNumber(chip.nominal, 'nominal', 0);
    if (chipErr) {
      return res.status(400).json({ error: chipErr });
    }
  }

  db.prepare('INSERT OR REPLACE INTO presets (id, name, chips) VALUES (?, ?, ?)')
    .run(id, name, JSON.stringify(chips));
  res.json({ success: true });
});

app.delete('/api/presets/:id', requireBound, (req, res) => {
  db.prepare('DELETE FROM presets WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ===== HEALTH =====
// === Users API ===

app.get('/api/users/:tgId', (req, res) => {
  const user = db.prepare('SELECT tg_id as tgId, player_name as name FROM users WHERE tg_id = ?').get(req.params.tgId);
  res.json(user || null);
});

app.post('/api/users', (req, res) => {
  const { tgId, name } = req.body;
  if (!tgId || !name) return res.status(400).json({ error: 'tgId and name required' });

  // Проверяем, не занято ли имя другим пользователем
  const existingUser = db.prepare('SELECT tg_id FROM users WHERE player_name = ? AND tg_id != ?').get(name, tgId);
  if (existingUser) {
    return res.status(409).json({ error: 'Это имя уже занято другим игроком' });
  }

  try {
    db.prepare('INSERT OR REPLACE INTO users (tg_id, player_name) VALUES (?, ?)').run(tgId, name);
    res.json({ tgId, name });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/users/:tgId', (req, res) => {
  const { tgId } = req.params;
  db.prepare('DELETE FROM users WHERE tg_id = ?').run(tgId);
  res.json({ success: true });
});

app.get('/api/players', (req, res) => {
  const players = db.prepare('SELECT player_name as name, tg_id as tgId FROM users').all();
  res.json(players);
});

// ===== VENUES =====

app.get('/api/venues', (req, res) => {
  const venues = db.prepare('SELECT name FROM venues ORDER BY id DESC').all();
  res.json(venues.map(v => v.name));
});

app.post('/api/venues', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Invalid venue name' });
  }
  try {
    db.prepare('INSERT INTO venues (name) VALUES (?)').run(name.trim());
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Локация уже существует' });
    }
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/venues/:name', (req, res) => {
  db.prepare('DELETE FROM venues WHERE name = ?').run(decodeURIComponent(req.params.name));
  res.json({ success: true });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ===== SCHEDULED GAMES =====

app.get('/api/scheduled', (req, res) => {
  const games = db.prepare('SELECT * FROM scheduled_games ORDER BY scheduled_at DESC').all();
  res.json(games.map(g => ({
    id: g.id,
    venue: g.venue,
    scheduledAt: g.scheduled_at,
    players: JSON.parse(g.players),
    createdAt: g.created_at,
  })));
});

app.post('/api/scheduled', requireBound, (req, res) => {
  const { id, venue, scheduledAt, players, createdAt } = req.body;

  const err = validateString(id, 'id')
    || validateString(venue, 'venue')
    || validateString(scheduledAt, 'scheduledAt')
    || validateArray(players, 'players');

  if (err) {
    return res.status(400).json({ error: err });
  }

  try {
    db.prepare(
      'INSERT OR REPLACE INTO scheduled_games (id, venue, scheduled_at, players, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, venue, scheduledAt, JSON.stringify(players), createdAt || new Date().toISOString());
    res.json({ success: true });
  } catch (dbErr) {
    console.error('Failed to save scheduled game:', dbErr.message);
    res.status(500).json({ error: dbErr.message });
  }
});

app.delete('/api/scheduled/:id', requireBound, (req, res) => {
  db.prepare('DELETE FROM scheduled_games WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ===== STATIC =====
app.use(express.static(path.join(__dirname, '..', 'dist')));

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// SPA fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
