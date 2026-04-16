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
} from '../utils/storage';

interface AdminStats {
  games: number;
  users: number;
  presets: number;
  venues: number;
  scheduled: number;
}

export function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [games, setGames] = useState<any[]>([]);
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  const [presets, setPresets] = useState<any[]>([]);
  const [venues, setVenues] = useState<string[]>([]);
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState<string>('stats');
  const [confirmAction, setConfirmAction] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

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
      setUsers(u.map((p: any) => ({ id: p.id || p.userId, name: p.name })));
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
          <button className="btn btn-danger mt-16" style={{ width: '100%' }} onClick={handleClearAll}>
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
                    <span className="admin-list-title verified-player">{u.name}</span>
                    <span className="text-muted text-sm">ID: {u.id}</span>
                  </div>
                  <button className="btn btn-danger btn-small" onClick={() => handleDeleteUser(u.id, u.name)}>🗑️</button>
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
