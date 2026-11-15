import { describe, expect, it } from 'vitest';
import { isValidBarcode, offProductToFood, parseOffNutrients, translateAllergens } from './openFoodFacts';
import { parseUsdaNutrients } from './usda';
import { validateSupabaseConfig } from './sync/client';

describe('Open Food Facts', () => {
  it('convierte unidades (g → mg/µg) y no inventa datos', () => {
    const n = parseOffNutrients({ 'energy-kcal_100g': 539, proteins_100g: 6.3, sodium_100g: 0.043, 'vitamin-c_100g': 0.012, 'vitamin-d_100g': 0.0000025 });
    expect(n.kcal).toBe(539);
    expect(n.sodium).toBeCloseTo(43);
    expect(n.vitaminC).toBeCloseTo(12);
    expect(n.vitaminD).toBeCloseTo(2.5);
    expect(n.fiber).toBeUndefined();
  });
  it('calcula kcal desde kJ y sodio desde sal', () => {
    const n = parseOffNutrients({ 'energy-kj_100g': 418.4, salt_100g: 1 });
    expect(n.kcal).toBeCloseTo(100);
    expect(n.sodium).toBeCloseTo(400);
  });
  it('crea un alimento con fuente identificable y alérgenos en español', () => {
    const f = offProductToFood({ code: '3017624010701', product_name: 'Nutella', brands: 'Ferrero', allergens_tags: ['en:nuts', 'en:milk'], nutriments: { 'energy-kcal_100g': 539 } });
    expect(f.source).toEqual({ kind: 'off', barcode: '3017624010701', url: 'https://world.openfoodfacts.org/product/3017624010701' });
    expect(f.allergens).toEqual(['Frutos de cáscara', 'Leche']);
    expect(translateAllergens(['en:gluten'])).toEqual(['Gluten']);
  });
  it('valida códigos EAN', () => {
    expect(isValidBarcode('3017624010701')).toBe(true);
    expect(isValidBarcode('3017624010702')).toBe(false);
    expect(isValidBarcode('96385074')).toBe(true);
    expect(isValidBarcode('123')).toBe(false);
  });
});

describe('USDA', () => {
  it('prioriza energía en kcal y folato DFE', () => {
    const n = parseUsdaNutrients([
      { nutrientId: 2047, value: 120 },
      { nutrientId: 1008, value: 118 },
      { nutrientId: 1177, value: 50 },
      { nutrientId: 1190, value: 40 },
      { nutrientId: 1003, value: 20 },
    ]);
    expect(n.kcal).toBe(118);
    expect(n.folate).toBe(40);
    expect(n.protein).toBe(20);
  });
});

describe('configuración de Supabase', () => {
  it('rechaza URLs inválidas y claves secretas', () => {
    expect(validateSupabaseConfig('http://x.com', 'a'.repeat(40))).not.toBeNull();
    expect(validateSupabaseConfig('https://abcd.supabase.co', 'sb_secret_' + 'a'.repeat(30))).not.toBeNull();
    const fakeServiceRole = 'x.' + btoa(JSON.stringify({ role: 'service_role' })) + '.y';
    expect(validateSupabaseConfig('https://abcd.supabase.co', fakeServiceRole + 'aaaaaaaaaaaaaaaaaaaa')).not.toBeNull();
    expect(validateSupabaseConfig('https://abcd.supabase.co', 'sb_publishable_' + 'a'.repeat(30))).toBeNull();
  });
});
