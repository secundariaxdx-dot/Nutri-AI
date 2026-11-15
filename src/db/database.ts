/**
 * Base de datos local (IndexedDB) gestionada con Dexie.
 * Arquitectura local-first: todo se guarda aquí y la sincronización con
 * Supabase (opcional) parte de estos datos.
 */
import Dexie, { type Table } from 'dexie';
import type { CustomFood, Meal, Profile, WeightEntry } from '@/types';

export interface SettingRow {
  key: string;
  value: unknown;
}

export class NutriDB extends Dexie {
  meals!: Table<Meal, string>;
  profile!: Table<Profile, string>;
  customFoods!: Table<CustomFood, string>;
  settings!: Table<SettingRow, string>;
  weights!: Table<WeightEntry, string>;
  recentFoods!: Table<{ foodId: string; usedAt: number; count: number; snapshot?: unknown }, string>;

  constructor(name = 'nutri-ai') {
    super(name);
    this.version(1).stores({
      meals: 'id, date, [date+mealType], updatedAt, dirty, deleted',
      profile: 'id',
      customFoods: 'id, name, barcode, updatedAt, dirty, deleted',
      settings: 'key',
      weights: 'date',
      recentFoods: 'foodId, usedAt',
    });
  }
}

export const db = new NutriDB();
