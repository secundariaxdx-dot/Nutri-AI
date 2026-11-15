import { uid } from '@/lib/id';
import { matchScore } from '@/lib/text';
import type { CustomFood, Food } from '@/types';
import { db } from './database';

export async function saveCustomFood(food: Omit<Food, 'id'> & { id?: string }): Promise<CustomFood> {
  if (!food.name.trim()) throw new Error('El nombre es obligatorio');
  if (food.nutrients.kcal === undefined || food.nutrients.kcal < 0) throw new Error('Indica las calorías por 100 g');
  const now = Date.now();
  const existing = food.id ? await db.customFoods.get(food.id) : food.barcode ? await db.customFoods.where('barcode').equals(food.barcode).first() : undefined;
  const row: CustomFood = {
    ...food,
    id: existing?.id ?? food.id ?? `custom:${uid()}`,
    name: food.name.trim(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    deleted: 0,
    dirty: 1,
  };
  await db.customFoods.put(row);
  return row;
}

export async function deleteCustomFood(id: string) {
  await db.customFoods.update(id, { deleted: 1, dirty: 1, updatedAt: Date.now() });
}

export async function getCustomFood(id: string): Promise<CustomFood | undefined> {
  const f = await db.customFoods.get(id);
  return f && !f.deleted ? f : undefined;
}

export async function findCustomFoodByBarcode(code: string): Promise<CustomFood | undefined> {
  const f = await db.customFoods.where('barcode').equals(code).first();
  return f && !f.deleted ? f : undefined;
}

export async function searchCustomFoods(query: string, limit = 20): Promise<{ food: CustomFood; score: number }[]> {
  const all = await db.customFoods.toArray();
  return all
    .filter((f) => !f.deleted)
    .map((food) => ({ food, score: Math.max(matchScore(query, food.name), food.brand ? matchScore(query, food.brand) - 10 : 0) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
