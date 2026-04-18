import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import https from 'https';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const db = new Database(path.join(__dirname, 'poker.db'));

// Включаем WAL mode для лучшей конкурентности
db.pragma('journal_mode = WAL');

// === Настройка БД ===

db.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, tg_id TEXT NOT NULL UNIQUE, player_name TEXT)`);
db.exec(`CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, date TEXT NOT NULL, finished_at TEXT NOT NULL DEFAULT '', venue TEXT NOT NULL DEFAULT '', starting_chips INTEGER NOT NULL, buy_in_rubles REAL NOT NULL, chip_price_rubles REAL NOT NULL)`);
db.exec(`CREATE TABLE IF NOT EXISTS game_results (id INTEGER PRIMARY KEY AUTOINCREMENT, game_id TEXT NOT NULL, player_id TEXT NOT NULL, player_name TEXT NOT NULL, buy_in_qty INTEGER NOT NULL DEFAULT 1, rebuy_qty INTEGER NOT NULL DEFAULT 0, was_chips INTEGER NOT NULL, became_chips INTEGER NOT NULL, rubles REAL NOT NULL, spent_rubles REAL NOT NULL, FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE)`);
db.exec(`CREATE TABLE IF NOT EXISTS presets (id TEXT PRIMARY KEY, name TEXT NOT NULL, chips TEXT NOT NULL)`);
db.exec(`CREATE TABLE IF NOT EXISTS scheduled_games (id TEXT PRIMARY KEY, venue TEXT NOT NULL, scheduled_at TEXT NOT NULL, players TEXT NOT NULL, created_at TEXT NOT NULL)`);
db.exec(`CREATE TABLE IF NOT EXISTS venues (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_results_game ON game_results(game_id)`);

// Миграции для старых БД
try { db.exec('ALTER TABLE games ADD COLUMN owner_user_id INTEGER'); } catch {}
try { db.exec('ALTER TABLE presets ADD COLUMN owner_user_id INTEGER'); } catch {}
try { db.exec('ALTER TABLE scheduled_games ADD COLUMN owner_user_id INTEGER'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN tg_username TEXT'); } catch {}
try { db.exec('ALTER TABLE presets ADD COLUMN is_temporary INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE presets ADD COLUMN created_at TEXT'); } catch {}
try { db.exec('ALTER TABLE game_results ADD COLUMN user_id INTEGER'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_games_owner ON games(owner_user_id)'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_results_user ON game_results(user_id)'); } catch {}
try { db.exec('ALTER TABLE game_results ADD FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE'); } catch {}
try { db.exec('ALTER TABLE game_results ADD FOREIGN KEY (user_id) REFERENCES users(id)'); } catch {}
try { db.exec('ALTER TABLE games ADD FOREIGN KEY (owner_user_id) REFERENCES users(id)'); } catch {}
try { db.exec('ALTER TABLE presets ADD FOREIGN KEY (owner_user_id) REFERENCES users(id)'); } catch {}
try { db.exec('ALTER TABLE scheduled_games ADD FOREIGN KEY (owner_user_id) REFERENCES users(id)'); } catch {}
try { db.exec('ALTER TABLE scheduled_games ADD COLUMN scheduled_at_ts INTEGER'); } catch {}
try { db.exec('ALTER TABLE scheduled_games ADD COLUMN scheduled_at_display TEXT'); } catch {}

db.exec(`CREATE TABLE IF NOT EXISTS notifications_sent (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scheduled_game_id TEXT NOT NULL,
  type TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(scheduled_game_id, type)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS active_games (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  chip_inputs TEXT NOT NULL DEFAULT '{}',
  owner_user_id INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
)`);

// Зачистка старых активных игр (старше 24ч) и временных пресетов
try {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  db.prepare("DELETE FROM active_games WHERE updated_at < ?").run(cutoff);
  db.prepare("DELETE FROM presets WHERE is_temporary = 1 AND created_at IS NOT NULL AND created_at < ?").run(cutoff);
} catch {}

// === Telegram Bot API helpers ===

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTelegramMessage(tgId, text) {
  if (!BOT_TOKEN) {
    console.warn('[notify] TELEGRAM_BOT_TOKEN not set, skipping message');
    return;
  }
  return new Promise((resolve) => {
    const payload = JSON.stringify({ chat_id: tgId, text, parse_mode: 'HTML' });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          console.error('[notify] Telegram API error:', res.statusCode, body);
        }
        resolve();
      });
    });
    req.on('error', (e) => {
      console.error('[notify] Failed to send Telegram message:', e.message);
      resolve();
    });
    req.write(payload);
    req.end();
  });
}

async function sendGameResultsToPlayers(gameId) {
  if (!BOT_TOKEN) {
    console.warn('[notify] TELEGRAM_BOT_TOKEN not set, skipping game results');
    return;
  }
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
  if (!game) return;
  const results = db.prepare('SELECT * FROM game_results WHERE game_id = ?').all(gameId);

  let text = `🎰 <b>Игра завершена!</b>\n`;
  text += `📍 ${game.venue || 'Не указано'}\n\n`;
  text += `📊 <b>Результаты:</b>\n`;
  for (const r of results) {
    const diff = r.rubles - r.spent_rubles;
    const sign = diff > 0 ? '+' : '';
    text += `${r.player_name}: ${sign}${diff.toFixed(0)} ₽ (${r.became_chips} pts)\n`;
  }

  for (const r of results) {
    if (r.user_id) {
      const user = db.prepare('SELECT tg_id FROM users WHERE id = ?').get(r.user_id);
      if (user?.tg_id) {
        console.log(`[notify] Sending results to tg_id=${user.tg_id}`);
        await sendTelegramMessage(user.tg_id, text);
      }
    }
  }
}

// === Scheduled game reminders (24h, 1h) ===

function checkScheduledReminders() {
  if (!BOT_TOKEN) return;
  const now = Date.now();
  const scheduled = db.prepare('SELECT * FROM scheduled_games').all();

  for (const sg of scheduled) {
    const scheduledAtTs = sg.scheduled_at_ts;
    if (!scheduledAtTs) continue;

    const diff = scheduledAtTs - now;
    const players = JSON.parse(sg.players || '[]');

    const reminders = [
      { type: '24h', window: [23.5 * 3600000, 24.5 * 3600000], label: 'через 24 часа' },
      { type: '1h', window: [0.5 * 3600000, 1.5 * 3600000], label: 'через 1 час' },
    ];

    for (const r of reminders) {
      if (diff >= r.window[0] && diff <= r.window[1]) {
        const already = db.prepare('SELECT 1 FROM notifications_sent WHERE scheduled_game_id = ? AND type = ?').get(sg.id, r.type);
        if (already) continue;

        console.log(`[notify] Sending ${r.type} reminder for game ${sg.id} at ${sg.venue}`);
        const playerNames = players.join(', ') || '—';
        const timeDisplay = sg.scheduled_at_display || '';
        const timeLine = timeDisplay ? `\n🕐 ${timeDisplay}` : '';
        const msg = `⏰ <b>Напоминание!</b>\nИгра ${r.label}\n📍 ${sg.venue || 'Не указано'}${timeLine}\n👤 ${playerNames}`;

        for (const name of players) {
          const user = db.prepare('SELECT tg_id FROM users WHERE player_name = ?').get(name);
          if (user?.tg_id) {
            console.log(`[notify] Sending to ${name} (tg_id=${user.tg_id})`);
            sendTelegramMessage(user.tg_id, msg);
          } else {
            console.log(`[notify] No tg_id for player "${name}"`);
          }
        }

        db.prepare('INSERT OR IGNORE INTO notifications_sent (scheduled_game_id, type) VALUES (?, ?)').run(sg.id, r.type);
      }
    }
  }
}

setInterval(checkScheduledReminders, 5 * 60 * 1000);
setTimeout(checkScheduledReminders, 10000);

const app = express();

// === CORS: localhost + продакшен домены из окружения ===
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'https://web.telegram.org',
  'https://t.me',
  'https://batoot-pokerok-helper.fun',
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
  const tgUsername = verified.user.username || null;

  // Находим или создаём пользователя, получаем внутренний user_id
  let userRow = db.prepare('SELECT id, tg_id, player_name, tg_username FROM users WHERE tg_id = ?').get(tgId);
  if (!userRow) {
    // Новый пользователь — создаём с пустым именем (фронтенд запросит его ввод)
    try {
      const result = db.prepare('INSERT INTO users (tg_id, player_name, tg_username) VALUES (?, NULL, ?)').run(tgId, tgUsername);
      userRow = { id: result.lastInsertRowid, tg_id: tgId, player_name: null, tg_username: tgUsername };
    } catch (err) {
      // Race condition: другой запрос уже создал пользователя
      if (err.message.includes('UNIQUE')) {
        userRow = db.prepare('SELECT id, tg_id, player_name, tg_username FROM users WHERE tg_id = ?').get(tgId);
      } else {
        return res.status(500).json({ error: 'Ошибка создания профиля' });
      }
    }
  }

  if (tgUsername && userRow.tg_username !== tgUsername) {
    db.prepare('UPDATE users SET tg_username = ? WHERE id = ?').run(tgUsername, userRow.id);
    userRow.tg_username = tgUsername;
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
        'userId', r.user_id,
        'tgId', u.tg_id,
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
    LEFT JOIN users u ON r.user_id = u.id
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

app.post('/api/games', requireTelegramAuth, strictLimiter, (req, res) => {
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
    sendGameResultsToPlayers(id).catch(e => console.error('Failed to send results:', e.message));
  } catch (dbErr) {
    console.error('Failed to save game:', dbErr.message);
    res.status(500).json({ error: 'Ошибка сохранения игры' });
  }
});

app.delete('/api/games/:id', requireTelegramAuth, strictLimiter, requireGameParticipant, (req, res) => {
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

app.delete('/api/games', requireTelegramAuth, strictLimiter, (req, res) => {
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
  const presets = db.prepare('SELECT id, name, chips, is_temporary as isTemporary FROM presets').all();
  const result = presets.map(p => {
    try {
      return { id: p.id, name: p.name, chips: JSON.parse(p.chips), isTemporary: !!p.isTemporary };
    } catch {
      return { id: p.id, name: p.name, chips: [], isTemporary: !!p.isTemporary };
    }
  });
  res.json(result);
});

app.post('/api/presets', requireTelegramAuth, strictLimiter, (req, res) => {
  const { id, name, chips, isTemporary } = req.body;
  const ownerUserId = req.userId;

  const err = validateString(id, 'id') || validateString(name, 'name', 1, 50) || validateArray(chips, 'chips');
  if (err) return res.status(400).json({ error: err });

  for (const chip of chips) {
    const chipErr = validateString(chip.color, 'color') || validateNumber(chip.nominal, 'nominal', 0);
    if (chipErr) return res.status(400).json({ error: chipErr });
  }

  const isTemp = isTemporary ? 1 : 0;
  const createdAt = new Date().toISOString();

  try {
    db.prepare('INSERT OR REPLACE INTO presets (id, name, chips, owner_user_id, is_temporary, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, name, JSON.stringify(chips), ownerUserId, isTemp, createdAt);
    res.json({ success: true });
  } catch (dbErr) {
    console.error('Failed to save preset:', dbErr.message);
    res.status(500).json({ error: 'Ошибка сохранения пресета' });
  }
});

app.delete('/api/presets/:id', requireTelegramAuth, strictLimiter, (req, res) => {
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
    const user = db.prepare('SELECT id, player_name as name FROM users WHERE id = ?').get(req.userId);
    const ADMIN_TG_ID = process.env.ADMIN_TG_ID;
    if (!ADMIN_TG_ID) return res.status(500).json({ error: 'ADMIN_TG_ID не настроен' });
    res.json({ ...user, isAdmin: req.tgId === ADMIN_TG_ID });
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
app.delete('/api/users', requireTelegramAuth, strictLimiter, (req, res) => {
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
app.put('/api/users', requireTelegramAuth, strictLimiter, (req, res) => {
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
    const oldName = db.prepare('SELECT player_name FROM users WHERE id = ?').get(userId)?.player_name;
    const tx = db.transaction(() => {
      db.prepare('UPDATE users SET player_name = ? WHERE id = ?').run(sanitizedName, userId);
      db.prepare('UPDATE game_results SET player_name = ? WHERE user_id = ?').run(sanitizedName, userId);
      if (oldName && oldName !== sanitizedName) {
        const rows = db.prepare('SELECT id, players FROM scheduled_games').all();
        for (const row of rows) {
          try {
            const players = JSON.parse(row.players);
            const updated = players.map(p => p === oldName ? sanitizedName : p);
            if (players.some((p, i) => updated[i] !== p)) {
              db.prepare('UPDATE scheduled_games SET players = ? WHERE id = ?').run(JSON.stringify(updated), row.id);
            }
          } catch {}
        }
      }
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
    const players = db.prepare(`
      SELECT u.id, u.player_name as name, u.tg_username, COUNT(gr.id) as gamesCount
      FROM users u
      LEFT JOIN game_results gr ON gr.user_id = u.id
      WHERE u.player_name IS NOT NULL
      GROUP BY u.id
      ORDER BY gamesCount DESC, u.player_name
    `).all();
    res.json(players.map(p => ({ id: p.id, name: p.name, tg_username: p.tg_username, gamesCount: p.gamesCount })));
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

app.post('/api/venues', requireTelegramAuth, strictLimiter, (req, res) => {
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

app.delete('/api/venues/:name', requireTelegramAuth, strictLimiter, (req, res) => {
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
    const games = db.prepare('SELECT * FROM scheduled_games ORDER BY scheduled_at_ts DESC').all();
    res.json(games.map(g => {
      let players;
      try { players = JSON.parse(g.players); } catch { players = []; }
      return {
        id: g.id, venue: g.venue, scheduledAt: g.scheduled_at,
        scheduledAtTs: g.scheduled_at_ts || null,
        scheduledAtDisplay: g.scheduled_at_display || null,
        players, createdAt: g.created_at,
      };
    }));
  } catch {
    res.json([]);
  }
});

app.post('/api/scheduled', requireTelegramAuth, strictLimiter, (req, res) => {
  const { id, venue, scheduledAt, scheduledAtTs, scheduledAtDisplay, players, createdAt } = req.body;
  const ownerUserId = req.userId;

  const err = validateString(id, 'id') || validateString(venue, 'venue', 1, 100)
    || validateString(scheduledAt, 'scheduledAt') || validateArray(players, 'players');
  if (err) return res.status(400).json({ error: err });

  try {
    db.prepare(
      'INSERT OR REPLACE INTO scheduled_games (id, venue, scheduled_at, scheduled_at_ts, scheduled_at_display, players, created_at, owner_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, venue, scheduledAt, scheduledAtTs || null, scheduledAtDisplay || null, JSON.stringify(players), createdAt || new Date().toISOString(), ownerUserId);
    res.json({ success: true });
  } catch (dbErr) {
    console.error('Failed to save scheduled game:', dbErr.message);
    res.status(500).json({ error: 'Ошибка сохранения' });
  }
});

app.delete('/api/scheduled/:id', requireTelegramAuth, strictLimiter, (req, res) => {
  try {
    db.prepare('DELETE FROM scheduled_games WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (dbErr) {
    console.error('Failed to delete scheduled game:', dbErr.message);
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

// ===== ACTIVE GAMES =====

app.post('/api/active-games', requireTelegramAuth, strictLimiter, (req, res) => {
  const { id, data, chipInputs } = req.body;
  if (!id || !data) return res.status(400).json({ error: 'Missing id or data' });

  const existing = db.prepare('SELECT owner_user_id FROM active_games WHERE id = ?').get(id);
  if (existing && existing.owner_user_id !== req.userId) {
    return res.status(403).json({ error: 'Только создатель может обновлять игру' });
  }

  try {
    const now = new Date().toISOString();
    const gameData = typeof data === 'string' ? data : JSON.stringify(data);

    // Preserve existing chip_inputs if chipInputs is empty/not provided
    let finalChipInputs;
    if (chipInputs && Object.keys(chipInputs).length > 0) {
      finalChipInputs = JSON.stringify(chipInputs);
    } else {
      const existingRow = db.prepare('SELECT chip_inputs FROM active_games WHERE id = ?').get(id);
      finalChipInputs = existingRow ? existingRow.chip_inputs : '{}';
    }

    db.prepare(
      'INSERT OR REPLACE INTO active_games (id, data, chip_inputs, owner_user_id, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, gameData, finalChipInputs, req.userId, now);
    res.json({ success: true });
  } catch (dbErr) {
    console.error('Failed to save active game:', dbErr.message);
    res.status(500).json({ error: 'Ошибка сохранения активной игры' });
  }
});

app.get('/api/active-games/mine', requireTelegramAuth, (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    db.prepare('DELETE FROM active_games WHERE updated_at < ?').run(cutoff);

    const allActive = db.prepare('SELECT * FROM active_games').all();
    const userId = req.userId;
    const playerName = req.playerName;

    // Build name -> userId map from users table
    const userRows = db.prepare('SELECT id, player_name FROM users WHERE player_name IS NOT NULL').all();
    const nameToUserId = new Map();
    for (const u of userRows) {
      nameToUserId.set(u.player_name, u.id);
    }

    for (const row of allActive) {
      let game;
      try { game = JSON.parse(row.data); } catch { continue; }

      const players = Array.isArray(game.players) ? game.players : [];
      const isOwner = row.owner_user_id === userId;
      const isParticipant = players.some(p =>
        p.userId === userId ||
        (p.userId != null && String(p.userId) === String(userId)) ||
        (playerName && p.name === playerName)
      );

      if (isOwner || isParticipant) {
        // Enrich players with userId from users table
        let playersChanged = false;
        const enrichedPlayers = players.map(p => {
          if (!p.userId && p.name && nameToUserId.has(p.name)) {
            playersChanged = true;
            return { ...p, userId: nameToUserId.get(p.name) };
          }
          return p;
        });
        if (playersChanged) {
          game.players = enrichedPlayers;
        }

        let chipInputs;
        try { chipInputs = JSON.parse(row.chip_inputs); } catch { chipInputs = {}; }

        return res.json({
          game,
          chipInputs,
          isOwner,
          updatedAt: row.updated_at,
        });
      }
    }

    res.json(null);
  } catch (dbErr) {
    console.error('Failed to get active game:', dbErr.message);
    res.status(500).json({ error: 'Ошибка получения активной игры' });
  }
});

app.patch('/api/active-games/:id/chips', requireTelegramAuth, strictLimiter, (req, res) => {
  const { id } = req.params;
  const { playerId, chipInputs: playerChips } = req.body;

  if (!playerId || !playerChips) return res.status(400).json({ error: 'Missing playerId or chipInputs' });

  try {
    const row = db.prepare('SELECT * FROM active_games WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Активная игра не найдена' });

    let game;
    try { game = JSON.parse(row.data); } catch { return res.status(500).json({ error: 'Corrupted game data' }); }

    const players = Array.isArray(game.players) ? game.players : [];
    const isOwner = row.owner_user_id === req.userId;
    const participant = players.find(p => p.id === playerId);
    if (!isOwner && (!participant || (participant.userId !== req.userId && participant.name !== req.playerName))) {
      return res.status(403).json({ error: 'Можно обновлять только свои фишки' });
    }

    let chipInputs;
    try { chipInputs = JSON.parse(row.chip_inputs); } catch { chipInputs = {}; }

    chipInputs[playerId] = playerChips;

    const now = new Date().toISOString();
    db.prepare('UPDATE active_games SET chip_inputs = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(chipInputs), now, id);

    res.json({ success: true });
  } catch (dbErr) {
    console.error('Failed to update chips:', dbErr.message);
    res.status(500).json({ error: 'Ошибка обновления фишек' });
  }
});

app.delete('/api/active-games/:id', requireTelegramAuth, strictLimiter, (req, res) => {
  const { id } = req.params;

  try {
    const row = db.prepare('SELECT owner_user_id FROM active_games WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Активная игра не найдена' });
    if (row.owner_user_id !== req.userId) {
      return res.status(403).json({ error: 'Только создатель может завершить игру' });
    }

    db.prepare('DELETE FROM active_games WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (dbErr) {
    console.error('Failed to delete active game:', dbErr.message);
    res.status(500).json({ error: 'Ошибка удаления активной игры' });
  }
});

// ===== ADMIN =====

function requireAdmin(req, res, next) {
  const ADMIN_TG_ID = process.env.ADMIN_TG_ID;
  if (!ADMIN_TG_ID) {
    return res.status(500).json({ error: 'ADMIN_TG_ID не настроен' });
  }
  if (req.tgId !== ADMIN_TG_ID) {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }
  next();
}

app.get('/api/admin/stats', requireTelegramAuth, requireAdmin, (req, res) => {
  try {
    const games = db.prepare('SELECT COUNT(*) as count FROM games').get().count;
    const users = db.prepare('SELECT COUNT(*) as count FROM users WHERE player_name IS NOT NULL').get().count;
    const presets = db.prepare('SELECT COUNT(*) as count FROM presets').get().count;
    const venues = db.prepare('SELECT COUNT(*) as count FROM venues').get().count;
    const scheduled = db.prepare('SELECT COUNT(*) as count FROM scheduled_games').get().count;
    res.json({ games, users, presets, venues, scheduled });
  } catch {
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
});

app.delete('/api/admin/reset-all', requireTelegramAuth, requireAdmin, strictLimiter, (req, res) => {
  try {
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM game_results').run();
      db.prepare('DELETE FROM games').run();
      db.prepare('DELETE FROM active_games').run();
      db.prepare('DELETE FROM scheduled_games').run();
      db.prepare('DELETE FROM notifications_sent').run();
      db.prepare('DELETE FROM presets').run();
      db.prepare('DELETE FROM venues').run();
      db.prepare('DELETE FROM users').run();
    });
    tx();
    res.json({ success: true });
  } catch (dbErr) {
    console.error('Failed to reset all data:', dbErr.message);
    res.status(500).json({ error: 'Ошибка сброса приложения' });
  }
});

app.delete('/api/admin/games', requireTelegramAuth, requireAdmin, strictLimiter, (req, res) => {
  try {
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM game_results').run();
      db.prepare('DELETE FROM games').run();
    });
    tx();
    res.json({ success: true });
  } catch (dbErr) {
    console.error('Failed to clear all games:', dbErr.message);
    res.status(500).json({ error: 'Ошибка очистки истории' });
  }
});

app.delete('/api/admin/games/:id', requireTelegramAuth, requireAdmin, strictLimiter, (req, res) => {
  try {
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM game_results WHERE game_id = ?').run(req.params.id);
      db.prepare('DELETE FROM games WHERE id = ?').run(req.params.id);
    });
    tx();
    res.json({ success: true });
  } catch (dbErr) {
    console.error('Failed to delete game:', dbErr.message);
    res.status(500).json({ error: 'Ошибка удаления игры' });
  }
});

app.delete('/api/admin/users/:id', requireTelegramAuth, requireAdmin, strictLimiter, (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    db.prepare('UPDATE game_results SET user_id = NULL WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM presets WHERE owner_user_id = ?').run(userId);
    db.prepare('DELETE FROM scheduled_games WHERE owner_user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    res.json({ success: true });
  } catch (dbErr) {
    console.error('Failed to delete user:', dbErr.message);
    res.status(500).json({ error: 'Ошибка удаления пользователя' });
  }
});

app.delete('/api/admin/presets/:id', requireTelegramAuth, requireAdmin, strictLimiter, (req, res) => {
  try {
    db.prepare('DELETE FROM presets WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (dbErr) {
    console.error('Failed to delete preset:', dbErr.message);
    res.status(500).json({ error: 'Ошибка удаления пресета' });
  }
});

app.delete('/api/admin/venues/:name', requireTelegramAuth, requireAdmin, strictLimiter, (req, res) => {
  try {
    db.prepare('DELETE FROM venues WHERE name = ?').run(decodeURIComponent(req.params.name));
    res.json({ success: true });
  } catch (dbErr) {
    console.error('Failed to delete venue:', dbErr.message);
    res.status(500).json({ error: 'Ошибка удаления локации' });
  }
});

app.delete('/api/admin/scheduled/:id', requireTelegramAuth, requireAdmin, strictLimiter, (req, res) => {
  try {
    db.prepare('DELETE FROM scheduled_games WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (dbErr) {
    console.error('Failed to delete scheduled game:', dbErr.message);
    res.status(500).json({ error: 'Ошибка удаления запланированной игры' });
  }
});

app.put('/api/admin/users/:id', requireTelegramAuth, requireAdmin, strictLimiter, (req, res) => {
  const userId = parseInt(req.params.id);
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
    const oldName = db.prepare('SELECT player_name FROM users WHERE id = ?').get(userId)?.player_name;
    const tx = db.transaction(() => {
      db.prepare('UPDATE users SET player_name = ? WHERE id = ?').run(sanitizedName, userId);
      db.prepare('UPDATE game_results SET player_name = ? WHERE user_id = ?').run(sanitizedName, userId);
      if (oldName && oldName !== sanitizedName) {
        const rows = db.prepare('SELECT id, players FROM scheduled_games').all();
        for (const row of rows) {
          try {
            const players = JSON.parse(row.players);
            const updated = players.map(p => p === oldName ? sanitizedName : p);
            if (players.some((p, i) => updated[i] !== p)) {
              db.prepare('UPDATE scheduled_games SET players = ? WHERE id = ?').run(JSON.stringify(updated), row.id);
            }
          } catch {}
        }
      }
    });
    tx();
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to rename user:', err.message);
    res.status(500).json({ error: 'Ошибка переименования' });
  }
});

// ===== EXPORT / IMPORT =====

app.get('/api/admin/export', requireTelegramAuth, requireAdmin, (req, res) => {
  try {
    const users = db.prepare('SELECT id, tg_id, player_name, tg_username FROM users').all();
    const games = db.prepare('SELECT * FROM games').all();
    const gameResults = db.prepare('SELECT * FROM game_results').all();
    const presets = db.prepare('SELECT * FROM presets').all();
    const venues = db.prepare('SELECT * FROM venues').all();
    const scheduled = db.prepare('SELECT * FROM scheduled_games').all();
    res.json({ users, games, gameResults, presets, venues, scheduled, exportedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Failed to export data:', err.message);
    res.status(500).json({ error: 'Ошибка экспорта' });
  }
});

app.post('/api/admin/import', requireTelegramAuth, requireAdmin, strictLimiter, (req, res) => {
  const { users, games, gameResults, presets, venues, scheduled } = req.body;
  if (!games || !Array.isArray(games)) {
    return res.status(400).json({ error: 'Некорректные данные импорта' });
  }

  try {
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM game_results').run();
      db.prepare('DELETE FROM games').run();
      db.prepare('DELETE FROM scheduled_games').run();
      db.prepare('DELETE FROM presets').run();
      db.prepare('DELETE FROM venues').run();

      if (Array.isArray(users)) {
        for (const u of users) {
          if (u.tg_id && u.player_name) {
            try {
              db.prepare('INSERT OR IGNORE INTO users (id, tg_id, player_name, tg_username) VALUES (?, ?, ?, ?)')
                .run(u.id, u.tg_id, u.player_name, u.tg_username || null);
            } catch {}
          }
        }
      }

      if (Array.isArray(venues)) {
        for (const v of venues) {
          if (v.name) {
            try { db.prepare('INSERT OR IGNORE INTO venues (name) VALUES (?)').run(v.name); } catch {}
          }
        }
      }

      for (const g of games) {
        try {
          db.prepare('INSERT OR REPLACE INTO games (id, date, finished_at, venue, starting_chips, buy_in_rubles, chip_price_rubles, owner_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(g.id, g.date, g.finished_at || '', g.venue || '', g.starting_chips, g.buy_in_rubles, g.chip_price_rubles, g.owner_user_id || null);
        } catch {}
      }

      if (Array.isArray(gameResults)) {
        for (const r of gameResults) {
          try {
            db.prepare('INSERT INTO game_results (game_id, player_id, player_name, user_id, buy_in_qty, rebuy_qty, was_chips, became_chips, rubles, spent_rubles) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
              .run(r.game_id, r.player_id, r.player_name, r.user_id || null, r.buy_in_qty || 1, r.rebuy_qty || 0, r.was_chips, r.became_chips, r.rubles, r.spent_rubles);
          } catch {}
        }
      }

      if (Array.isArray(presets)) {
        for (const p of presets) {
          if (p.id && p.name) {
            try {
              db.prepare('INSERT OR REPLACE INTO presets (id, name, chips, owner_user_id, is_temporary, created_at) VALUES (?, ?, ?, ?, ?, ?)')
                .run(p.id, p.name, p.chips, p.owner_user_id || null, p.is_temporary || 0, p.created_at || null);
            } catch {}
          }
        }
      }

      if (Array.isArray(scheduled)) {
        for (const s of scheduled) {
          if (s.id) {
            try {
              db.prepare('INSERT OR REPLACE INTO scheduled_games (id, venue, scheduled_at, players, created_at, owner_user_id) VALUES (?, ?, ?, ?, ?, ?)')
                .run(s.id, s.venue || '', s.scheduled_at, s.players, s.created_at || '', s.owner_user_id || null);
            } catch {}
          }
        }
      }
    });
    tx();
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to import data:', err.message);
    res.status(500).json({ error: 'Ошибка импорта' });
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
  const tokenOk = !!process.env.TELEGRAM_BOT_TOKEN;
  console.log(`Server running on port ${PORT}`);
  console.log(`TELEGRAM_BOT_TOKEN: ${tokenOk ? 'loaded' : 'MISSING — mutations will fail!'}`);
});
