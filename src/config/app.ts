import type { ActivityLevel, FoodCategory, GoalType, MealType, Preparation, Sex } from '@/types';

export const APP_NAME = 'Nutri AI';
export const APP_VERSION = '1.1.0';

export const MEAL_TYPES: { value: MealType; label: string; emoji: string }[] = [
  { value: 'desayuno', label: 'Desayuno', emoji: '☀️' },
  { value: 'media-manana', label: 'Media mañana', emoji: '🍎' },
  { value: 'comida', label: 'Comida', emoji: '🍽️' },
  { value: 'merienda', label: 'Merienda', emoji: '🥪' },
  { value: 'cena', label: 'Cena', emoji: '🌙' },
  { value: 'otros', label: 'Otros', emoji: '✨' },
];

export const MEAL_TYPE_LABEL: Record<MealType, string> = Object.fromEntries(
  MEAL_TYPES.map((m) => [m.value, m.label]),
) as Record<MealType, string>;

/** Sugiere el tipo de comida según la hora local. */
export function suggestMealType(date = new Date()): MealType {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 5 && h < 10.5) return 'desayuno';
  if (h >= 10.5 && h < 12.5) return 'media-manana';
  if (h >= 12.5 && h < 16.5) return 'comida';
  if (h >= 16.5 && h < 19.5) return 'merienda';
  if (h >= 19.5 || h < 1) return 'cena';
  return 'otros';
}

export const PREPARATION_LABEL: Record<Preparation, string> = {
  crudo: 'Crudo',
  cocido: 'Cocido',
  plancha: 'A la plancha',
  frito: 'Frito',
  horneado: 'Horneado',
  asado: 'Asado',
  tostado: 'Tostado',
  natural: 'Natural',
  procesado: 'Procesado',
};

export const CATEGORY_LABEL: Record<FoodCategory, string> = {
  carnes: 'Carnes',
  pescados: 'Pescados y mariscos',
  huevos: 'Huevos',
  cereales: 'Cereales, pan y tubérculos',
  legumbres: 'Legumbres',
  verduras: 'Verduras y hortalizas',
  frutas: 'Frutas',
  lacteos: 'Lácteos',
  'frutos-secos': 'Frutos secos y semillas',
  grasas: 'Aceites y grasas',
  salsas: 'Salsas y condimentos',
  dulces: 'Dulces y snacks',
  bebidas: 'Bebidas',
  platos: 'Platos preparados',
  personalizado: 'Mis alimentos',
  envasado: 'Productos envasados',
};

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'mujer', label: 'Mujer' },
  { value: 'hombre', label: 'Hombre' },
  { value: 'no-especificado', label: 'Prefiero no indicarlo' },
];

export const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; hint: string; factor: number }[] = [
  { value: 'sedentario', label: 'Sedentario', hint: 'Poco o ningún ejercicio', factor: 1.2 },
  { value: 'ligero', label: 'Ligero', hint: 'Ejercicio 1–3 días/semana', factor: 1.375 },
  { value: 'moderado', label: 'Moderado', hint: 'Ejercicio 3–5 días/semana', factor: 1.55 },
  { value: 'alto', label: 'Alto', hint: 'Ejercicio intenso 6–7 días/semana', factor: 1.725 },
  { value: 'muy-alto', label: 'Muy alto', hint: 'Trabajo físico o doble sesión', factor: 1.9 },
];

export const GOAL_OPTIONS: { value: GoalType; label: string; hint: string }[] = [
  { value: 'mantener', label: 'Mantener peso', hint: 'Igualar el gasto estimado' },
  { value: 'perder', label: 'Perder peso', hint: 'Déficit moderado (~15 %)' },
  { value: 'ganar', label: 'Ganar peso', hint: 'Superávit moderado (~10 %)' },
  { value: 'musculo', label: 'Ganar masa muscular', hint: 'Superávit ligero y más proteína' },
];

/** Objetivos por defecto mientras no se configure el perfil. */
export const DEFAULT_GOALS = { kcal: 2000, protein: 90, carbs: 250, fat: 67, fiber: 25 };
