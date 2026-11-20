/**
 * Modelos de datos de Nutri AI.
 * Todos los valores nutricionales de un alimento se expresan POR CADA 100 g.
 */

/** Claves de nutrientes soportados. */
export type NutrientKey =
  | 'kcal'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'saturatedFat'
  | 'fiber'
  | 'sugars'
  | 'sodium'
  | 'potassium'
  | 'calcium'
  | 'iron'
  | 'magnesium'
  | 'phosphorus'
  | 'zinc'
  | 'vitaminA'
  | 'vitaminC'
  | 'vitaminD'
  | 'vitaminE'
  | 'thiamin'
  | 'riboflavin'
  | 'niacin'
  | 'vitaminB6'
  | 'folate'
  | 'vitaminB12';

/**
 * Mapa de nutrientes. Una clave AUSENTE significa "sin datos" (nunca se
 * rellena con 0 si la fuente no lo proporciona).
 */
export type Nutrients = Partial<Record<NutrientKey, number>>;

export type Preparation =
  | 'crudo'
  | 'cocido'
  | 'plancha'
  | 'frito'
  | 'horneado'
  | 'asado'
  | 'tostado'
  | 'natural'
  | 'procesado';

export type FoodCategory =
  | 'carnes'
  | 'pescados'
  | 'huevos'
  | 'cereales'
  | 'legumbres'
  | 'verduras'
  | 'frutas'
  | 'lacteos'
  | 'frutos-secos'
  | 'grasas'
  | 'salsas'
  | 'dulces'
  | 'bebidas'
  | 'platos'
  | 'personalizado'
  | 'envasado';

/** Origen identificable de los datos nutricionales. */
export type NutrientSource =
  | { kind: 'usda-sr'; fdcId: number; description: string }
  | { kind: 'usda-api'; fdcId: number; description: string; dataType?: string }
  | { kind: 'off'; barcode: string; url: string }
  | { kind: 'custom'; note?: string };

export interface Food {
  id: string;
  name: string;
  aliases?: string[];
  brand?: string;
  category: FoodCategory;
  preparation?: Preparation;
  /** Ración orientativa en gramos. */
  portion?: number;
  /** Etiquetas en inglés para el reconocimiento por visión. */
  vision?: string[];
  source: NutrientSource;
  /** Valores por 100 g. */
  nutrients: Nutrients;
  barcode?: string;
  imageUrl?: string;
  ingredients?: string;
  allergens?: string[];
}

/** Alimento creado por el usuario o guardado desde fuentes en línea. */
export interface CustomFood extends Food {
  createdAt: number;
  updatedAt: number;
  deleted?: 0 | 1;
  dirty?: 0 | 1;
}

/** Elemento concreto dentro de una comida. */
export interface MealItem {
  id: string;
  foodId?: string;
  name: string;
  grams: number;
  /** Copia de los nutrientes por 100 g en el momento de registrar. */
  per100g: Nutrients;
  source: NutrientSource;
  preparation?: Preparation;
  brand?: string;
  /** true si la cantidad procede de una estimación (foto). */
  estimated?: boolean;
  /** Confianza del modelo de visión (0–1), si aplica. */
  confidence?: number;
  /** Nombre del plato del que procede (desglose de recetas). */
  fromDish?: string;
  /** Nombre con el que lo describió la IA (si difiere del de la base de datos). */
  aiName?: string;
  /** true si la IA no pudo confirmar la preparación (crudo, frito…). */
  preparationUnconfirmed?: boolean;
  /** true si la cantidad es una ración por defecto (la IA no dio gramos). */
  defaultQuantity?: boolean;
}

export type MealType = 'desayuno' | 'media-manana' | 'comida' | 'merienda' | 'cena' | 'otros';

export interface Meal {
  id: string;
  /** Fecha local YYYY-MM-DD a la que pertenece la comida. */
  date: string;
  mealType: MealType;
  name: string;
  /** Hora local HH:mm. */
  time: string;
  items: MealItem[];
  notes?: string;
  photo?: Blob;
  thumb?: Blob;
  /** Ruta de la foto en Supabase Storage (si se ha sincronizado). */
  photoPath?: string;
  /** Cómo se creó: foto, manual, código de barras… */
  origin: 'foto' | 'manual' | 'codigo' | 'duplicado' | 'importado';
  createdAt: number;
  updatedAt: number;
  /** Lápida para sincronización (1 = eliminada). */
  deleted: 0 | 1;
  /** Pendiente de subir al servidor (1 = sí). */
  dirty: 0 | 1;
}

export type Sex = 'hombre' | 'mujer' | 'no-especificado';
export type ActivityLevel = 'sedentario' | 'ligero' | 'moderado' | 'alto' | 'muy-alto';
export type GoalType = 'mantener' | 'perder' | 'ganar' | 'musculo';

export interface Goals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface Profile {
  id: 'me';
  name?: string;
  age?: number;
  sex: Sex;
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  activity: ActivityLevel;
  goal: GoalType;
  /** Si es true, los objetivos se calculan automáticamente. */
  autoGoals: boolean;
  goals: Goals;
  updatedAt: number;
  dirty: 0 | 1;
}

export interface WeightEntry {
  date: string;
  kg: number;
}

/** Resultado de búsqueda unificado. */
export interface FoodSearchResult {
  food: Food;
  origin: 'local' | 'custom' | 'off' | 'usda';
  score?: number;
}
