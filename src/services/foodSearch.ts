/**
 * Búsqueda unificada: base local (instantánea, sin conexión) + mis alimentos
 * + (bajo demanda) Open Food Facts y USDA FoodData Central.
 */
import { searchCustomFoods } from '@/db/customFoods';
import { db } from '@/db/database';
import { getFood, searchLocalFoods } from '@/lib/foodDatabase';
import type { Food, FoodSearchResult, MealItem } from '@/types';
import { searchOff } from './openFoodFacts';
import { searchUsda } from './usda';

export async function searchOffline(query: string): Promise<FoodSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const [custom, local] = await Promise.all([searchCustomFoods(q, 15), Promise.resolve(searchLocalFoods(q, 40))]);
  return [
    ...custom.map((r) => ({ food: r.food as Food, origin: 'custom' as const, score: r.score + 5 })),
    ...local.map((r) => ({ food: r.food, origin: 'local' as const, score: r.score })),
  ].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export async function searchOnline(query: string, source: 'off' | 'usda', usdaApiKey?: string, signal?: AbortSignal): Promise<FoodSearchResult[]> {
  const foods = source === 'off' ? await searchOff(query, signal) : await searchUsda(query, usdaApiKey, signal);
  return foods.map((food) => ({ food, origin: source }));
}

/** Alimentos usados recientemente (para acceso rápido). */
export async function getRecentFoods(limit = 12): Promise<{ food: Food; lastGrams?: number }[]> {
  const rows = await db.recentFoods.orderBy('usedAt').reverse().limit(limit * 2).toArray();
  const out: { food: Food; lastGrams?: number }[] = [];
  for (const r of rows) {
    if (r.foodId.startsWith('item:')) {
      const snap = r.snapshot as Pick<MealItem, 'name' | 'per100g' | 'source' | 'brand' | 'grams'> | undefined;
      if (snap) out.push({ food: { id: r.foodId, name: snap.name, brand: snap.brand, category: 'personalizado', source: snap.source, nutrients: snap.per100g, portion: snap.grams }, lastGrams: snap.grams });
    } else {
      const f = getFood(r.foodId) ?? (await db.customFoods.get(r.foodId));
      if (f && !('deleted' in f && f.deleted)) out.push({ food: f });
    }
    if (out.length >= limit) break;
  }
  return out;
}
