import type { MealItem } from '@/types';
import { db } from './database';

/** Registra alimentos usados recientemente para sugerirlos en el buscador. */
export async function touchRecentFoods(items: MealItem[]) {
  const now = Date.now();
  await db.transaction('rw', db.recentFoods, async () => {
    for (const it of items) {
      const key = it.foodId ?? `item:${it.name}`;
      const prev = await db.recentFoods.get(key);
      await db.recentFoods.put({
        foodId: key,
        usedAt: now,
        count: (prev?.count ?? 0) + 1,
        snapshot: it.foodId ? undefined : { name: it.name, per100g: it.per100g, source: it.source, brand: it.brand, grams: it.grams },
      });
    }
  });
}
