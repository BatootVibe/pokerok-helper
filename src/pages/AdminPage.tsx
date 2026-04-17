import { useState, useEffect, useCallback } from 'react';
import { HeaderBack } from '../components/HeaderBack';
import { ConfirmModal } from '../components/ConfirmModal';
import { formatDate, formatTime } from '../utils/date';
import {
  adminGetStats,
  adminClearAllGames,
  adminDeleteGame,
  adminDeleteUser,
  adminDeletePreset,
  adminDeleteVenue,
  adminDeleteScheduled,
  loadGameHistory,
  loadPresets,
  loadVenues,
  loadScheduledGames,
  getAllPlayers,
  adminRenameUser,
  getUserProfile,
  adminExportData,
  adminImportData,
} from '../utils/storage';
import { showToast } from '../components/Toast';

import { ChipPreset, CompletedGame, ScheduledGame } from '../types';

interface AdminStats {
  games: number;
  users: number;
  presets: number;
  venues: number;
  scheduled: number;
}

interface AdminUser {
  id: number;
  name: string;
  tgUsername: string | null;
}

export function AdminPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [games, setGames] = useState<CompletedGame[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [presets, setPresets] = useState<ChipPreset[]>([]);
  const [venues, setVenues] = useState<string[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledGame[]>([]);
  const [activeSection, setActiveSection] = useState<string>('stats');
  const [confirmAction, setConfirmAction] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    getUserProfile().then(profile => {
      if (profile?.isAdmin) {
        setAuthorized(true);
      } else {
        setAuthorized(false);
      }
    }).catch(() => setAuthorized(false));
  }, []);

  if (authorized === false) {
    return (
      <div className="page">
        <HeaderBack title="Админ-панель" />
        <div className="card">
          <p className="text-center text-muted">Доступ запрещён</p>
        </div>
      </div>
    );
  }

  if (authorized === null) {
    return (
      <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Загрузка...</p>
      </div>
    );
  }

  const refresh = useCallback(async () => {
    try {
      const [s, g, u, p, v, sc] = await Promise.all([
        adminGetStats(),
        loadGameHistory(),
        getAllPlayers(),
        loadPresets(),
        loadVenues(),
        loadScheduledGames(),
      ]);
      setStats(s);
      setGames(g);
      setUsers(u.map((p: any) => ({ id: p.id || p.userId, name: p.name, tgUsername: p.tg_username || null })));
      setPresets(p);
      setVenues(v);
      setScheduled(sc);
    } catch (err) {
      console.error('Admin refresh failed:', err);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleClearAll = () => {
    setConfirmAction({
      title: '🗑️ Очистить ВСЮ историю?',
      description: `Будет удалено ${stats?.games || 0} игр безвозвратно.`,
      onConfirm: async () => {
        await adminClearAllGames();
        setConfirmAction(null);
        refresh();
      },
    });
  };

  const handleExport = async () => {
    try {
      const data = await adminExportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pokerok-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('Ошибка экспорта данных');
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setImporting(true);
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        setConfirmAction({
          title: '📥 Импорт данных?',
          description: 'Текущие игры и пресеты будут заменены данными из файла. Пользователи будут объединены.',
          onConfirm: async () => {
            try {
              await adminImportData(data);
              setConfirmAction(null);
              setImporting(false);
              refresh();
            } catch {
              showToast('Ошибка импорта данных');
              setImporting(false);
            }
          },
        });
      } catch {
        showToast('Некорректный файл импорта');
        setImporting(false);
      }
    };
    input.click();
  };

  const handleDeleteGame = (id: string) => {
    setConfirmAction({
      title: '🗑️ Удалить игру?',
      description: 'Запись будет удалена безвозвратно.',
      onConfirm: async () => {
        await adminDeleteGame(id);
        setConfirmAction(null);
        refresh();
      },
    });
  };

  const handleDeleteUser = (id: number, name: string) => {
    setConfirmAction({
      title: `🗑️ Удалить пользователя?`,
      description: `${name} — профиль и владение пресетами/расписанием будут удалены.`,
      onConfirm: async () => {
        await adminDeleteUser(id);
        setConfirmAction(null);
        refresh();
      },
    });
  };

  const handleDeletePreset = (id: string, name: string) => {
    setConfirmAction({
      title: '🗑️ Удалить пресет?',
      description: `Пресет "${name}" будет удалён.`,
      onConfirm: async () => {
        await adminDeletePreset(id);
        setConfirmAction(null);
        refresh();
      },
    });
  };

  const handleDeleteVenue = (name: string) => {
    setConfirmAction({
      title: '🗑️ Удалить локацию?',
      description: `Локация "${name}" будет удалена.`,
      onConfirm: async () => {
        await adminDeleteVenue(name);
        setConfirmAction(null);
        refresh();
      },
    });
  };

  const handleDeleteScheduled = (id: string, venue: string) => {
    setConfirmAction({
      title: '🗑️ Удалить запланированную игру?',
      description: `Игра в "${venue}" будет удалена.`,
      onConfirm: async () => {
        await adminDeleteScheduled(id);
        setConfirmAction(null);
        refresh();
      },
    });
  };

  const sections = [
    { key: 'stats', label: '📊 Статистика' },
    { key: 'games', label: `🎮 Игры (${stats?.games ?? 0})` },
    { key: 'users', label: `👤 Пользователи (${stats?.users ?? 0})` },
    { key: 'presets', label: `🎯 Пресеты (${stats?.presets ?? 0})` },
    { key: 'venues', label: `📍 Локации (${stats?.venues ?? 0})` },
    { key: 'scheduled', label: `📅 Запланированные (${stats?.scheduled ?? 0})` },
  ];

  return (
    <div className="page">
      <HeaderBack title="Админ-панель" />

      <div className="admin-section-tabs">
        {sections.map(s => (
          <button
            key={s.key}
            className={`result-tab ${activeSection === s.key ? 'active' : ''}`}
            onClick={() => setActiveSection(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {activeSection === 'stats' && stats && (
        <div className="card">
          <h3 className="card-title-center">📊 Статистика БД</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.games}</div>
              <div className="stat-label">Игр</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.users}</div>
              <div className="stat-label">Пользователей</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.presets}</div>
              <div className="stat-label">Пресетов</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.venues}</div>
              <div className="stat-label">Локаций</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.scheduled}</div>
              <div className="stat-label">Запланированных</div>
            </div>
          </div>
          <div className="admin-data-actions mt-16">
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleExport}>
              📥 Экспорт
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleImport} disabled={importing}>
              📤 Импорт
            </button>
          </div>
          <button className="btn btn-danger mt-8" style={{ width: '100%' }} onClick={handleClearAll}>
            🗑️ Очистить ВСЮ историю
          </button>
        </div>
      )}

      {activeSection === 'games' && (
        <div className="card">
          <h3 className="card-title-center">🎮 Все игры</h3>
          {games.length === 0 ? (
            <p className="text-muted text-center">Нет игр</p>
          ) : (
            <div className="admin-list">
              {games.map(g => (
                <div key={g.id} className="admin-list-item">
                  <div className="admin-list-info">
                    <span className="admin-list-title">{formatDate(g.date)} • {formatTime(g.date)}</span>
                    <span className="text-muted text-sm">{g.venue || 'Без локации'} • {g.players?.length ?? 0} игроков</span>
                  </div>
                  <button className="btn btn-danger btn-small" onClick={() => handleDeleteGame(g.id)}>🗑️</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'users' && (
        <div className="card">
          <h3 className="card-title-center">👤 Пользователи</h3>
          {users.length === 0 ? (
            <p className="text-muted text-center">Нет привязанных пользователей</p>
          ) : (
            <div className="admin-list">
              {users.map(u => (
                <div key={u.id} className="admin-list-item">
                  <div className="admin-list-info">
                    {editingUserId === u.id ? (
                      <div className="admin-rename-row">
                        <input
                          className="input"
                          type="text"
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          onKeyDown={async e => {
                            if (e.key === 'Enter' && editingName.trim()) {
                              await adminRenameUser(u.id, editingName.trim());
                              setEditingUserId(null);
                              refresh();
                            }
                          }}
                          autoFocus
                        />
                        <button className="btn btn-primary btn-small" onClick={async () => {
                          if (editingName.trim()) {
                            await adminRenameUser(u.id, editingName.trim());
                            setEditingUserId(null);
                            refresh();
                          }
                        }}>✓</button>
                        <button className="btn btn-secondary btn-small" onClick={() => setEditingUserId(null)}>✕</button>
                      </div>
                    ) : (
                      <span className="admin-list-title verified-player">{u.name}</span>
                    )}
                    <span className="text-muted text-sm">{u.tgUsername ? `@${u.tgUsername}` : 'Без @юзернейма'}</span>
                  </div>
                  <div className="admin-list-actions">
                    {editingUserId !== u.id && (
                      <button className="btn btn-secondary btn-small" onClick={() => { setEditingUserId(u.id); setEditingName(u.name); }}>✏️</button>
                    )}
                    <button className="btn btn-danger btn-small" onClick={() => handleDeleteUser(u.id, u.name)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'presets' && (
        <div className="card">
          <h3 className="card-title-center">🎯 Пресеты</h3>
          {presets.length === 0 ? (
            <p className="text-muted text-center">Нет пресетов</p>
          ) : (
            <div className="admin-list">
              {presets.map(p => (
                <div key={p.id} className="admin-list-item">
                  <div className="admin-list-info">
                    <span className="admin-list-title">{p.name}</span>
                    <span className="text-muted text-sm">{p.chips?.length ?? 0} фишек</span>
                  </div>
                  <button className="btn btn-danger btn-small" onClick={() => handleDeletePreset(p.id, p.name)}>🗑️</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'venues' && (
        <div className="card">
          <h3 className="card-title-center">📍 Локации</h3>
          {venues.length === 0 ? (
            <p className="text-muted text-center">Нет локаций</p>
          ) : (
            <div className="admin-list">
              {venues.map(v => (
                <div key={v} className="admin-list-item">
                  <div className="admin-list-info">
                    <span className="admin-list-title">{v}</span>
                  </div>
                  <button className="btn btn-danger btn-small" onClick={() => handleDeleteVenue(v)}>🗑️</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'scheduled' && (
        <div className="card">
          <h3 className="card-title-center">📅 Запланированные игры</h3>
          {scheduled.length === 0 ? (
            <p className="text-muted text-center">Нет запланированных игр</p>
          ) : (
            <div className="admin-list">
              {scheduled.map(s => (
                <div key={s.id} className="admin-list-item">
                  <div className="admin-list-info">
                    <span className="admin-list-title">📍 {s.venue}</span>
                    <span className="text-muted text-sm">{formatDate(s.scheduledAt)} • {formatTime(s.scheduledAt)} • {s.players?.length ?? 0} игроков</span>
                  </div>
                  <button className="btn btn-danger btn-small" onClick={() => handleDeleteScheduled(s.id, s.venue)}>🗑️</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="spacer" />

      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          description={confirmAction.description}
          danger
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
