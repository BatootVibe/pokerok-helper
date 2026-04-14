/// <reference types="vite/client" />

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Telegram WebApp
interface TelegramUser {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

interface TelegramWebApp {
  WebApp: {
    initDataUnsafe: {
      user?: TelegramUser;
    };
  };
}

// Global window extensions
interface Window {
  Telegram?: TelegramWebApp;
  lastGamePlayers?: Array<{ name: string; tgId?: string }>;
}

