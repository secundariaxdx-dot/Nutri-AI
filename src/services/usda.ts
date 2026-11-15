/**
 * Cliente de USDA FoodData Central (servicio público y gratuito del
 * Departamento de Agricultura de EE. UU.). Requiere una clave gratuita de
 * api.data.gov (sin tarjeta). Sin clave se usa DEMO_KEY, muy limitada.
 * Las búsquedas funcionan mejor en inglés.
 */
import type { Food, NutrientKey, Nutrients } from '@/types';
import { fetchJson } from './http';

const BASE = 'https://api.nal.usda.gov/fdc/v1';

/** nutrientId de FDC → clave interna */
const IDS: Record<number, NutrientKey> = {
  1008: 'kcal',
  2047: 'kcal', // Energía (Atwater general) en alimentos Foundation
  1003: 'protein',
  1005: 'carbs',
  1004: 'fat',
  1258: 'saturatedFat',
  1079: 'fiber',
  2000: 'sugars',
  1063: 'sugars',
  1093: 'sodium',
  1092: 'potassium',
  1087: 'calcium',
  1089: 'iron',
  1090: 'magnesium',
  1091: 'phosphorus',
  1095: 'zinc',
  1106: 'vitaminA',
  1162: 'vitaminC',
  1114: 'vitaminD',
  1109: 'vitaminE',
  1165: 'thiamin',
  1166: 'riboflavin',
  1167: 'niacin',
  1175: 'vitaminB6',
  1190: 'folate',
  1177: 'folate',
  1178: 'vitaminB12',
};
/** Prioridad cuando varios IDs apuntan a la misma clave (menor = preferido). */
const PRIORITY: Record<number, number> = { 1008: 0, 2047: 1, 2000: 0, 1063: 1, 1190: 0, 1177: 1 };

interface UsdaFoodNutrient {
  nutrientId?: number;
  value?: number;
  amount?: number;
  nutrient?: { id: number };
}
interface UsdaFood {
  fdcId: number;
  description: string;
  dataType?: string;
  brandOwner?: string;
  brandName?: string;
  foodNutrients?: UsdaFoodNutrient[];
  servingSize?: number;
  servingSizeUnit?: string;
}

export function parseUsdaNutrients(list: UsdaFoodNutrient[] = []): Nutrients {
  const out: Nutrients = {};
  const prio: Partial<Record<NutrientKey, number>> = {};
  for (const n of list) {
    const id = n.nutrientId ?? n.nutrient?.id;
    const v = n.value ?? n.amount;
    if (id === undefined || typeof v !== 'number' || !Number.isFinite(v)) continue;
    const key = IDS[id];
    if (!key) continue;
    const p = PRIORITY[id] ?? 0;
    if (prio[key] === undefined || p < prio[key]!) {
      out[key] = v;
      prio[key] = p;
    }
  }
  return out;
}

export function usdaToFood(f: UsdaFood): Food {
  const isBranded = f.dataType === 'Branded';
  const serving = isBranded && f.servingSizeUnit?.toLowerCase() === 'g' ? f.servingSize : undefined;
  return {
    id: `usda:${f.fdcId}`,
    name: f.description.charAt(0) + f.description.slice(1).toLowerCase(),
    brand: f.brandName || f.brandOwner || undefined,
    category: isBranded ? 'envasado' : 'personalizado',
    portion: serving && serving > 0 ? serving : 100,
    source: { kind: 'usda-api', fdcId: f.fdcId, description: f.description, dataType: f.dataType },
    nutrients: parseUsdaNutrients(f.foodNutrients),
  };
}

export function usdaKey(userKey?: string): string {
  return userKey?.trim() || (import.meta.env.VITE_USDA_API_KEY as string | undefined) || 'DEMO_KEY';
}

export async function searchUsda(query: string, apiKey?: string, signal?: AbortSignal): Promise<Food[]> {
  const params = new URLSearchParams({
    api_key: usdaKey(apiKey),
    query,
    pageSize: '25',
    dataType: 'Foundation,SR Legacy,Survey (FNDDS)',
  });
  const res = await fetchJson<{ foods?: UsdaFood[] }>(`${BASE}/foods/search?${params}`, { signal });
  return (res.foods ?? []).map(usdaToFood).filter((f) => f.nutrients.kcal !== undefined);
}
