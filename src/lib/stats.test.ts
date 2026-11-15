import { describe, expect, it } from 'vitest';
import { buildDailySeries, summarize } from './stats';
import { addDays, isValidDateKey, lastNDays, toDateKey } from './dates';

const meal = (date: string, kcal: number, protein = 0) => ({ date, items: [{ per100g: { kcal, protein }, grams: 100 }] as never });

describe('estadísticas', () => {
  const end = '2026-01-10';
  it('serie diaria sin mezclar días', () => {
    const s = buildDailySeries([meal('2026-01-10', 500), meal('2026-01-10', 300), meal('2026-01-08', 1000)], 7, end);
    expect(s).toHaveLength(7);
    expect(s.at(-1)!.values.kcal).toBe(800);
    expect(s.find((d) => d.date === '2026-01-08')!.values.kcal).toBe(1000);
    expect(s.find((d) => d.date === '2026-01-09')!.logged).toBe(false);
  });
  it('medias sobre días registrados y días en objetivo', () => {
    const s = buildDailySeries([meal('2026-01-10', 2000, 100), meal('2026-01-09', 1000, 50)], 7, end);
    const sum = summarize(s, { kcal: 2000, protein: 90, carbs: 0, fat: 0, fiber: 0 });
    expect(sum.loggedDays).toBe(2);
    expect(sum.avg.kcal).toBe(1500);
    expect(sum.daysOnTarget).toBe(1);
    expect(sum.daysProteinMet).toBe(1);
  });
});

describe('fechas', () => {
  it('suma días cruzando meses y valida claves', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidDateKey('2026-02-28')).toBe(true);
    expect(lastNDays(3, '2026-01-02')).toEqual(['2025-12-31', '2026-01-01', '2026-01-02']);
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
