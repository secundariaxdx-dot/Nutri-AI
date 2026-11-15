/** Hooks reactivos sobre IndexedDB: se actualizan solos al cambiar los datos. */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { DEFAULT_PROFILE } from '@/db/profile';
import { DEFAULT_SETTINGS, getSettings, type AppSettings } from '@/db/settings';
import { sortMeals } from '@/db/meals';
import type { Meal, Profile } from '@/types';

export function useMealsByDate(date: string): Meal[] | undefined {
  return useLiveQuery(async () => {
    const meals = await db.meals.where('date').equals(date).toArray();
    return sortMeals(meals.filter((m) => !m.deleted));
  }, [date]);
}

export function useMealsInRange(from: string, to: string): Meal[] | undefined {
  return useLiveQuery(async () => {
    const meals = await db.meals.where('date').between(from, to, true, true).toArray();
    return meals.filter((m) => !m.deleted);
  }, [from, to]);
}

export function useMeal(id: string | undefined): Meal | null | undefined {
  return useLiveQuery(async () => {
    if (!id) return null;
    const m = await db.meals.get(id);
    return m && !m.deleted ? m : null;
  }, [id]);
}

export function useProfile(): Profile {
  return useLiveQuery(() => db.profile.get('me'), []) ?? DEFAULT_PROFILE;
}

export function useProfileLoaded(): Profile | undefined | null {
  return useLiveQuery(async () => (await db.profile.get('me')) ?? null, []);
}

export function useSettings(): AppSettings {
  return useLiveQuery(getSettings, []) ?? DEFAULT_SETTINGS;
}

export function useWeights() {
  return useLiveQuery(() => db.weights.orderBy('date').toArray(), []) ?? [];
}

export function usePendingSyncCount(): number {
  return (
    useLiveQuery(async () => {
      const [m, f, p] = await Promise.all([db.meals.where('dirty').equals(1).count(), db.customFoods.where('dirty').equals(1).count(), db.profile.get('me')]);
      return m + f + (p?.dirty ? 1 : 0);
    }, []) ?? 0
  );
}
