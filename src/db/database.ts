/**
 * Base de datos local (IndexedDB) gestionada con Dexie.
 * Arquitectura local-first: todo se guarda aquí y la sincronización con
 * Supabase (opcional) parte de estos datos.
 */
import Dexie, { type Table } from 'dexie';
import type { CustomFood, Meal, Profile, WeightEntry } from '@/types';

/** Registro de cada análisis con IA (para contadores y errores de cuota). */
export interface AiUsageRow {
  id?: number;
  ts: number;
  /** Día local YYYY-MM-DD y mes local YYYY-MM. */
  day: string;
  month: string;
  provider: string;
  model: string;
  outcome: 'ok' | 'error';
  /** true si la petición llegó al proveedor (cuenta para la cuota). */
  sent: boolean;
  errorCode?: string;
  message?: string;
}

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
  aiUsage!: Table<AiUsageRow, number>;

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
    // v2 (aditiva, no destructiva): solo añade la tabla de uso de IA.
    this.version(2).stores({
      aiUsage: '++id, ts, day, month, provider',
    });
  }
}

export const db = new NutriDB();
