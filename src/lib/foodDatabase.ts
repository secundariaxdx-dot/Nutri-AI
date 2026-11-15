/**
 * Base de datos local de alimentos (incluida en la app, funciona sin conexión).
 * Valores por 100 g procedentes de USDA FoodData Central — SR Legacy.
 */
import data from '@/data/foods.generated.json';
import type { Food } from '@/types';
import { matchScore } from './text';

export interface Dish {
  id: string;
  name: string;
  vision: string[];
  items: { foodId: string; grams: number }[];
}

interface FoodFile {
  dataset: string;
  foods: Food[];
  dishes: Dish[];
}

const db = data as unknown as FoodFile;
const byId = new Map(db.foods.map((f) => [f.id, f]));
const dishById = new Map(db.dishes.map((d) => [d.id, d]));

export const FOOD_DATASET_NAME = db.dataset;

export function getAllFoods(): Food[] {
  return db.foods;
}

export function getFood(id: string): Food | undefined {
  return byId.get(id);
}

export function getDishes(): Dish[] {
  return db.dishes;
}

export function getDish(id: string): Dish | undefined {
  return dishById.get(id);
}

/** Busca en la base local por nombre y alias. */
export function searchLocalFoods(query: string, limit = 30): { food: Food; score: number }[] {
  const results: { food: Food; score: number }[] = [];
  for (const food of db.foods) {
    let score = matchScore(query, food.name);
    for (const a of food.aliases ?? []) score = Math.max(score, matchScore(query, a) - 5);
    if (score > 0) results.push({ food, score });
  }
  return results.sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name)).slice(0, limit);
}
