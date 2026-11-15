/** Agregados diarios para la pantalla de estadísticas (lógica pura y testeable). */
import { NUTRIENT_KEYS } from '@/config/nutrients';
import type { Goals, Meal, Nutrients } from '@/types';
import { lastNDays } from './dates';
import { mealsTotals } from './nutrition';

export interface DayPoint {
  date: string;
  logged: boolean;
  values: Nutrients;
}

export function buildDailySeries(meals: Pick<Meal, 'date' | 'items'>[], days: number, end?: string): DayPoint[] {
  const byDate = new Map<string, Pick<Meal, 'date' | 'items'>[]>();
  for (const m of meals) {
    const list = byDate.get(m.date) ?? [];
    list.push(m);
    byDate.set(m.date, list);
  }
  return lastNDays(days, end).map((date) => {
    const list = byDate.get(date) ?? [];
    return { date, logged: list.length > 0, values: list.length ? mealsTotals(list).values : {} };
  });
}

export interface PeriodSummary {
  loggedDays: number;
  avg: Nutrients;
  /** Días con calorías entre el 90 % y el 110 % del objetivo. */
  daysOnTarget: number;
  /** Días que alcanzan el objetivo de proteína. */
  daysProteinMet: number;
}

export function summarize(series: DayPoint[], goals: Goals): PeriodSummary {
  const logged = series.filter((d) => d.logged);
  const avg: Nutrients = {};
  for (const k of NUTRIENT_KEYS) {
    const vals = logged.map((d) => d.values[k]).filter((v): v is number => v !== undefined);
    if (vals.length) avg[k] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  const daysOnTarget = logged.filter((d) => {
    const k = d.values.kcal ?? 0;
    return k >= goals.kcal * 0.9 && k <= goals.kcal * 1.1;
  }).length;
  const daysProteinMet = logged.filter((d) => (d.values.protein ?? 0) >= goals.protein).length;
  return { loggedDays: logged.length, avg, daysOnTarget, daysProteinMet };
}
