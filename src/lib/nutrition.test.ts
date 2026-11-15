import { describe, expect, it } from 'vitest';
import { itemsTotals, kcalOf, macroEnergySplit, percentOf, roundGrams, scaleNutrients, sumNutrients } from './nutrition';
import { getFood, searchLocalFoods, getDishes, getAllFoods } from './foodDatabase';

describe('scaleNutrients', () => {
  it('escala proporcionalmente: 150 g = 150 % de los valores por 100 g', () => {
    const n = scaleNutrients({ kcal: 165, protein: 31, fat: 3.6 }, 150);
    expect(n.kcal).toBeCloseTo(247.5);
    expect(n.protein).toBeCloseTo(46.5);
    expect(n.fat).toBeCloseTo(5.4);
  });
  it('no inventa nutrientes ausentes', () => {
    const n = scaleNutrients({ kcal: 100 }, 200);
    expect(n).toEqual({ kcal: 200 });
    expect('vitaminD' in n).toBe(false);
  });
  it('trata cantidades negativas como 0', () => {
    expect(scaleNutrients({ kcal: 100 }, -50).kcal).toBe(0);
  });
});

describe('sumNutrients', () => {
  it('suma y marca totales parciales y ausentes', () => {
    const t = sumNutrients([{ kcal: 100, vitaminC: 10 }, { kcal: 50 }]);
    expect(t.values.kcal).toBe(150);
    expect(t.values.vitaminC).toBe(10);
    expect(t.partial.has('vitaminC')).toBe(true);
    expect(t.partial.has('kcal')).toBe(false);
    expect(t.missing.has('vitaminD')).toBe(true);
    expect(t.values.vitaminD).toBeUndefined();
  });
  it('lista vacía devuelve totales vacíos sin marcar ausentes', () => {
    const t = sumNutrients([]);
    expect(t.values).toEqual({});
    expect(t.missing.size).toBe(0);
  });
});

describe('cálculos de una comida real', () => {
  it('pollo + arroz + brócoli con valores USDA', () => {
    const pollo = getFood('pollo-pechuga-plancha')!;
    const arroz = getFood('arroz-blanco-cocido')!;
    const brocoli = getFood('brocoli-cocido')!;
    const items = [
      { per100g: pollo.nutrients, grams: 150 },
      { per100g: arroz.nutrients, grams: 200 },
      { per100g: brocoli.nutrients, grams: 100 },
    ];
    const t = itemsTotals(items);
    // 165*1.5 + 130*2 + 35*1 = 542.5
    expect(t.values.kcal).toBeCloseTo(542.5, 1);
    expect(kcalOf(items)).toBeCloseTo(542.5, 1);
    expect(t.values.protein).toBeCloseTo(31 * 1.5 + 2.69 * 2 + 2.38, 1);
  });
});

describe('utilidades', () => {
  it('percentOf y macroEnergySplit', () => {
    expect(percentOf(50, 200)).toBe(25);
    expect(percentOf(10, 0)).toBe(0);
    const s = macroEnergySplit({ protein: 25, carbs: 25, fat: 0 });
    expect(s.protein).toBeCloseTo(0.5);
  });
  it('roundGrams', () => {
    expect(roundGrams(7.4)).toBe(7);
    expect(roundGrams(0.2)).toBe(1);
    expect(roundGrams(143)).toBe(145);
  });
});

describe('base de datos local', () => {
  it('distingue crudo y cocinado con valores distintos', () => {
    const crudo = getFood('arroz-blanco-crudo')!;
    const cocido = getFood('arroz-blanco-cocido')!;
    expect(crudo.preparation).toBe('crudo');
    expect(cocido.preparation).toBe('cocido');
    expect(crudo.nutrients.kcal!).toBeGreaterThan(cocido.nutrients.kcal! * 2);
  });
  it('todos los alimentos tienen fuente USDA identificable y energía', () => {
    for (const f of getAllFoods()) {
      expect(f.source.kind).toBe('usda-sr');
      if (f.source.kind === 'usda-sr') expect(f.source.fdcId).toBeGreaterThan(100000);
      expect(typeof f.nutrients.kcal).toBe('number');
    }
  });
  it('los platos solo usan ingredientes existentes', () => {
    for (const d of getDishes()) for (const i of d.items) expect(getFood(i.foodId)).toBeDefined();
  });
  it('búsqueda sin tildes y por alias', () => {
    expect(searchLocalFoods('platano')[0].food.id).toBe('platano');
    expect(searchLocalFoods('pechuga de pollo').length).toBeGreaterThan(0);
    expect(searchLocalFoods('aguacate')[0].food.id).toBe('aguacate');
    expect(searchLocalFoods('salmón').some((r) => r.food.id === 'salmon-plancha')).toBe(true);
    expect(searchLocalFoods('patata cocida')[0].food.id).toBe('patata-cocida');
  });
});
