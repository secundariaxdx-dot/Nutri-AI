/**
 * Cálculos nutricionales. Regla básica: los nutrientes de un alimento se
 * guardan por 100 g y se escalan linealmente según los gramos consumidos.
 * Un nutriente sin datos en algún elemento se marca como "parcial" en el total
 * en lugar de suponer que vale 0.
 */
import { NUTRIENT_KEYS } from '@/config/nutrients';
import type { Meal, MealItem, NutrientKey, Nutrients } from '@/types';

/** Escala unos valores por 100 g a una cantidad concreta. */
export function scaleNutrients(per100g: Nutrients, grams: number): Nutrients {
  const factor = Math.max(0, grams) / 100;
  const out: Nutrients = {};
  for (const key of NUTRIENT_KEYS) {
    const v = per100g[key];
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = v * factor;
  }
  return out;
}

export interface NutrientTotals {
  values: Nutrients;
  /** Nutrientes con datos en solo algunos elementos. */
  partial: Set<NutrientKey>;
  /** Nutrientes sin datos en ningún elemento. */
  missing: Set<NutrientKey>;
}

/** Suma los nutrientes de una lista de valores ya escalados. */
export function sumNutrients(list: Nutrients[]): NutrientTotals {
  const values: Nutrients = {};
  const partial = new Set<NutrientKey>();
  const missing = new Set<NutrientKey>();
  for (const key of NUTRIENT_KEYS) {
    let has = 0;
    let sum = 0;
    for (const n of list) {
      const v = n[key];
      if (typeof v === 'number' && Number.isFinite(v)) {
        has++;
        sum += v;
      }
    }
    if (has > 0) values[key] = sum;
    if (list.length > 0 && has === 0) missing.add(key);
    else if (has > 0 && has < list.length) partial.add(key);
  }
  return { values, partial, missing };
}

export function itemNutrients(item: Pick<MealItem, 'per100g' | 'grams'>): Nutrients {
  return scaleNutrients(item.per100g, item.grams);
}

export function itemsTotals(items: Pick<MealItem, 'per100g' | 'grams'>[]): NutrientTotals {
  return sumNutrients(items.map(itemNutrients));
}

export function mealTotals(meal: Pick<Meal, 'items'>): NutrientTotals {
  return itemsTotals(meal.items);
}

/** Totales de un conjunto de comidas (p. ej. un día completo). */
export function mealsTotals(meals: Pick<Meal, 'items'>[]): NutrientTotals {
  return itemsTotals(meals.flatMap((m) => m.items));
}

export function kcalOf(items: Pick<MealItem, 'per100g' | 'grams'>[]): number {
  return items.reduce((acc, i) => acc + ((i.per100g.kcal ?? 0) * i.grams) / 100, 0);
}

/** Porcentaje (0–∞) de un valor respecto a un objetivo. */
export function percentOf(value: number, goal: number): number {
  if (!goal || goal <= 0) return 0;
  return (value / goal) * 100;
}

/** Calorías aportadas por cada macronutriente (4/4/9 kcal por gramo). */
export function macroEnergySplit(n: Nutrients) {
  const p = (n.protein ?? 0) * 4;
  const c = (n.carbs ?? 0) * 4;
  const f = (n.fat ?? 0) * 9;
  const total = p + c + f || 1;
  return { protein: p / total, carbs: c / total, fat: f / total };
}

/** Redondea gramos a un paso razonable para mostrar/editar. */
export function roundGrams(g: number): number {
  if (g < 20) return Math.max(1, Math.round(g));
  return Math.round(g / 5) * 5;
}
