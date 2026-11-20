/**
 * Control de uso de la IA: contadores diario y mensual, límites personales,
 * avisos y registro de errores. Todo se guarda en el dispositivo.
 *
 * Los límites OFICIALES del nivel gratuito de Gemini no se publican en la
 * documentación (se ven por proyecto en AI Studio), así que la app no los
 * inventa: usa límites personales configurables y, opcionalmente, el límite
 * diario que el usuario copie de AI Studio.
 */
import { db, type AiUsageRow } from '@/db/database';
import type { AppSettings } from '@/db/settings';
import { toDateKey } from '@/lib/dates';
import { AIError, nextPacificMidnight, redactSecrets } from './providers/errors';

const monthKey = (d: Date) => toDateKey(d).slice(0, 7);

export async function recordUsage(entry: Omit<AiUsageRow, 'id' | 'ts' | 'day' | 'month'>, now = new Date()): Promise<void> {
  await db.aiUsage.add({
    ...entry,
    message: entry.message ? redactSecrets(entry.message).slice(0, 300) : undefined,
    ts: now.getTime(),
    day: toDateKey(now),
    month: monthKey(now),
  });
  // Se conservan como máximo 1000 registros.
  const count = await db.aiUsage.count();
  if (count > 1000) {
    const old = await db.aiUsage.orderBy('ts').limit(count - 1000).primaryKeys();
    await db.aiUsage.bulkDelete(old);
  }
}

export interface UsageSummary {
  today: number;
  month: number;
  okToday: number;
  okMonth: number;
  /** Peticiones enviadas desde la medianoche del Pacífico (día de cuota de Gemini). */
  providerDay: number;
  nextDailyReset: Date;
  nextMonthlyReset: Date;
  nextProviderReset: Date;
  errors: AiUsageRow[];
}

/** Resumen para un proveedor (solo cuentan las peticiones que llegaron al proveedor). */
export async function getUsageSummary(provider: string, now = new Date()): Promise<UsageSummary> {
  const day = toDateKey(now);
  const month = monthKey(now);
  const rows = await db.aiUsage.where('month').equals(month).toArray();
  const mine = rows.filter((r) => r.provider === provider && r.sent);
  const nextPt = nextPacificMidnight(now);
  const ptDayStart = nextPt.getTime() - 24 * 3600 * 1000;
  const recentRows = await db.aiUsage.where('ts').above(ptDayStart - 1).toArray();
  const errors = (await db.aiUsage.orderBy('ts').reverse().limit(200).toArray()).filter((r) => r.outcome === 'error').slice(0, 20);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    today: mine.filter((r) => r.day === day).length,
    month: mine.length,
    okToday: mine.filter((r) => r.day === day && r.outcome === 'ok').length,
    okMonth: mine.filter((r) => r.outcome === 'ok').length,
    providerDay: recentRows.filter((r) => r.provider === provider && r.sent).length,
    nextDailyReset: tomorrow,
    nextMonthlyReset: nextMonth,
    nextProviderReset: nextPt,
    errors,
  };
}

export type LimitLevel = 'ok' | 'warn' | 'limit';

export interface LimitCheck {
  level: LimitLevel;
  allowed: boolean;
  message?: string;
}

/** Comprueba los límites personales ANTES de enviar una foto. */
export function checkLimits(u: Pick<UsageSummary, 'today' | 'month' | 'providerDay'>, s: Pick<AppSettings, 'aiDailyLimit' | 'aiMonthlyLimit' | 'aiWarnPercent' | 'aiBlockAtLimit' | 'providerDailyLimit'>): LimitCheck {
  const checks: { used: number; limit: number; label: string }[] = [
    { used: u.today, limit: s.aiDailyLimit, label: 'diario personal' },
    { used: u.month, limit: s.aiMonthlyLimit, label: 'mensual personal' },
    { used: u.providerDay, limit: s.providerDailyLimit, label: 'diario del proveedor (configurado por ti)' },
  ].filter((c) => c.limit > 0);
  const reached = checks.find((c) => c.used >= c.limit);
  if (reached) {
    return {
      level: 'limit',
      allowed: !s.aiBlockAtLimit,
      message: `Has llegado al 100 % de tu límite ${reached.label} (${reached.used}/${reached.limit}).${s.aiBlockAtLimit ? ' Los nuevos análisis están detenidos hasta que se restablezca; puedes añadir los alimentos manualmente.' : ''}`,
    };
  }
  const warn = checks.find((c) => (c.used / c.limit) * 100 >= s.aiWarnPercent);
  if (warn) return { level: 'warn', allowed: true, message: `Has usado ${warn.used} de ${warn.limit} análisis (límite ${warn.label}).` };
  return { level: 'ok', allowed: true };
}

export function personalLimitError(check: LimitCheck): AIError {
  return new AIError('personal_limit', check.message ?? 'Has alcanzado tu límite personal de análisis.');
}

/** Códigos de error que indican que la petición NO llegó al proveedor. */
// Un «timeout» puede haber llegado al proveedor: se cuenta (criterio conservador).
export const NOT_SENT_CODES = new Set(['not_configured', 'personal_limit', 'network', 'aborted', 'unsupported']);
