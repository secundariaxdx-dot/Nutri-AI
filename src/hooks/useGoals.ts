import { DEFAULT_GOALS } from '@/config/app';
import type { Goals } from '@/types';
import { useProfile } from './useData';

export function useGoals(): Goals {
  const p = useProfile();
  return p.goals ?? DEFAULT_GOALS;
}
