export function formatDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function formatTime(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} в ${formatTime(iso)}`;
}

export function isPast(iso: string, marginMs: number = 0): boolean {
  return new Date(iso).getTime() < Date.now() - marginMs;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) return `${mins}м ${secs}с`;
  return `${secs}с`;
}
