export interface LocalProfile {
  localId: string;
  name: string;
  telegramUsername?: string;
  linkage: 'unverified';
}

const KEY = 'poker_local_profile_v1';

export function loadLocalProfile(): LocalProfile | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  const value = JSON.parse(raw);
  return typeof value.localId === 'string' && typeof value.name === 'string'
    ? { localId: value.localId, name: value.name, telegramUsername: value.telegramUsername, linkage: 'unverified' }
    : null;
}

export function saveLocalProfile(input: { name: string; telegramUsername?: string }): LocalProfile {
  const name = input.name.trim();
  if (!name) throw new Error('Введите имя.');
  const telegramUsername = input.telegramUsername?.trim().replace(/^@/, '') || undefined;
  if (telegramUsername && !/^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(telegramUsername)) {
    throw new Error('Укажите Telegram-юзернейм без ссылки: латинские буквы, цифры и подчёркивание.');
  }
  const profile: LocalProfile = {
    localId: loadLocalProfile()?.localId || crypto.randomUUID(),
    name, telegramUsername, linkage: 'unverified',
  };
  localStorage.setItem(KEY, JSON.stringify(profile));
  return profile;
}
