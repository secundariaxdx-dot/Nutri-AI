import { uid } from '@/lib/id';
import { timeNow } from '@/lib/dates';
import type { Meal, MealItem } from '@/types';
import { db } from './database';
import { touchRecentFoods } from './recent';

export type MealInput = Omit<Meal, 'id' | 'createdAt' | 'updatedAt' | 'deleted' | 'dirty'> & { id?: string };

function validate(meal: Pick<Meal, 'date' | 'items' | 'name'>) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meal.date)) throw new Error('Fecha no válida');
  if (!meal.items.length) throw new Error('Añade al menos un alimento');
  for (const it of meal.items) {
    if (!(it.grams > 0) || it.grams > 5000) throw new Error(`Cantidad no válida para «${it.name}»`);
  }
}

/** Crea o actualiza una comida. */
export async function saveMeal(input: MealInput): Promise<Meal> {
  validate(input);
  const now = Date.now();
  const existing = input.id ? await db.meals.get(input.id) : undefined;
  const meal: Meal = {
    ...input,
    id: existing?.id ?? input.id ?? uid(),
    name: input.name.trim() || defaultMealName(input.items),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    deleted: 0,
    dirty: 1,
  };
  await db.meals.put(meal);
  await touchRecentFoods(meal.items);
  return meal;
}

/** Borrado lógico (lápida) para que la sincronización propague la eliminación. */
export async function deleteMeal(id: string): Promise<void> {
  await db.meals.update(id, {
    deleted: 1,
    dirty: 1,
    updatedAt: Date.now(),
    items: [],
    photo: undefined,
    thumb: undefined,
  });
}

export async function restoreMeal(meal: Meal): Promise<void> {
  await db.meals.put({ ...meal, deleted: 0, dirty: 1, updatedAt: Date.now() });
}

/** Duplica una comida (opcionalmente en otra fecha). */
export async function duplicateMeal(id: string, date?: string): Promise<Meal> {
  const src = await db.meals.get(id);
  if (!src || src.deleted) throw new Error('La comida no existe');
  const now = Date.now();
  const copy: Meal = {
    ...src,
    id: uid(),
    date: date ?? src.date,
    time: date && date !== src.date ? src.time : timeNow(),
    items: src.items.map((i) => ({ ...i, id: uid() })),
    origin: 'duplicado',
    photoPath: undefined,
    createdAt: now,
    updatedAt: now,
    deleted: 0,
    dirty: 1,
  };
  await db.meals.put(copy);
  return copy;
}

export async function getMeal(id: string): Promise<Meal | undefined> {
  const m = await db.meals.get(id);
  return m && !m.deleted ? m : undefined;
}

export async function getMealsByDate(date: string): Promise<Meal[]> {
  const meals = await db.meals.where('date').equals(date).toArray();
  return sortMeals(meals.filter((m) => !m.deleted));
}

export async function getMealsInRange(from: string, to: string): Promise<Meal[]> {
  const meals = await db.meals.where('date').between(from, to, true, true).toArray();
  return meals.filter((m) => !m.deleted);
}

/** Fechas (YYYY-MM-DD) que tienen al menos una comida en el rango. */
export async function getDatesWithMeals(from: string, to: string): Promise<Set<string>> {
  const meals = await getMealsInRange(from, to);
  return new Set(meals.map((m) => m.date));
}

const ORDER = ['desayuno', 'media-manana', 'comida', 'merienda', 'cena', 'otros'];
export function sortMeals(meals: Meal[]): Meal[] {
  return [...meals].sort(
    (a, b) => ORDER.indexOf(a.mealType) - ORDER.indexOf(b.mealType) || a.time.localeCompare(b.time) || a.createdAt - b.createdAt,
  );
}

export function defaultMealName(items: MealItem[]): string {
  if (!items.length) return 'Comida';
  const dish = items.find((i) => i.fromDish)?.fromDish;
  if (dish) return dish;
  const names = items.slice(0, 3).map((i) => i.name.split(/[,(/]/)[0].trim());
  return names.join(', ') + (items.length > 3 ? '…' : '');
}
