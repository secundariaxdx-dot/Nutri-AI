/**
 * Convierte detecciones del modelo en elementos de comida editables con
 * cantidades ESTIMADAS (raciones típicas ajustadas por el área ocupada).
 */
import { getDish, getFood } from '@/lib/foodDatabase';
import { uid } from '@/lib/id';
import { roundGrams } from '@/lib/nutrition';
import { DETECTION } from '@/config/ai';
import type { Food, MealItem } from '@/types';
import type { Detection } from './types';

/** Confianza mínima relativa a la detección principal para añadir un alimento. */
const RELATIVE_MIN = 0.3;
/** Confianza mínima para desglosar un plato que no es la detección principal. */
const DISH_MIN = 0.6;

export interface AnalyzedItem extends MealItem {
  lowConfidence: boolean;
}

export function itemFromFood(food: Food, grams: number, extra: Partial<MealItem> = {}): MealItem {
  return {
    id: uid(),
    foodId: food.id,
    name: food.name,
    grams,
    per100g: { ...food.nutrients },
    source: food.source,
    preparation: food.preparation,
    brand: food.brand,
    ...extra,
  };
}

/**
 * Factor de tamaño a partir de la proporción de regiones donde domina el
 * alimento. Es una aproximación grosera: una foto no permite medir peso.
 */
export function portionFactor(share: number, count: number): number {
  if (count <= 1 || share <= 0) return 1;
  const expected = 1 / count;
  const f = 1 + (share - expected) * 0.6;
  return Math.min(1.3, Math.max(0.75, f));
}

/** Un "plato completo" (receta o plato preparado) frente a un ingrediente suelto. */
export function isWholeDish(d: Detection): boolean {
  return d.kind === 'dish' || getFood(d.id)?.category === 'platos';
}

/**
 * Separa las detecciones en las que se usarán y las alternativas. Dos platos
 * completos (p. ej. «pizza» y «lasaña») casi nunca aparecen juntos: suelen ser
 * hipótesis rivales, así que solo se conserva el más probable y el resto se
 * ofrece como alternativa con un toque.
 */
export function splitAlternatives(detections: Detection[]): { primary: Detection[]; alternatives: Detection[] } {
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
  const top = sorted[0]?.confidence ?? 0;
  const primary: Detection[] = [];
  const alternatives: Detection[] = [];
  let dishTaken = false;
  sorted.forEach((d, i) => {
    // Detecciones débiles respecto a la principal: se sugieren, no se añaden.
    const weak = i > 0 && d.confidence < top * RELATIVE_MIN;
    if (isWholeDish(d)) {
      const strongEnough = i === 0 || d.confidence >= DISH_MIN;
      if (dishTaken || weak || !strongEnough) alternatives.push(d);
      else {
        dishTaken = true;
        primary.push(d);
      }
    } else if (weak) alternatives.push(d);
    else primary.push(d);
  });
  return { primary, alternatives: alternatives.slice(0, 5) };
}

export function detectionLabel(d: Detection): string {
  return d.kind === 'dish' ? getDish(d.id)?.name ?? d.id : getFood(d.id)?.name ?? d.id;
}

export function detectionsToItems(detections: Detection[]): AnalyzedItem[] {
  const out: AnalyzedItem[] = [];
  const count = detections.length;
  const seen = new Map<string, AnalyzedItem>();

  const push = (food: Food, grams: number, d: Detection, fromDish?: string) => {
    const g = roundGrams(grams);
    const existing = seen.get(food.id);
    if (existing) {
      existing.grams = Math.max(existing.grams, g);
      existing.confidence = Math.max(existing.confidence ?? 0, d.confidence);
      return;
    }
    const item: AnalyzedItem = {
      ...itemFromFood(food, g, { estimated: true, confidence: d.confidence, fromDish }),
      lowConfidence: d.confidence < DETECTION.lowConfidence,
    };
    seen.set(food.id, item);
    out.push(item);
  };

  for (const d of [...detections].sort((a, b) => b.confidence - a.confidence)) {
    const factor = portionFactor(d.share, count);
    if (d.kind === 'dish') {
      const dish = getDish(d.id);
      if (!dish) continue;
      for (const ing of dish.items) {
        const food = getFood(ing.foodId);
        if (food) push(food, ing.grams * factor, d, dish.name);
      }
    } else {
      const food = getFood(d.id);
      if (food) push(food, (food.portion ?? 100) * factor, d);
    }
  }
  return out;
}
