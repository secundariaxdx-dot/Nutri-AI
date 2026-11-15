/**
 * Borrador de comida en memoria. Permite pasar alimentos entre pantallas
 * (p. ej. del escáner al editor) sin perder la foto, que es un Blob.
 */
import { useSyncExternalStore } from 'react';
import { suggestMealType } from '@/config/app';
import { timeNow, todayKey } from '@/lib/dates';
import type { Meal, MealItem, MealType } from '@/types';

export interface MealDraft {
  id?: string;
  date: string;
  mealType: MealType;
  time: string;
  name: string;
  notes?: string;
  items: MealItem[];
  photo?: Blob;
  thumb?: Blob;
  photoPath?: string;
  origin: Meal['origin'];
}

export function newDraft(partial: Partial<MealDraft> = {}): MealDraft {
  return {
    date: todayKey(),
    mealType: suggestMealType(),
    time: timeNow(),
    name: '',
    items: [],
    origin: 'manual',
    ...partial,
  };
}

export function draftFromMeal(m: Meal): MealDraft {
  return {
    id: m.id,
    date: m.date,
    mealType: m.mealType,
    time: m.time,
    name: m.name,
    notes: m.notes,
    items: m.items.map((i) => ({ ...i })),
    photo: m.photo,
    thumb: m.thumb,
    photoPath: m.photoPath,
    origin: m.origin,
  };
}

let pending: MealDraft | null = null;
const listeners = new Set<() => void>();

/** Deja un borrador preparado para la siguiente pantalla del editor. */
export function setPendingDraft(d: MealDraft | null) {
  pending = d;
  listeners.forEach((l) => l());
}

/** Recoge (y consume) el borrador pendiente. */
export function takePendingDraft(): MealDraft | null {
  const d = pending;
  pending = null;
  return d;
}

export function usePendingDraft(): MealDraft | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => pending,
  );
}
