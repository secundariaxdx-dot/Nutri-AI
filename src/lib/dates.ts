/** Utilidades de fechas en hora LOCAL (formato YYYY-MM-DD). */

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(key: string, days: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function isValidDateKey(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && toDateKey(fromDateKey(key)) === key;
}

export function timeNow(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Lista de claves de fecha desde (hoy - n + 1) hasta hoy. */
export function lastNDays(n: number, end: string = todayKey()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i));
  return out;
}

const fmtLong = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const fmtMonth = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });

export function formatDateLong(key: string): string {
  const s = fmtLong.format(fromDateKey(key));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatDateShort(key: string): string {
  return fmtShort.format(fromDateKey(key)).replace('.', '');
}

export function formatMonth(d: Date): string {
  const s = fmtMonth.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function relativeDayLabel(key: string): string {
  const t = todayKey();
  if (key === t) return 'Hoy';
  if (key === addDays(t, -1)) return 'Ayer';
  if (key === addDays(t, 1)) return 'Mañana';
  return formatDateLong(key);
}

export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 13) return 'Buenos días';
  if (h < 21) return 'Buenas tardes';
  return 'Buenas noches';
}
