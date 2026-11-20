/**
 * Convierte la descripción de la IA en elementos de comida con nutrientes de
 * la base de datos. La IA solo aporta nombre, preparación y cantidad estimada:
 * los valores nutricionales SIEMPRE salen de USDA / Open Food Facts / alimentos
 * del usuario. Si no hay coincidencia fiable, el alimento queda «sin datos» y
 * se pide al usuario que lo busque; nunca se inventan valores.
 */
import { itemFromFood } from '@/ai/analyze';
import { getFood, searchLocalFoods } from '@/lib/foodDatabase';
import { roundGrams } from '@/lib/nutrition';
import { normalizeText } from '@/lib/text';
import type { Food, MealItem, Preparation } from '@/types';
import type { VisionFood } from './schema';
import { neutralVariant, variantsOf } from './variants';

/** Confianza mínima para añadir un alimento directamente (si no es hipótesis). */
export const MIN_CONFIDENCE = 0.4;
/** Puntuación mínima de búsqueda para aceptar una coincidencia por nombre. */
const MIN_MATCH_SCORE = 40;

const PREP_MAP: Record<string, Preparation | undefined> = {
  crudo: 'crudo',
  cocido: 'cocido',
  hervido: 'cocido',
  plancha: 'plancha',
  frito: 'frito',
  horneado: 'horneado',
  asado: 'asado',
  tostado: 'tostado',
  natural: 'natural',
  desconocida: undefined,
};

export interface FoodMatch {
  food?: Food;
  preparationConfirmed: boolean;
  /** Cómo se encontró (para depurar y explicar). */
  via: 'catalog_id' | 'search' | 'none';
}

/** Busca el alimento de la base de datos que mejor corresponde a la descripción. */
export function matchVisionFood(f: VisionFood, extraFoods: Food[] = []): FoodMatch {
  const prep = PREP_MAP[f.preparation];

  // 1) Id del catálogo propuesto por el modelo (se valida que exista).
  if (f.catalog_id) {
    const food = getFood(f.catalog_id);
    if (food) {
      const hasVariants = variantsOf(food.id).length > 1;
      if (prep || !hasVariants) return { food, preparationConfirmed: true, via: 'catalog_id' };
      // Preparación no visible: variante neutra, marcada como sin confirmar.
      return { food: neutralVariant(food.id) ?? food, preparationConfirmed: false, via: 'catalog_id' };
    }
  }

  // 2) Búsqueda por nombre y sinónimos, priorizando la preparación indicada.
  const queries = [f.name, ...(f.search_terms ?? [])].filter(Boolean);
  const scores = new Map<string, { food: Food; score: number }>();
  for (const q of queries) {
    for (const r of searchLocalFoods(q, 15)) {
      const prev = scores.get(r.food.id);
      if (!prev || r.score > prev.score) scores.set(r.food.id, { food: r.food, score: r.score });
    }
    const nq = normalizeText(q);
    for (const food of extraFoods) {
      if (normalizeText(food.name).includes(nq) || nq.includes(normalizeText(food.name))) scores.set(food.id, { food, score: 70 });
    }
  }
  const tostada = /tostad/.test(normalizeText(queries.join(' ')));
  const ranked = [...scores.values()]
    .map(({ food, score }) => {
      let s = score;
      if (prep && food.preparation) s += food.preparation === prep ? 25 : -15;
      if (tostada && food.preparation === 'tostado') s += 20;
      return { food, score: s };
    })
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || best.score < MIN_MATCH_SCORE) return { preparationConfirmed: false, via: 'none' };

  const hasVariants = variantsOf(best.food.id).length > 1;
  if (!prep && hasVariants && !tostada) {
    return { food: neutralVariant(best.food.id) ?? best.food, preparationConfirmed: false, via: 'search' };
  }
  return { food: best.food, preparationConfirmed: !!prep || !hasVariants || tostada, via: 'search' };
}

export interface AnalysisDraft {
  /** Alimentos añadidos a la comida (editables). */
  items: MealItem[];
  /** Hipótesis o detecciones de baja confianza: se ofrecen, no se añaden. */
  suggestions: { vision: VisionFood; food: Food; grams: number }[];
  /** Alimentos vistos sin coincidencia en la base de datos: el usuario los busca. */
  unmatched: VisionFood[];
}

function gramsFor(f: VisionFood, food: Food): { grams: number; isDefault: boolean } {
  if (typeof f.estimated_grams === 'number' && f.estimated_grams > 0) return { grams: roundGrams(f.estimated_grams), isDefault: false };
  const units = typeof f.quantity === 'number' && f.quantity > 0 ? f.quantity : 1;
  return { grams: roundGrams((food.portion ?? 100) * units), isDefault: true };
}

export function buildAnalysisDraft(foods: VisionFood[], extraFoods: Food[] = []): AnalysisDraft {
  const draft: AnalysisDraft = { items: [], suggestions: [], unmatched: [] };
  const seen = new Map<string, MealItem>();
  for (const f of foods) {
    const m = matchVisionFood(f, extraFoods);
    if (!m.food) {
      if (!f.is_hypothesis && f.confidence >= MIN_CONFIDENCE) draft.unmatched.push(f);
      continue;
    }
    const { grams, isDefault } = gramsFor(f, m.food);
    if (f.is_hypothesis || f.confidence < MIN_CONFIDENCE) {
      draft.suggestions.push({ vision: f, food: m.food, grams });
      continue;
    }
    // Un mismo alimento detectado dos veces se agrupa en lugar de duplicarse.
    const dup = seen.get(m.food.id);
    if (dup) {
      dup.grams = roundGrams(dup.grams + grams);
      continue;
    }
    const item = itemFromFood(m.food, grams, {
      estimated: true,
      confidence: f.confidence,
      aiName: normalizeText(f.name) !== normalizeText(m.food.name) ? f.name : undefined,
      preparationUnconfirmed: !m.preparationConfirmed || undefined,
      defaultQuantity: isDefault || undefined,
    });
    seen.set(m.food.id, item);
    draft.items.push(item);
  }
  return draft;
}
