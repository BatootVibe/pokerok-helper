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
    chips TEXT NOT NULL  -- JSON массив [{color, nominal}]
  );

  CREATE INDEX IF NOT EXISTS idx_results_game ON game_results(game_id);

  CREATE TABLE IF NOT EXISTS scheduled_games (
    id TEXT PRIMARY KEY,
    venue TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    players TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

const app = express();
app.use(cors());
app.use(express.json());

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

  const result = games.map(g => ({
    id: g.id,
    date: g.date,
    finishedAt: g.finished_at,
    venue: g.venue || '',
    startingChips: g.starting_chips,
    buyInRubles: g.buy_in_rubles,
    chipPriceRubles: g.chip_price_rubles,
    players: JSON.parse(g.players),
  }));

  res.json(result);
});

// Сохранить завершённую игру
app.post('/api/games', (req, res) => {
  const { id, date, players, startingChips, buyInRubles, chipPriceRubles, finishedAt, venue } = req.body;

  if (!id || !players || !Array.isArray(players)) {
    return res.status(400).json({ error: 'Invalid game data' });
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
app.delete('/api/games/:id', (req, res) => {
  const { id } = req.params;
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM game_results WHERE game_id = ?').run(id);
    db.prepare('DELETE FROM games WHERE id = ?').run(id);
  });
  tx();
  res.json({ success: true });
});

// Очистить всю историю
app.delete('/api/games', (req, res) => {
  db.exec('DELETE FROM game_results; DELETE FROM games;');
  res.json({ success: true });
});

// ===== ПРЕСЕТЫ =====

// Получить все пресеты
app.get('/api/presets', (req, res) => {
  const presets = db.prepare('SELECT id, name, chips FROM presets').all();
  const result = presets.map(p => ({
    id: p.id,
    name: p.name,
    chips: JSON.parse(p.chips),
  }));
  res.json(result);
});

// Сохранить пресет
app.post('/api/presets', (req, res) => {
  const { id, name, chips } = req.body;
  if (!id || !name || !Array.isArray(chips)) {
    return res.status(400).json({ error: 'Invalid preset data' });
  }
  db.prepare('INSERT OR REPLACE INTO presets (id, name, chips) VALUES (?, ?, ?)')
    .run(id, name, JSON.stringify(chips));
  res.json({ success: true });
});

// Удалить пресет
app.delete('/api/presets/:id', (req, res) => {
  db.prepare('DELETE FROM presets WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ===== HEALTH =====
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ===== SCHEDULED GAMES =====

app.get('/api/scheduled', (req, res) => {
  const games = db.prepare('SELECT * FROM scheduled_games ORDER BY scheduled_at DESC').all();
  res.json(games.map(g => ({ ...g, players: JSON.parse(g.players) })));
});

app.post('/api/scheduled', (req, res) => {
  const { id, venue, scheduledAt, players, createdAt } = req.body;
  if (!id || !venue || !scheduledAt || !Array.isArray(players)) {
    return res.status(400).json({ error: 'Invalid scheduled game data' });
  }
  db.prepare(
    'INSERT INTO scheduled_games (id, venue, scheduled_at, players, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, venue, scheduledAt, JSON.stringify(players), createdAt || new Date().toISOString());
  res.json({ success: true });
});

app.delete('/api/scheduled/:id', (req, res) => {
  db.prepare('DELETE FROM scheduled_games WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ===== STATIC (раздача фронтенда) =====
app.use(express.static(path.join(__dirname, '..', 'dist')));

// SPA fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
