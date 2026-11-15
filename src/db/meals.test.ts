import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './database';
import { deleteMeal, duplicateMeal, getMeal, getMealsByDate, restoreMeal, saveMeal, type MealInput } from './meals';
import { createBackup, importBackup, parseBackup, wipeAllData } from './backup';
import { getProfile, saveProfile } from './profile';
import { saveCustomFood, searchCustomFoods, findCustomFoodByBarcode } from './customFoods';
import { itemFromFood } from '@/ai/analyze';
import { getFood } from '@/lib/foodDatabase';
import { mealsTotals } from '@/lib/nutrition';

const input = (date: string, grams = 150): MealInput => ({
  date,
  mealType: 'comida',
  time: '14:00',
  name: '',
  items: [itemFromFood(getFood('pollo-pechuga-plancha')!, grams)],
  origin: 'manual',
});

beforeEach(async () => {
  await wipeAllData();
});

describe('comidas', () => {
  it('guarda, genera nombre y marca como pendiente de sincronizar', async () => {
    const m = await saveMeal(input('2026-01-10'));
    expect(m.name).toContain('Pechuga de pollo');
    expect(m.dirty).toBe(1);
    expect((await getMealsByDate('2026-01-10')).length).toBe(1);
  });

  it('modificar cantidades recalcula nutrientes', async () => {
    const m = await saveMeal(input('2026-01-10', 100));
    expect(mealsTotals([m]).values.kcal).toBeCloseTo(165);
    const edited = await saveMeal({ ...m, items: [{ ...m.items[0], grams: 200 }] });
    expect(edited.id).toBe(m.id);
    expect(edited.createdAt).toBe(m.createdAt);
    expect(mealsTotals([(await getMeal(m.id))!]).values.kcal).toBeCloseTo(330);
  });

  it('no mezcla días', async () => {
    await saveMeal(input('2026-01-10'));
    await saveMeal(input('2026-01-11'));
    await saveMeal(input('2026-01-11'));
    expect((await getMealsByDate('2026-01-10')).length).toBe(1);
    expect((await getMealsByDate('2026-01-11')).length).toBe(2);
  });

  it('valida comidas vacías y cantidades inválidas', async () => {
    await expect(saveMeal({ ...input('2026-01-10'), items: [] })).rejects.toThrow();
    await expect(saveMeal(input('2026-01-10', 0))).rejects.toThrow();
    await expect(saveMeal(input('10/01/2026'))).rejects.toThrow();
  });

  it('elimina con lápida, permite deshacer y duplicar', async () => {
    const m = await saveMeal(input('2026-01-10'));
    await deleteMeal(m.id);
    expect(await getMeal(m.id)).toBeUndefined();
    expect((await db.meals.get(m.id))!.deleted).toBe(1);
    await restoreMeal(m);
    expect(await getMeal(m.id)).toBeDefined();
    const copy = await duplicateMeal(m.id, '2026-01-12');
    expect(copy.id).not.toBe(m.id);
    expect(copy.date).toBe('2026-01-12');
    expect(copy.items[0].id).not.toBe(m.items[0].id);
  });
});

describe('perfil', () => {
  it('calcula objetivos automáticamente al guardar', async () => {
    const p = await saveProfile({ ...(await getProfile()), age: 30, sex: 'hombre', heightCm: 180, weightKg: 80, activity: 'moderado', goal: 'mantener', autoGoals: true });
    expect(p.goals.kcal).toBeGreaterThan(2600);
    expect((await db.weights.toArray()).length).toBe(1);
  });
  it('respeta objetivos personalizados', async () => {
    const p = await saveProfile({ ...(await getProfile()), autoGoals: false, goals: { kcal: 1800, protein: 120, carbs: 150, fat: 60, fiber: 30 } });
    expect(p.goals.kcal).toBe(1800);
  });
});

describe('alimentos personalizados', () => {
  it('guarda, busca y encuentra por código de barras', async () => {
    await saveCustomFood({ name: 'Yogur Proteico', category: 'envasado', barcode: '8480000123459', source: { kind: 'custom' }, nutrients: { kcal: 60, protein: 10 } });
    expect((await searchCustomFoods('yogur'))[0].food.name).toBe('Yogur Proteico');
    expect(await findCustomFoodByBarcode('8480000123459')).toBeDefined();
    await expect(saveCustomFood({ name: '', category: 'personalizado', source: { kind: 'custom' }, nutrients: { kcal: 1 } })).rejects.toThrow();
  });
});

describe('copias de seguridad', () => {
  it('exporta e importa (combinar) sin duplicar', async () => {
    const m = await saveMeal(input('2026-01-10'));
    const backup = parseBackup(JSON.stringify(await createBackup(false)));
    expect(backup.meals).toHaveLength(1);
    const r1 = await importBackup(backup, 'merge');
    expect(r1).toEqual({ added: 0, updated: 0, skipped: 1 });
    await wipeAllData();
    const r2 = await importBackup(backup, 'merge');
    expect(r2.added).toBe(1);
    expect((await getMeal(m.id))!.items[0].grams).toBe(150);
  });
  it('rechaza archivos que no son copias', () => {
    expect(() => parseBackup('{"hola":1}')).toThrow();
    expect(() => parseBackup('no es json')).toThrow();
  });
});
