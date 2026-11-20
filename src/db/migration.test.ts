import { describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { NutriDB } from './database';

describe('migración de la base de datos', () => {
  it('v1 → v2 conserva comidas, perfil y ajustes existentes', async () => {
    const name = 'nutri-ai-migration-test';
    // Base de datos con el esquema ANTERIOR (v1), como la de un usuario real.
    const old = new Dexie(name);
    old.version(1).stores({
      meals: 'id, date, [date+mealType], updatedAt, dirty, deleted',
      profile: 'id',
      customFoods: 'id, name, barcode, updatedAt, dirty, deleted',
      settings: 'key',
      weights: 'date',
      recentFoods: 'foodId, usedAt',
    });
    await old.table('meals').put({ id: 'm1', date: '2026-11-01', mealType: 'comida', items: [{ name: 'Pan', grams: 60 }], deleted: 0, dirty: 0, updatedAt: 1 });
    await old.table('profile').put({ id: 'me', goals: { kcal: 1800 } });
    await old.table('settings').put({ key: 'usdaApiKey', value: 'x' });
    old.close();

    const db = new NutriDB(name);
    await db.open();
    expect(db.verno).toBe(2);
    expect((await db.meals.get('m1'))?.items[0].name).toBe('Pan');
    expect((await db.profile.get('me'))?.goals.kcal).toBe(1800);
    expect((await db.settings.get('usdaApiKey'))?.value).toBe('x');
    expect(await db.aiUsage.count()).toBe(0);
    db.close();
    await Dexie.delete(name);
  });
});
