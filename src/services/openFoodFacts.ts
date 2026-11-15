/**
 * Cliente de Open Food Facts (base de datos abierta, gratuita, sin clave).
 * https://world.openfoodfacts.org — Licencia ODbL.
 */
import type { Food, NutrientKey, Nutrients } from '@/types';
import { fetchJson } from './http';

const BASE = 'https://world.openfoodfacts.org';
const FIELDS = [
  'code',
  'product_name',
  'product_name_es',
  'generic_name_es',
  'brands',
  'quantity',
  'image_front_small_url',
  'image_front_url',
  'nutriments',
  'ingredients_text_es',
  'ingredients_text',
  'allergens_tags',
  'traces_tags',
  'nutriscore_grade',
  'serving_quantity',
  'serving_size',
].join(',');

export interface OffProduct {
  code: string;
  product_name?: string;
  product_name_es?: string;
  generic_name_es?: string;
  brands?: string;
  quantity?: string;
  image_front_small_url?: string;
  image_front_url?: string;
  nutriments?: Record<string, number | string | undefined>;
  ingredients_text_es?: string;
  ingredients_text?: string;
  allergens_tags?: string[];
  traces_tags?: string[];
  nutriscore_grade?: string;
  serving_quantity?: number | string;
  serving_size?: string;
}

/** [clave OFF (por 100 g), clave interna, factor de conversión desde g] */
const MAP: [string, NutrientKey, number][] = [
  ['proteins_100g', 'protein', 1],
  ['carbohydrates_100g', 'carbs', 1],
  ['fat_100g', 'fat', 1],
  ['saturated-fat_100g', 'saturatedFat', 1],
  ['fiber_100g', 'fiber', 1],
  ['sugars_100g', 'sugars', 1],
  ['sodium_100g', 'sodium', 1000],
  ['potassium_100g', 'potassium', 1000],
  ['calcium_100g', 'calcium', 1000],
  ['iron_100g', 'iron', 1000],
  ['magnesium_100g', 'magnesium', 1000],
  ['phosphorus_100g', 'phosphorus', 1000],
  ['zinc_100g', 'zinc', 1000],
  ['vitamin-a_100g', 'vitaminA', 1e6],
  ['vitamin-c_100g', 'vitaminC', 1000],
  ['vitamin-d_100g', 'vitaminD', 1e6],
  ['vitamin-e_100g', 'vitaminE', 1000],
  ['vitamin-b1_100g', 'thiamin', 1000],
  ['vitamin-b2_100g', 'riboflavin', 1000],
  ['vitamin-pp_100g', 'niacin', 1000],
  ['vitamin-b6_100g', 'vitaminB6', 1000],
  ['vitamin-b9_100g', 'folate', 1e6],
  ['vitamin-b12_100g', 'vitaminB12', 1e6],
];

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : undefined;
};

export function parseOffNutrients(nutriments: OffProduct['nutriments'] = {}): Nutrients {
  const out: Nutrients = {};
  let kcal = num(nutriments['energy-kcal_100g']);
  if (kcal === undefined) {
    const kj = num(nutriments['energy-kj_100g']) ?? (nutriments['energy_unit'] === 'kJ' ? num(nutriments['energy_100g']) : undefined);
    if (kj !== undefined) kcal = kj / 4.184;
  }
  if (kcal !== undefined) out.kcal = Math.round(kcal * 10) / 10;
  for (const [offKey, key, factor] of MAP) {
    const v = num(nutriments[offKey]);
    if (v !== undefined) out[key] = Math.round(v * factor * 1000) / 1000;
  }
  // Si solo hay sal, sodio = sal / 2,5
  if (out.sodium === undefined) {
    const salt = num(nutriments['salt_100g']);
    if (salt !== undefined) out.sodium = Math.round((salt / 2.5) * 1000 * 10) / 10;
  }
  return out;
}

const ALLERGENS_ES: Record<string, string> = {
  gluten: 'Gluten',
  crustaceans: 'Crustáceos',
  eggs: 'Huevo',
  fish: 'Pescado',
  peanuts: 'Cacahuetes',
  soybeans: 'Soja',
  milk: 'Leche',
  nuts: 'Frutos de cáscara',
  celery: 'Apio',
  mustard: 'Mostaza',
  'sesame-seeds': 'Sésamo',
  'sulphur-dioxide-and-sulphites': 'Sulfitos',
  lupin: 'Altramuces',
  molluscs: 'Moluscos',
};

export function translateAllergens(tags: string[] = []): string[] {
  return [...new Set(tags.map((t) => t.replace(/^\w\w:/, '')).map((t) => ALLERGENS_ES[t] ?? t.replace(/-/g, ' ')))];
}

export function offProductToFood(p: OffProduct): Food {
  const name = (p.product_name_es || p.product_name || p.generic_name_es || '').trim() || `Producto ${p.code}`;
  const serving = num(p.serving_quantity);
  return {
    id: `off:${p.code}`,
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    category: 'envasado',
    preparation: 'procesado',
    portion: serving && serving > 0 && serving < 2000 ? serving : 100,
    source: { kind: 'off', barcode: p.code, url: `${BASE}/product/${p.code}` },
    nutrients: parseOffNutrients(p.nutriments),
    barcode: p.code,
    imageUrl: p.image_front_small_url || p.image_front_url,
    ingredients: (p.ingredients_text_es || p.ingredients_text || '').trim() || undefined,
    allergens: translateAllergens([...(p.allergens_tags ?? [])]),
  };
}

export interface OffLookup {
  food: Food;
  quantity?: string;
  nutriscore?: string;
  servingSize?: string;
  traces: string[];
}

/** Busca un producto por código de barras. Devuelve null si no existe. */
export async function getProductByBarcode(code: string, signal?: AbortSignal): Promise<OffLookup | null> {
  const clean = code.replace(/\D/g, '');
  if (!isValidBarcode(clean)) throw new Error('El código introducido no parece un EAN/UPC válido.');
  const res = await fetchJson<{ status: number; product?: OffProduct }>(
    `${BASE}/api/v2/product/${clean}.json?fields=${FIELDS}&lc=es`,
    { signal },
  );
  if (res.status !== 1 || !res.product) return null;
  const p = { ...res.product, code: res.product.code || clean };
  return {
    food: offProductToFood(p),
    quantity: p.quantity,
    nutriscore: p.nutriscore_grade && /^[a-e]$/.test(p.nutriscore_grade) ? p.nutriscore_grade : undefined,
    servingSize: p.serving_size,
    traces: translateAllergens(p.traces_tags),
  };
}

/** Búsqueda de texto (limitada por OFF a unas pocas peticiones por minuto). */
export async function searchOff(query: string, signal?: AbortSignal): Promise<Food[]> {
  const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=24&lc=es&cc=es&fields=${FIELDS}`;
  const res = await fetchJson<{ products?: OffProduct[] }>(url, { signal, timeoutMs: 20000 });
  return (res.products ?? [])
    .map(offProductToFood)
    .filter((f) => f.nutrients.kcal !== undefined);
}

/** Valida EAN-8, EAN-13, UPC-A (12) e ITF-14 mediante dígito de control. */
export function isValidBarcode(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  let sum = 0;
  digits.reverse().forEach((d, i) => (sum += d * (i % 2 === 0 ? 3 : 1)));
  const ok = (10 - (sum % 10)) % 10 === check;
  // Los UPC-E (8 dígitos) usan otro cálculo: se aceptan sin verificar.
  return ok || code.length === 8;
}
