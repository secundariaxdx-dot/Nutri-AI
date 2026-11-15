import { describe, expect, it } from 'vitest';
import { bmi, bmrMifflin, computeGoals } from './energy';

describe('Mifflin-St Jeor', () => {
  it('hombre 30 años, 180 cm, 80 kg = 1780 kcal', () => {
    expect(bmrMifflin({ age: 30, sex: 'hombre', heightCm: 180, weightKg: 80 })).toBe(1780);
  });
  it('mujer 30 años, 165 cm, 60 kg = 1320,25 kcal', () => {
    expect(bmrMifflin({ age: 30, sex: 'mujer', heightCm: 165, weightKg: 60 })).toBeCloseTo(1320.25);
  });
  it('sin sexo especificado usa el punto medio', () => {
    const m = bmrMifflin({ age: 30, sex: 'hombre', heightCm: 170, weightKg: 70 });
    const f = bmrMifflin({ age: 30, sex: 'mujer', heightCm: 170, weightKg: 70 });
    const n = bmrMifflin({ age: 30, sex: 'no-especificado', heightCm: 170, weightKg: 70 });
    expect(n).toBeCloseTo((m + f) / 2);
  });
});

describe('computeGoals', () => {
  const base = { age: 30, sex: 'hombre' as const, heightCm: 180, weightKg: 80, activity: 'moderado' as const };
  it('mantener ≈ gasto total', () => {
    const g = computeGoals({ ...base, goal: 'mantener' });
    expect(g.tdee).toBe(Math.round(1780 * 1.55));
    expect(Math.abs(g.kcal - g.tdee)).toBeLessThanOrEqual(5);
  });
  it('perder aplica un déficit moderado y nunca baja del basal', () => {
    const g = computeGoals({ ...base, goal: 'perder' });
    expect(g.kcal).toBeLessThan(g.tdee);
    expect(g.kcal).toBeGreaterThanOrEqual(g.bmr);
    const tiny = computeGoals({ age: 70, sex: 'mujer', heightCm: 150, weightKg: 45, activity: 'sedentario', goal: 'perder' });
    expect(tiny.kcal).toBeGreaterThanOrEqual(1200);
  });
  it('los macros cuadran con las calorías', () => {
    const g = computeGoals({ ...base, goal: 'musculo' });
    const kcal = g.protein * 4 + g.carbs * 4 + g.fat * 9;
    expect(Math.abs(kcal - g.kcal)).toBeLessThan(15);
    expect(g.protein).toBe(Math.round(80 * 1.8));
  });
  it('IMC', () => {
    expect(bmi(80, 180)).toBeCloseTo(24.69, 1);
  });
});
