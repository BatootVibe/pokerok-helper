export function formatDate(iso: string): string {
  if (!iso) return '';
  // Для wall clock time парсим вручную
  if (iso.includes('T') && !iso.endsWith('Z') && iso.length <= 16) {
    const parts = iso.split(/[-T:]/);
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function formatTime(iso: string): string {
  if (!iso) return '';
  // Для wall clock time извлекаем время напрямую
  if (iso.includes('T') && !iso.endsWith('Z') && iso.length <= 16) {
    const parts = iso.split(/[-T:]/);
    return `${parts[3]}:${parts[4] || '00'}`;
  }
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} в ${formatTime(iso)}`;
}

export function isPast(iso: string, marginMs: number = 0): boolean {
  // iso может быть "YYYY-MM-DDTHH:mm" (wall clock) или полноценный ISO
  let targetTime: number;
  if (iso.includes('T') && !iso.endsWith('Z') && iso.length <= 16) {
    // Wall clock time — парсим как локальное
    const parts = iso.split(/[-T:]/);
    targetTime = new Date(
      parseInt(parts[0]),
      parseInt(parts[1]) - 1,
      parseInt(parts[2]),
      parseInt(parts[3]),
      parseInt(parts[4]) || 0
    ).getTime();
  } else {
    targetTime = new Date(iso).getTime();
  }
  return targetTime < Date.now() - marginMs;
}

export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}
