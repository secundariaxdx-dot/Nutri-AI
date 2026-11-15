import { DEFAULT_GOALS } from '@/config/app';
import { computeGoals } from '@/lib/energy';
import type { Profile } from '@/types';
import { db } from './database';

export const DEFAULT_PROFILE: Profile = {
  id: 'me',
  sex: 'no-especificado',
  activity: 'ligero',
  goal: 'mantener',
  autoGoals: true,
  goals: { ...DEFAULT_GOALS },
  updatedAt: 0,
  dirty: 0,
};

export async function getProfile(): Promise<Profile> {
  return (await db.profile.get('me')) ?? DEFAULT_PROFILE;
}

/** Indica si hay datos suficientes para calcular objetivos automáticamente. */
export function canComputeGoals(p: Profile): boolean {
  return !!(p.age && p.heightCm && p.weightKg);
}

export function withComputedGoals(p: Profile): Profile {
  if (!p.autoGoals || !canComputeGoals(p)) return p;
  const g = computeGoals({
    age: p.age!,
    sex: p.sex,
    heightCm: p.heightCm!,
    weightKg: p.weightKg!,
    activity: p.activity,
    goal: p.goal,
  });
  return { ...p, goals: { kcal: g.kcal, protein: g.protein, carbs: g.carbs, fat: g.fat, fiber: g.fiber } };
}

export async function saveProfile(p: Profile): Promise<Profile> {
  const next = withComputedGoals({ ...p, id: 'me', updatedAt: Date.now(), dirty: 1 });
  await db.profile.put(next);
  if (next.weightKg) {
    const { toDateKey } = await import('@/lib/dates');
    await db.weights.put({ date: toDateKey(), kg: next.weightKg });
  }
  return next;
}
