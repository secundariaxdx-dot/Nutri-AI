import type { NutrientKey } from '@/types';

export type NutrientGroup = 'energia' | 'macros' | 'minerales' | 'vitaminas';

export interface NutrientDef {
  key: NutrientKey;
  label: string;
  short?: string;
  unit: 'kcal' | 'g' | 'mg' | 'µg';
  group: NutrientGroup;
  /**
   * Valor de referencia diario para adultos. Para vitaminas y minerales se usan
   * los Valores de Referencia de Nutrientes (VRN) del Reglamento (UE) 1169/2011.
   * Para el sodio se usa el límite máximo recomendado por la OMS (2 g/día).
   */
  reference?: number;
  /** Si true, la referencia es un límite (no conviene superarlo). */
  isLimit?: boolean;
}

export const NUTRIENTS: NutrientDef[] = [
  { key: 'kcal', label: 'Calorías', unit: 'kcal', group: 'energia' },
  { key: 'protein', label: 'Proteínas', unit: 'g', group: 'macros' },
  { key: 'carbs', label: 'Carbohidratos', short: 'Carbos', unit: 'g', group: 'macros' },
  { key: 'fat', label: 'Grasas', unit: 'g', group: 'macros' },
  { key: 'saturatedFat', label: 'Grasas saturadas', short: 'Saturadas', unit: 'g', group: 'macros', reference: 20, isLimit: true },
  { key: 'fiber', label: 'Fibra', unit: 'g', group: 'macros', reference: 25 },
  { key: 'sugars', label: 'Azúcares', unit: 'g', group: 'macros', reference: 90, isLimit: true },
  { key: 'sodium', label: 'Sodio', unit: 'mg', group: 'minerales', reference: 2000, isLimit: true },
  { key: 'potassium', label: 'Potasio', unit: 'mg', group: 'minerales', reference: 2000 },
  { key: 'calcium', label: 'Calcio', unit: 'mg', group: 'minerales', reference: 800 },
  { key: 'iron', label: 'Hierro', unit: 'mg', group: 'minerales', reference: 14 },
  { key: 'magnesium', label: 'Magnesio', unit: 'mg', group: 'minerales', reference: 375 },
  { key: 'phosphorus', label: 'Fósforo', unit: 'mg', group: 'minerales', reference: 700 },
  { key: 'zinc', label: 'Zinc', unit: 'mg', group: 'minerales', reference: 10 },
  { key: 'vitaminA', label: 'Vitamina A', short: 'Vit. A', unit: 'µg', group: 'vitaminas', reference: 800 },
  { key: 'vitaminC', label: 'Vitamina C', short: 'Vit. C', unit: 'mg', group: 'vitaminas', reference: 80 },
  { key: 'vitaminD', label: 'Vitamina D', short: 'Vit. D', unit: 'µg', group: 'vitaminas', reference: 5 },
  { key: 'vitaminE', label: 'Vitamina E', short: 'Vit. E', unit: 'mg', group: 'vitaminas', reference: 12 },
  { key: 'thiamin', label: 'Tiamina (B1)', short: 'B1', unit: 'mg', group: 'vitaminas', reference: 1.1 },
  { key: 'riboflavin', label: 'Riboflavina (B2)', short: 'B2', unit: 'mg', group: 'vitaminas', reference: 1.4 },
  { key: 'niacin', label: 'Niacina (B3)', short: 'B3', unit: 'mg', group: 'vitaminas', reference: 16 },
  { key: 'vitaminB6', label: 'Vitamina B6', short: 'B6', unit: 'mg', group: 'vitaminas', reference: 1.4 },
  { key: 'folate', label: 'Folato (B9)', short: 'B9', unit: 'µg', group: 'vitaminas', reference: 200 },
  { key: 'vitaminB12', label: 'Vitamina B12', short: 'B12', unit: 'µg', group: 'vitaminas', reference: 2.5 },
];

export const NUTRIENT_MAP: Record<NutrientKey, NutrientDef> = Object.fromEntries(
  NUTRIENTS.map((n) => [n.key, n]),
) as Record<NutrientKey, NutrientDef>;

export const NUTRIENT_KEYS = NUTRIENTS.map((n) => n.key);

export const MICRO_KEYS: NutrientKey[] = NUTRIENTS.filter(
  (n) => n.group === 'minerales' || n.group === 'vitaminas',
).map((n) => n.key);

export const GROUP_LABELS: Record<NutrientGroup, string> = {
  energia: 'Energía',
  macros: 'Macronutrientes',
  minerales: 'Minerales',
  vitaminas: 'Vitaminas',
};
