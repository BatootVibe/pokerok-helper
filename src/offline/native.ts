import { Capacitor, registerPlugin } from '@capacitor/core';
export const isAndroid = Capacitor.getPlatform() === 'android';
export interface LanStatus {
  running: boolean;
  addresses: string[];
  links: Record<string, string>;
  submissions: { playerId: string; counts: number[]; sequence: number }[];
}
export const NativeHost = registerPlugin<{
  load(): Promise<{ value: string | null }>;
  save(options: { value: string }): Promise<void>;
  start(options: { room: string }): Promise<LanStatus>;
  update(options: { room: string }): Promise<void>;
  status(): Promise<LanStatus>;
  stop(): Promise<void>;
  exportBackup(options: { value: string }): Promise<void>;
}>('NativeHost');
